import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  ValidationError,
  validateDeviceRegistrationPayload,
} from '../src/services/device-validation.service.js';

const SAMPLE_TOKEN = '0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef';

describe('validateDeviceRegistrationPayload', () => {
  it('validates normal registration and defaults environment when omitted', () => {
    const validated = validateDeviceRegistrationPayload(
      {
        token: SAMPLE_TOKEN.toUpperCase(),
        regionCodes: ['11500'],
        alertMode: 'normal',
        soundName: 'default',
      },
      'production',
    );

    assert.equal(validated.token, SAMPLE_TOKEN);
    assert.equal(validated.environment, 'production');
    assert.deepEqual(validated.regionCodes, ['11500']);
    assert.equal(validated.alertMode, 'normal');
    assert.equal(validated.soundName, 'default');
    assert.equal(validated.criticalVolume, null);
    assert.equal(validated.keywordFilterMode, 'none');
    assert.deepEqual(validated.keywords, []);
  });

  it('validates critical registration with criticalVolume boundaries 0 and 1', () => {
    const validatedZero = validateDeviceRegistrationPayload(
      {
        token: SAMPLE_TOKEN,
        environment: 'sandbox',
        regionCodes: ['11500', '11680'],
        alertMode: 'critical',
        soundName: 'warning.caf',
        criticalVolume: 0,
      },
      'production',
    );
    assert.equal(validatedZero.criticalVolume, 0);

    const validatedOne = validateDeviceRegistrationPayload(
      {
        token: SAMPLE_TOKEN,
        environment: 'production',
        regionCodes: ['11500', '11680'],
        alertMode: 'critical',
        soundName: 'warning.caf',
        criticalVolume: 1,
      },
      'production',
    );
    assert.equal(validatedOne.criticalVolume, 1);

    assert.throws(
      () =>
        validateDeviceRegistrationPayload(
          {
            token: SAMPLE_TOKEN,
            regionCodes: ['11500'],
            alertMode: 'critical',
            soundName: 'warning.caf',
          },
          'production',
        ),
      ValidationError,
    );

    assert.throws(
      () =>
        validateDeviceRegistrationPayload(
          {
            token: SAMPLE_TOKEN,
            regionCodes: ['11500'],
            alertMode: 'critical',
            soundName: 'warning.caf',
            criticalVolume: 1.01,
          },
          'production',
        ),
      ValidationError,
    );
  });

  it('enforces regionCodes constraints (5-digit, 1..32, unique, 00000 exclusive)', () => {
    const wildcard = validateDeviceRegistrationPayload(
      {
        token: SAMPLE_TOKEN,
        regionCodes: ['00000'],
        alertMode: 'normal',
        soundName: 'default',
      },
      'production',
    );
    assert.deepEqual(wildcard.regionCodes, ['00000']);

    assert.throws(
      () =>
        validateDeviceRegistrationPayload(
          {
            token: SAMPLE_TOKEN,
            regionCodes: ['00000', '11500'],
            alertMode: 'normal',
            soundName: 'default',
          },
          'production',
        ),
      ValidationError,
    );

    assert.throws(
      () =>
        validateDeviceRegistrationPayload(
          {
            token: SAMPLE_TOKEN,
            regionCodes: ['11500', '11500'],
            alertMode: 'normal',
            soundName: 'default',
          },
          'production',
        ),
      ValidationError,
    );

    const thirtyThreeCodes = Array.from({ length: 33 }, (_, idx) =>
      String(10001 + idx).padStart(5, '0'),
    );
    assert.throws(
      () =>
        validateDeviceRegistrationPayload(
          {
            token: SAMPLE_TOKEN,
            regionCodes: thirtyThreeCodes,
            alertMode: 'normal',
            soundName: 'default',
          },
          'production',
        ),
      ValidationError,
    );
  });

  it('rejects path characters and traversal sequences in soundName', () => {
    for (const invalidSound of [
      '../warning.caf',
      'sounds/warning.caf',
      'sounds\\warning.caf',
      '.',
      '..',
      'sound:warning.caf',
      ' warning.caf',
      '',
    ]) {
      assert.throws(
        () =>
          validateDeviceRegistrationPayload(
            {
              token: SAMPLE_TOKEN,
              regionCodes: ['11500'],
              alertMode: 'normal',
              soundName: invalidSound,
            },
            'production',
          ),
        ValidationError,
      );
    }
  });

  it('normalizes keywords and rejects case- or Unicode-equivalent duplicates', () => {
    const validFilter = validateDeviceRegistrationPayload(
      {
        token: SAMPLE_TOKEN,
        regionCodes: ['00000'],
        alertMode: 'normal',
        soundName: 'default',
        keywordFilterMode: 'block',
        keywords: ['  훈련  ', '테스트'],
      },
      'production',
    );
    assert.equal(validFilter.keywordFilterMode, 'block');
    assert.deepEqual(validFilter.keywords, [
      { keyword: '훈련', normalizedKeyword: '훈련' },
      { keyword: '테스트', normalizedKeyword: '테스트' },
    ]);

    const clearedFilter = validateDeviceRegistrationPayload(
      {
        token: SAMPLE_TOKEN,
        regionCodes: ['00000'],
        alertMode: 'normal',
        soundName: 'default',
        keywordFilterMode: 'none',
        keywords: [],
      },
      'production',
    );
    assert.equal(clearedFilter.keywordFilterMode, 'none');
    assert.deepEqual(clearedFilter.keywords, []);

    assert.throws(
      () =>
        validateDeviceRegistrationPayload(
          {
            token: SAMPLE_TOKEN,
            regionCodes: ['00000'],
            alertMode: 'normal',
            soundName: 'default',
            keywordFilterMode: 'allow',
            keywords: ['Emergency', 'emergency'],
          },
          'production',
        ),
      ValidationError,
    );

    const nfcTraining = '훈련'.normalize('NFC');
    const nfdTraining = '훈련'.normalize('NFD');
    assert.throws(
      () =>
        validateDeviceRegistrationPayload(
          {
            token: SAMPLE_TOKEN,
            regionCodes: ['00000'],
            alertMode: 'normal',
            soundName: 'default',
            keywordFilterMode: 'block',
            keywords: [nfcTraining, nfdTraining],
          },
          'production',
        ),
      ValidationError,
    );

    assert.throws(
      () =>
        validateDeviceRegistrationPayload(
          {
            token: SAMPLE_TOKEN,
            regionCodes: ['00000'],
            alertMode: 'normal',
            soundName: 'default',
            keywordFilterMode: 'block',
            keywords: ['가'.repeat(51)],
          },
          'production',
        ),
      ValidationError,
    );
  });
});
