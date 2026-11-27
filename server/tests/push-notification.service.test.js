import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { DeviceRepository } from '../src/db/device.repository.js';
import { openSqliteDatabase } from '../src/db/sqlite.connection.js';
import { validateDeviceRegistrationPayload } from '../src/services/device-validation.service.js';
import { PushNotificationService } from '../src/services/push-notification.service.js';

function makeToken(seedNumber) {
  return String(seedNumber).padStart(64, '0');
}

describe('PushNotificationService', () => {
  it('filters by region (00000, province, district) and keywords (block/allow), resolves Critical Alerts, and prunes invalid tokens', async () => {
    const database = openSqliteDatabase(':memory:');
    const repository = new DeviceRepository(database);

    const tokenSandboxCritical = makeToken(1);
    const tokenProdNormal = makeToken(2);
    const tokenBlockedByKeyword = makeToken(3);
    const tokenAllowedByKeyword = makeToken(4);
    const tokenAllowedUnmatched = makeToken(5);
    const tokenOtherRegion = makeToken(6);
    const tokenInvalidDead = makeToken(7);

    repository.upsertDevice(
      validateDeviceRegistrationPayload(
        {
          token: tokenSandboxCritical,
          environment: 'sandbox',
          regionCodes: ['11500'],
          alertMode: 'critical',
          soundName: 'warning.caf',
          criticalVolume: 0.85,
        },
        'production',
      ),
    );

    repository.upsertDevice(
      validateDeviceRegistrationPayload(
        {
          token: tokenProdNormal,
          environment: 'production',
          regionCodes: ['11000'],
          alertMode: 'normal',
          soundName: 'default',
        },
        'production',
      ),
    );

    repository.upsertDevice(
      validateDeviceRegistrationPayload(
        {
          token: tokenBlockedByKeyword,
          environment: 'production',
          regionCodes: ['00000'],
          alertMode: 'normal',
          soundName: 'default',
          keywordFilterMode: 'block',
          keywords: ['훈련', 'test'],
        },
        'production',
      ),
    );

    repository.upsertDevice(
      validateDeviceRegistrationPayload(
        {
          token: tokenAllowedByKeyword,
          environment: 'production',
          regionCodes: ['00000'],
          alertMode: 'critical',
          soundName: 'siren.caf',
          criticalVolume: 1,
          keywordFilterMode: 'allow',
          keywords: ['호우'],
        },
        'production',
      ),
    );

    repository.upsertDevice(
      validateDeviceRegistrationPayload(
        {
          token: tokenAllowedUnmatched,
          environment: 'production',
          regionCodes: ['11500'],
          alertMode: 'normal',
          soundName: 'default',
          keywordFilterMode: 'allow',
          keywords: ['지진'],
        },
        'production',
      ),
    );

    repository.upsertDevice(
      validateDeviceRegistrationPayload(
        {
          token: tokenOtherRegion,
          environment: 'production',
          regionCodes: ['26440'],
          alertMode: 'normal',
          soundName: 'default',
        },
        'production',
      ),
    );

    repository.upsertDevice(
      validateDeviceRegistrationPayload(
        {
          token: tokenInvalidDead,
          environment: 'sandbox',
          regionCodes: ['11500'],
          alertMode: 'normal',
          soundName: 'default',
        },
        'production',
      ),
    );

    const dispatchedCalls = [];
    const fakeApnsClient = {
      async sendNotification(callArgs) {
        dispatchedCalls.push(callArgs);
        if (callArgs.token === tokenInvalidDead) {
          return {
            ok: false,
            isInvalidToken: true,
            statusCode: 410,
            reason: 'Unregistered',
            apnsId: null,
          };
        }
        return {
          ok: true,
          isInvalidToken: false,
          statusCode: 200,
          reason: null,
          apnsId: 'mock-id',
        };
      },
    };

    const service = new PushNotificationService({
      deviceRepository: repository,
      apnsClient: fakeApnsClient,
    });

    const nfdTrainingWord = '훈련'.normalize('NFD');
    const summary = await service.broadcastAlert({
      title: '[긴급재난] 서울 강서구 호우 경보',
      body: `저지대 침수 주의 (${nfdTrainingWord} 아님 안내 TESt 표기 포함)`,
      regionCodes: ['11500'],
    });

    assert.equal(summary.matchedCount, 6);
    assert.equal(summary.filteredOutCount, 2);
    assert.equal(summary.sentCount, 3);
    assert.equal(summary.invalidTokenRemovedCount, 1);
    assert.equal(summary.failedCount, 0);

    const sentByToken = new Map(dispatchedCalls.map((entry) => [entry.token, entry]));
    assert.equal(sentByToken.has(tokenBlockedByKeyword), false);
    assert.equal(sentByToken.has(tokenAllowedUnmatched), false);
    assert.equal(sentByToken.has(tokenOtherRegion), false);

    const sandboxCriticalCall = sentByToken.get(tokenSandboxCritical);
    assert.equal(sandboxCriticalCall.environment, 'sandbox');
    assert.deepEqual(sandboxCriticalCall.payload.aps.sound, {
      critical: 1,
      name: 'warning.caf',
      volume: 0.85,
    });

    const prodNormalCall = sentByToken.get(tokenProdNormal);
    assert.equal(prodNormalCall.environment, 'production');
    assert.equal(prodNormalCall.payload.aps.sound, 'default');

    assert.equal(repository.findDeviceByToken(tokenInvalidDead), null);

    dispatchedCalls.length = 0;
    await service.broadcastAlert({
      title: '[안전안내] 서울 강서구 도로 통제 안내',
      body: '우회 도로를 이용해 주세요.',
      regionCodes: ['11500'],
    });

    const downgradedCriticalCall = dispatchedCalls.find(
      (entry) => entry.token === tokenSandboxCritical,
    );
    assert.equal(downgradedCriticalCall.payload.aps.sound, 'warning.caf');

    database.close();
  });
});
