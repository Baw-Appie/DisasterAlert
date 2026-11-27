import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import http2 from 'node:http2';
import stream from 'node:stream';
import { describe, it } from 'node:test';
import { ApnsJwtSigner } from '../src/clients/apns-jwt.signer.js';
import { ApnsClient } from '../src/clients/apns.client.js';

const SAMPLE_TOKEN = '0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef';

function createTestKeyPair() {
  return crypto.generateKeyPairSync('ec', {
    namedCurve: 'prime256v1',
    publicKeyEncoding: { type: 'spki', format: 'pem' },
    privateKeyEncoding: { type: 'pkcs8', format: 'pem' },
  });
}

function createInMemoryApnsHttp2Server(responder) {
  const receivedRequests = [];
  const server = http2.createServer();

  server.on('stream', (serverStream, headers) => {
    const chunks = [];
    serverStream.on('data', (chunk) => {
      chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
    });
    serverStream.on('end', () => {
      const rawBody = Buffer.concat(chunks).toString('utf8');
      const parsedPayload = rawBody.length > 0 ? JSON.parse(rawBody) : null;
      receivedRequests.push({
        headers,
        payload: parsedPayload,
      });

      const outcome = responder({ headers, payload: parsedPayload });
      const responseHeaders = {
        ':status': outcome.statusCode,
      };
      if (outcome.apnsId) {
        responseHeaders['apns-id'] = outcome.apnsId;
      }

      if (outcome.body) {
        const encodedBody = Buffer.from(JSON.stringify(outcome.body), 'utf8');
        responseHeaders['content-type'] = 'application/json';
        serverStream.respond(responseHeaders);
        serverStream.end(encodedBody);
      } else {
        serverStream.respond(responseHeaders);
        serverStream.end();
      }
    });
  });

  return {
    server,
    receivedRequests,
    acceptDuplex() {
      const [clientSocket, serverSocket] = stream.duplexPair();
      server.emit('connection', serverSocket);
      return clientSocket;
    },
  };
}

