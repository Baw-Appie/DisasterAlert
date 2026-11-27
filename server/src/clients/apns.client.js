import http2 from 'node:http2';

const DEFAULT_ENDPOINTS = Object.freeze({
  production: 'https://api.push.apple.com',
  sandbox: 'https://api.sandbox.push.apple.com',
});

const INVALID_TOKEN_REASONS = new Set(['BadDeviceToken', 'DeviceTokenNotForTopic', 'Unregistered']);

const DEFAULT_REQUEST_TIMEOUT_MS = 10_000;

export class ApnsClient {
  constructor({
    topic = null,
    jwtSigner = null,
    endpoints = DEFAULT_ENDPOINTS,
    connectOptions = {},
    requestTimeoutMs = DEFAULT_REQUEST_TIMEOUT_MS,
  } = {}) {
    this.topic = topic;
    this.jwtSigner = jwtSigner;
    this.endpoints = {
      ...DEFAULT_ENDPOINTS,
      ...endpoints,
    };
    this.connectOptions = connectOptions;
    this.requestTimeoutMs = requestTimeoutMs;
    this.sessions = new Map();
  }

  get isConfigured() {
    return Boolean(this.topic && this.jwtSigner);
  }

  async sendNotification({
    token,
    environment,
    payload,
    collapseId = null,
    expirationEpochSeconds = null,
  }) {
    if (!this.isConfigured) {
      return {
        ok: false,
        isInvalidToken: false,
        statusCode: null,
        reason: 'ApnsNotConfigured',
        apnsId: null,
      };
    }

    const endpoint = this.endpoints[environment];
    if (!endpoint) {
      throw new Error(`Unsupported APNs environment: "${environment}"`);
    }

    let session;
    try {
      session = await this.#getOrCreateSession(environment, endpoint);
    } catch (connectionError) {
      return {
        ok: false,
        isInvalidToken: false,
        statusCode: null,
        reason: connectionError.message || 'ConnectionFailed',
        apnsId: null,
      };
    }

    const providerToken = this.jwtSigner.getToken();
    const requestBodyBuffer = Buffer.from(JSON.stringify(payload), 'utf8');

    const headers = {
      ':method': 'POST',
      ':path': `/3/device/${token}`,
      authorization: `bearer ${providerToken}`,
      'apns-topic': this.topic,
      'apns-push-type': 'alert',
      'apns-priority': '10',
      'content-type': 'application/json; charset=utf-8',
      'content-length': String(requestBodyBuffer.byteLength),
    };

    if (collapseId) {
      headers['apns-collapse-id'] = collapseId;
    }
    if (typeof expirationEpochSeconds === 'number') {
      headers['apns-expiration'] = String(expirationEpochSeconds);
    }

    return new Promise((resolve) => {
      let settled = false;
      let statusCode = null;
      let apnsId = null;
      const responseChunks = [];

      const finish = (outcome) => {
        if (settled) {
          return;
        }
        settled = true;
        resolve(outcome);
      };

      let stream;
      try {
        stream = session.request(headers);
      } catch (requestError) {
        this.#evictSession(environment, session);
        finish({
          ok: false,
          isInvalidToken: false,
          statusCode: null,
          reason: requestError.message || 'RequestCreationFailed',
          apnsId: null,
        });
        return;
      }

      stream.setTimeout(this.requestTimeoutMs, () => {
        stream.close(http2.constants.NGHTTP2_CANCEL);
        finish({
          ok: false,
          isInvalidToken: false,
          statusCode: null,
          reason: 'RequestTimeout',
          apnsId,
        });
      });

      stream.on('response', (responseHeaders) => {
        const rawStatus = responseHeaders[':status'];
        statusCode = typeof rawStatus === 'number' ? rawStatus : Number(rawStatus);
        const rawApnsId = responseHeaders['apns-id'];
        apnsId = typeof rawApnsId === 'string' ? rawApnsId : null;
      });

      stream.on('data', (chunk) => {
        responseChunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
      });

      stream.on('error', (streamError) => {
        finish({
          ok: false,
          isInvalidToken: false,
          statusCode,
          reason: streamError.message || 'StreamError',
          apnsId,
        });
      });

      stream.on('end', () => {
        const rawResponseText = Buffer.concat(responseChunks).toString('utf8');
        let reason = null;
        if (rawResponseText.length > 0) {
          try {
            const parsedBody = JSON.parse(rawResponseText);
            if (typeof parsedBody?.reason === 'string') {
              reason = parsedBody.reason;
            }
          } catch {
            reason = rawResponseText.slice(0, 120);
          }
        }

        if (statusCode === 200) {
          finish({
            ok: true,
            isInvalidToken: false,
            statusCode: 200,
            reason: null,
            apnsId,
          });
          return;
        }

        if (statusCode === 403 && reason === 'ExpiredProviderToken') {
          this.jwtSigner.invalidate();
        }

        const isInvalidToken =
          statusCode === 410 ||
          (statusCode === 400 && reason !== null && INVALID_TOKEN_REASONS.has(reason));

        finish({
          ok: false,
          isInvalidToken,
          statusCode,
          reason: reason ?? (statusCode === 410 ? 'Unregistered' : 'ApnsError'),
          apnsId,
        });
      });

      stream.end(requestBodyBuffer);
    });
  }

  async close() {
    const closingPromises = [];
    for (const [environment, session] of this.sessions.entries()) {
      this.sessions.delete(environment);
      if (!session.closed && !session.destroyed) {
        closingPromises.push(
          new Promise((resolve) => {
            session.close(() => resolve());
          }),
        );
      }
    }
    await Promise.all(closingPromises);
  }

  #getOrCreateSession(environment, endpoint) {
    const existingSession = this.sessions.get(environment);
    if (existingSession && !existingSession.closed && !existingSession.destroyed) {
      return Promise.resolve(existingSession);
    }

    return new Promise((resolve, reject) => {
      const session = http2.connect(endpoint, this.connectOptions);
      let connected = false;

      const cleanupSession = () => {
        this.#evictSession(environment, session);
      };

      session.once('connect', () => {
        connected = true;
        this.sessions.set(environment, session);
        resolve(session);
      });

      session.on('error', (sessionError) => {
        cleanupSession();
        if (!connected) {
          reject(sessionError);
        }
      });

      session.on('close', cleanupSession);
      session.on('goaway', cleanupSession);
      session.on('frameError', cleanupSession);
    });
  }

  #evictSession(environment, targetSession) {
    if (this.sessions.get(environment) === targetSession) {
      this.sessions.delete(environment);
    }
  }
}
