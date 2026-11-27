import crypto from 'node:crypto';
import fs from 'node:fs';

const DEFAULT_TOKEN_TTL_MS = 50 * 60 * 1000;

export class ApnsJwtSigner {
  constructor({ teamId, keyId, privateKeyPem, tokenTtlMs = DEFAULT_TOKEN_TTL_MS }) {
    if (!teamId || !keyId || !privateKeyPem) {
      throw new Error('ApnsJwtSigner requires teamId, keyId, and privateKeyPem');
    }

    const privateKeyObject = crypto.createPrivateKey(privateKeyPem);
    if (privateKeyObject.asymmetricKeyType !== 'ec') {
      throw new Error(
        `APNs private key must be an EC (P-256) key, got "${privateKeyObject.asymmetricKeyType}"`,
      );
    }

    this.teamId = teamId;
    this.keyId = keyId;
    this.privateKeyObject = privateKeyObject;
    this.tokenTtlMs = tokenTtlMs;
    this.encodedHeader = Buffer.from(
      JSON.stringify({
        alg: 'ES256',
        kid: keyId,
      }),
      'utf8',
    ).toString('base64url');

    this.cachedJwt = null;
    this.cachedExpiresAtMs = 0;
  }

  static fromKeyFile({ teamId, keyId, privateKeyPath, tokenTtlMs }) {
    const privateKeyPem = fs.readFileSync(privateKeyPath, 'utf8');
    return new ApnsJwtSigner({
      teamId,
      keyId,
      privateKeyPem,
      tokenTtlMs,
    });
  }

  getToken(nowMs = Date.now()) {
    if (this.cachedJwt !== null && nowMs < this.cachedExpiresAtMs) {
      return this.cachedJwt;
    }

    const issuedAtSeconds = Math.floor(nowMs / 1000);
    const encodedClaims = Buffer.from(
      JSON.stringify({
        iss: this.teamId,
        iat: issuedAtSeconds,
      }),
      'utf8',
    ).toString('base64url');

    const signingInput = `${this.encodedHeader}.${encodedClaims}`;
    const signature = crypto.sign('sha256', Buffer.from(signingInput, 'utf8'), {
      key: this.privateKeyObject,
      dsaEncoding: 'ieee-p1363',
    });

    this.cachedJwt = `${signingInput}.${signature.toString('base64url')}`;
    this.cachedExpiresAtMs = nowMs + this.tokenTtlMs;
    return this.cachedJwt;
  }

  invalidate() {
    this.cachedJwt = null;
    this.cachedExpiresAtMs = 0;
  }
}
