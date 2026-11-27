import assert from 'node:assert/strict';
import { afterEach, describe, it } from 'node:test';
import { buildApp } from '../src/app.js';
import { loadServerConfig } from '../src/config/env.config.js';

const TOKEN_A = '0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef';
const TOKEN_B = 'fedcba9876543210fedcba9876543210fedcba9876543210fedcba9876543210';
const TEST_API_KEY = '0123456789abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ';

describe('Fastify device and health API routes', () => {
  const activeApps = [];

  afterEach(async () => {
    while (activeApps.length > 0) {
      const instance = activeApps.pop();
      await instance.close();
    }
  });

  async function createTestServer({
    envOverrides = {},
    apnsHandler = async () => ({
      ok: true,
      isInvalidToken: false,
      statusCode: 200,
      reason: null,
      apnsId: 'apns-1',
    }),
    rateLimitOptions = {},
  } = {}) {
    const config = loadServerConfig({
      DATABASE_PATH: ':memory:',
      APNS_ENVIRONMENT: 'production',
      TRUST_PROXY: 'true',
      TEST_PUSH_API_KEY: TEST_API_KEY,
      ...envOverrides,
    });

    const recordedNotifications = [];
    const mockApnsClient = {
      async sendNotification(notificationArgs) {
        recordedNotifications.push(notificationArgs);
        return apnsHandler(notificationArgs);
      },
      async close() {},
    };

    const app = await buildApp({
      config,
      apnsClient: mockApnsClient,
      rateLimitOptions,
    });
    activeApps.push(app);
    return { app, recordedNotifications };
  }

  it('serves GET /health with 200 OK', async () => {
    const { app } = await createTestServer();
    const response = await app.inject({
      method: 'GET',
      url: '/health',
    });

    assert.equal(response.statusCode, 200);
    assert.deepEqual(response.json(), { status: 'ok' });
  });

  it('registers, updates, clears keyword filters, and unregisters devices with 204 No Content', async () => {
    const { app } = await createTestServer();

    const createResponse = await app.inject({
      method: 'PUT',
      url: '/v1/devices',
      payload: {
        token: TOKEN_A,
        environment: 'sandbox',
        regionCodes: ['11500'],
        alertMode: 'normal',
        soundName: 'default',
      },
    });
    assert.equal(createResponse.statusCode, 204);
    assert.equal(createResponse.body, '');

    const storedInitial = app.deviceRepository.findDeviceByToken(TOKEN_A);
    assert.equal(storedInitial.environment, 'sandbox');
    assert.deepEqual(storedInitial.regionCodes, ['11500']);
    assert.equal(storedInitial.alertMode, 'normal');

    const updateCriticalWithKeywords = await app.inject({
      method: 'PUT',
      url: '/v1/devices',
      payload: {
        token: TOKEN_A,
        environment: 'production',
        regionCodes: ['11500', '11680'],
        alertMode: 'critical',
        soundName: 'warning.caf',
        criticalVolume: 1,
        keywordFilterMode: 'block',
        keywords: ['훈련', '테스트'],
      },
    });
    assert.equal(updateCriticalWithKeywords.statusCode, 204);

    const storedUpdated = app.deviceRepository.findDeviceByToken(TOKEN_A);
    assert.equal(storedUpdated.environment, 'production');
    assert.deepEqual(storedUpdated.regionCodes, ['11500', '11680']);
    assert.equal(storedUpdated.alertMode, 'critical');
    assert.equal(storedUpdated.soundName, 'warning.caf');
    assert.equal(storedUpdated.criticalVolume, 1);
    assert.equal(storedUpdated.keywordFilterMode, 'block');
    assert.equal(storedUpdated.keywords.length, 2);

    const clearKeywordsByOmitting = await app.inject({
      method: 'PUT',
      url: '/v1/devices',
      payload: {
        token: TOKEN_A,
        regionCodes: ['00000'],
        alertMode: 'normal',
        soundName: 'default',
      },
    });
    assert.equal(clearKeywordsByOmitting.statusCode, 204);

    const storedCleared = app.deviceRepository.findDeviceByToken(TOKEN_A);
    assert.deepEqual(storedCleared.regionCodes, ['00000']);
    assert.equal(storedCleared.keywordFilterMode, 'none');
    assert.deepEqual(storedCleared.keywords, []);
    assert.equal(storedCleared.criticalVolume, null);

    const deleteExisting = await app.inject({
      method: 'DELETE',
      url: '/v1/devices',
      payload: { token: TOKEN_A },
    });
    assert.equal(deleteExisting.statusCode, 204);
    assert.equal(app.deviceRepository.findDeviceByToken(TOKEN_A), null);

    const deleteMissing = await app.inject({
      method: 'DELETE',
      url: '/v1/devices',
      payload: { token: TOKEN_A },
    });
    assert.equal(deleteMissing.statusCode, 204);
  });

  it('enforces the 8KB request body limit with 413 Payload Too Large', async () => {
    const { app } = await createTestServer();
    const oversizedPayload = JSON.stringify({
      token: TOKEN_A,
      regionCodes: ['11500'],
      alertMode: 'normal',
      soundName: 'default',
      keywordFilterMode: 'block',
      keywords: Array.from({ length: 32 }, (_, idx) => `키워드${idx}-${'가'.repeat(120)}`),
    });

    assert.ok(Buffer.byteLength(oversizedPayload, 'utf8') > 8192);

    const response = await app.inject({
      method: 'PUT',
      url: '/v1/devices',
      headers: {
        'content-type': 'application/json',
      },
      payload: oversizedPayload,
    });
    assert.equal(response.statusCode, 413);
  });

  it('enforces 60 req/min per client IP across device mutation endpoints using X-Forwarded-For when TRUST_PROXY=true', async () => {
    const { app } = await createTestServer();

    for (let count = 0; count < 40; count += 1) {
      const putRes = await app.inject({
        method: 'PUT',
        url: '/v1/devices',
        headers: { 'x-forwarded-for': '203.0.113.10' },
        payload: {
          token: TOKEN_A,
          regionCodes: ['11500'],
          alertMode: 'normal',
          soundName: 'default',
        },
      });
      assert.equal(putRes.statusCode, 204);
    }

    for (let count = 0; count < 20; count += 1) {
      const delRes = await app.inject({
        method: 'DELETE',
        url: '/v1/devices',
        headers: { 'x-forwarded-for': '203.0.113.10' },
        payload: { token: TOKEN_B },
      });
      assert.equal(delRes.statusCode, 204);
    }

    const sixtyFirstResponse = await app.inject({
      method: 'PUT',
      url: '/v1/devices',
      headers: { 'x-forwarded-for': '203.0.113.10' },
      payload: {
        token: TOKEN_A,
        regionCodes: ['11500'],
        alertMode: 'normal',
        soundName: 'default',
      },
    });
    assert.equal(sixtyFirstResponse.statusCode, 429);

    const differentIpResponse = await app.inject({
      method: 'PUT',
      url: '/v1/devices',
      headers: { 'x-forwarded-for': '203.0.113.11' },
      payload: {
        token: TOKEN_A,
        regionCodes: ['11500'],
        alertMode: 'normal',
        soundName: 'default',
      },
    });
    assert.equal(differentIpResponse.statusCode, 204);
  });

  it('handles POST /v1/devices/test (auth, keyword bypass, critical resolution, 404, 410 removal, 502, 503, 10/min rate limit)', async () => {
    const { app: appWithoutKey } = await createTestServer({
      envOverrides: { TEST_PUSH_API_KEY: '' },
    });
    const missingKeyResponse = await appWithoutKey.inject({
      method: 'POST',
      url: '/v1/devices/test',
      payload: { token: TOKEN_A },
    });
    assert.equal(missingKeyResponse.statusCode, 503);

    let simulatedOutcome = 'ok';
    const { app, recordedNotifications } = await createTestServer({
      apnsHandler: async () => {
        if (simulatedOutcome === 'unregistered') {
          return {
            ok: false,
            isInvalidToken: true,
            statusCode: 410,
            reason: 'Unregistered',
            apnsId: null,
          };
        }
        if (simulatedOutcome === 'apns_error') {
          return {
            ok: false,
            isInvalidToken: false,
            statusCode: 503,
            reason: 'ServiceUnavailable',
            apnsId: null,
          };
        }
        return {
          ok: true,
          isInvalidToken: false,
          statusCode: 200,
          reason: null,
          apnsId: 'apns-test-ok',
        };
      },
    });

    const unauthenticatedResponse = await app.inject({
      method: 'POST',
      url: '/v1/devices/test',
      payload: { token: TOKEN_A },
    });
    assert.equal(unauthenticatedResponse.statusCode, 401);

    const wrongKeyResponse = await app.inject({
      method: 'POST',
      url: '/v1/devices/test',
      headers: { authorization: 'Bearer wrong-token-value' },
      payload: { token: TOKEN_A },
    });
    assert.equal(wrongKeyResponse.statusCode, 401);

    const notFoundResponse = await app.inject({
      method: 'POST',
      url: '/v1/devices/test',
      headers: {
        authorization: `Bearer ${TEST_API_KEY}`,
        'x-forwarded-for': '198.51.100.1',
      },
      payload: { token: TOKEN_A },
    });
    assert.equal(notFoundResponse.statusCode, 404);

    await app.inject({
      method: 'PUT',
      url: '/v1/devices',
      payload: {
        token: TOKEN_A,
        environment: 'sandbox',
        regionCodes: ['11500'],
        alertMode: 'critical',
        soundName: 'warning.caf',
        criticalVolume: 0.9,
        keywordFilterMode: 'block',
        keywords: ['테스트'],
      },
    });

    const defaultTestPush = await app.inject({
      method: 'POST',
      url: '/v1/devices/test',
      headers: {
        authorization: `Bearer ${TEST_API_KEY}`,
        'x-forwarded-for': '198.51.100.2',
      },
      payload: { token: TOKEN_A },
    });
    assert.equal(defaultTestPush.statusCode, 200);
    assert.deepEqual(defaultTestPush.json(), {
      status: 'sent',
      environment: 'sandbox',
      alertMode: 'normal',
    });
    assert.equal(recordedNotifications.at(-1).payload.aps.sound, 'warning.caf');

    const criticalTestPush = await app.inject({
      method: 'POST',
      url: '/v1/devices/test',
      headers: {
        authorization: `Bearer ${TEST_API_KEY}`,
        'x-forwarded-for': '198.51.100.2',
      },
      payload: {
        token: TOKEN_A,
        title: '[긴급재난] 테스트 경보',
        body: 'Critical Alert 동작 확인',
      },
    });
    assert.equal(criticalTestPush.statusCode, 200);
    assert.deepEqual(criticalTestPush.json(), {
      status: 'sent',
      environment: 'sandbox',
      alertMode: 'critical',
    });
    assert.deepEqual(recordedNotifications.at(-1).payload.aps.sound, {
      critical: 1,
      name: 'warning.caf',
      volume: 0.9,
    });

    simulatedOutcome = 'apns_error';
    const upstreamFailure = await app.inject({
      method: 'POST',
      url: '/v1/devices/test',
      headers: {
        authorization: `Bearer ${TEST_API_KEY}`,
        'x-forwarded-for': '198.51.100.2',
      },
      payload: { token: TOKEN_A },
    });
    assert.equal(upstreamFailure.statusCode, 502);
    assert.notEqual(app.deviceRepository.findDeviceByToken(TOKEN_A), null);

    simulatedOutcome = 'unregistered';
    const invalidTokenResponse = await app.inject({
      method: 'POST',
      url: '/v1/devices/test',
      headers: {
        authorization: `Bearer ${TEST_API_KEY}`,
        'x-forwarded-for': '198.51.100.2',
      },
      payload: { token: TOKEN_A },
    });
    assert.equal(invalidTokenResponse.statusCode, 410);
    assert.equal(app.deviceRepository.findDeviceByToken(TOKEN_A), null);

    simulatedOutcome = 'ok';
    for (let attempt = 0; attempt < 10; attempt += 1) {
      const allowedAttempt = await app.inject({
        method: 'POST',
        url: '/v1/devices/test',
        headers: {
          authorization: `Bearer ${TEST_API_KEY}`,
          'x-forwarded-for': '198.51.100.99',
        },
        payload: { token: TOKEN_B },
      });
      assert.equal(allowedAttempt.statusCode, 404);
    }

    const eleventhAttempt = await app.inject({
      method: 'POST',
      url: '/v1/devices/test',
      headers: {
        authorization: `Bearer ${TEST_API_KEY}`,
        'x-forwarded-for': '198.51.100.99',
      },
      payload: { token: TOKEN_B },
    });
    assert.equal(eleventhAttempt.statusCode, 429);
  });
});