describe('ApnsJwtSigner and ApnsClient', () => {
  it('signs valid ES256 provider JWTs with IEEE P1363 format and caches until expiry', () => {
    const { privateKey, publicKey } = createTestKeyPair();
    const signer = new ApnsJwtSigner({
      teamId: 'TEAM123456',
      keyId: 'KEY1234567',
      privateKeyPem: privateKey,
      tokenTtlMs: 3_000_000,
    });

    const firstJwt = signer.getToken(1_700_000_000_000);
    const cachedJwt = signer.getToken(1_700_000_500_000);
    assert.equal(firstJwt, cachedJwt);

    const parts = firstJwt.split('.');
    assert.equal(parts.length, 3);

    const decodedHeader = JSON.parse(Buffer.from(parts[0], 'base64url').toString('utf8'));
    const decodedClaims = JSON.parse(Buffer.from(parts[1], 'base64url').toString('utf8'));
    const signatureBuffer = Buffer.from(parts[2], 'base64url');

    assert.deepEqual(decodedHeader, { alg: 'ES256', kid: 'KEY1234567' });
    assert.deepEqual(decodedClaims, { iss: 'TEAM123456', iat: 1_700_000_000 });
    assert.equal(signatureBuffer.length, 64);

    const verified = crypto.verify(
      'sha256',
      Buffer.from(`${parts[0]}.${parts[1]}`, 'utf8'),
      { key: publicKey, dsaEncoding: 'ieee-p1363' },
      signatureBuffer,
    );
    assert.equal(verified, true);

    const refreshedJwt = signer.getToken(1_700_004_000_000);
    assert.notEqual(refreshedJwt, firstJwt);
  });

  it('routes HTTP/2 requests to sandbox and production APNs independently and classifies responses', async () => {
    const { privateKey } = createTestKeyPair();
    const signer = new ApnsJwtSigner({
      teamId: 'TEAM123456',
      keyId: 'KEY1234567',
      privateKeyPem: privateKey,
    });

    const sandboxMock = createInMemoryApnsHttp2Server(({ headers }) => {
      if (headers[':path'].endsWith('deadbeef')) {
        return { statusCode: 410, body: { reason: 'Unregistered' } };
      }
      return { statusCode: 200, apnsId: 'sandbox-apns-id-1' };
    });

    const productionMock = createInMemoryApnsHttp2Server(({ headers }) => {
      if (headers[':path'].endsWith('badtoken')) {
        return { statusCode: 400, body: { reason: 'BadDeviceToken' } };
      }
      if (headers[':path'].endsWith('fail503')) {
        return { statusCode: 503, body: { reason: 'ServiceUnavailable' } };
      }
      return { statusCode: 200, apnsId: 'prod-apns-id-1' };
    });

    const apnsClient = new ApnsClient({
      topic: 'com.example.app',
      jwtSigner: signer,
      endpoints: {
        sandbox: 'http://sandbox.apns.local',
        production: 'http://production.apns.local',
      },
      connectOptions: {
        createConnection(authority) {
          if (authority.hostname === 'sandbox.apns.local') {
            return sandboxMock.acceptDuplex();
          }
          return productionMock.acceptDuplex();
        },
      },
    });

    try {
      const sandboxOk = await apnsClient.sendNotification({
        token: SAMPLE_TOKEN,
        environment: 'sandbox',
        payload: {
          aps: {
            alert: { title: '테스트 알림', body: '본문' },
            sound: 'default',
          },
        },
      });
      assert.equal(sandboxOk.ok, true);
      assert.equal(sandboxOk.apnsId, 'sandbox-apns-id-1');
      assert.equal(sandboxMock.receivedRequests.length, 1);
      assert.equal(sandboxMock.receivedRequests[0].headers['apns-topic'], 'com.example.app');
      assert.equal(sandboxMock.receivedRequests[0].headers['apns-push-type'], 'alert');
      assert.equal(sandboxMock.receivedRequests[0].headers['apns-priority'], '10');

      const prodCritical = await apnsClient.sendNotification({
        token: SAMPLE_TOKEN,
        environment: 'production',
        payload: {
          aps: {
            alert: { title: '[긴급재난] 지진', body: '대피하세요' },
            sound: { critical: 1, name: 'warning.caf', volume: 1 },
            'interruption-level': 'critical',
          },
        },
      });
      assert.equal(prodCritical.ok, true);
      assert.equal(productionMock.receivedRequests.length, 1);
      assert.deepEqual(productionMock.receivedRequests[0].payload.aps.sound, {
        critical: 1,
        name: 'warning.caf',
        volume: 1,
      });

      const unregisteredResult = await apnsClient.sendNotification({
        token: `${SAMPLE_TOKEN.slice(0, 56)}deadbeef`,
        environment: 'sandbox',
        payload: { aps: { alert: { title: 't', body: 'b' }, sound: 'default' } },
      });
      assert.equal(unregisteredResult.ok, false);
      assert.equal(unregisteredResult.isInvalidToken, true);
      assert.equal(unregisteredResult.statusCode, 410);

      const badTokenResult = await apnsClient.sendNotification({
        token: `${SAMPLE_TOKEN.slice(0, 56)}badtoken`,
        environment: 'production',
        payload: { aps: { alert: { title: 't', body: 'b' }, sound: 'default' } },
      });
      assert.equal(badTokenResult.ok, false);
      assert.equal(badTokenResult.isInvalidToken, true);
      assert.equal(badTokenResult.reason, 'BadDeviceToken');

      const unavailableResult = await apnsClient.sendNotification({
        token: `${SAMPLE_TOKEN.slice(0, 57)}fail503`,
        environment: 'production',
        payload: { aps: { alert: { title: 't', body: 'b' }, sound: 'default' } },
      });
      assert.equal(unavailableResult.ok, false);
      assert.equal(unavailableResult.isInvalidToken, false);
      assert.equal(unavailableResult.statusCode, 503);
    } finally {
      await apnsClient.close();
      sandboxMock.server.close();
      productionMock.server.close();
    }
  });
});
