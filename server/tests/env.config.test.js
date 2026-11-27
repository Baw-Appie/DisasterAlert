import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { ConfigValidationError, loadServerConfig } from '../src/config/env.config.js';

describe('loadServerConfig', () => {
  it('parses the full production environment variable set', () => {
    const config = loadServerConfig({
      APNS_TEAM_ID: 'YOUR_TEAM_ID',
      APNS_KEY_ID: 'YOUR_KEY_ID',
      APNS_TOPIC: 'com.example.app',
      APNS_PRIVATE_KEY_PATH: '/run/secrets/AuthKey_YOUR_KEY_ID.p8',
      APNS_ENVIRONMENT: 'production',
      HOST: '0.0.0.0',
      PORT: '3000',
      DATABASE_PATH: '/var/lib/DisasterAlert/devices.sqlite',
      TRUST_PROXY: 'true',
      TEST_PUSH_API_KEY: 'REPLACE_WITH_AT_LEAST_32_RANDOM_CHARACTERS',
    });

    assert.deepEqual(config, {
      host: '0.0.0.0',
      port: 3000,
      databasePath: '/var/lib/DisasterAlert/devices.sqlite',
      trustProxy: true,
      apnsEnvironment: 'production',
      testPushApiKey: 'REPLACE_WITH_AT_LEAST_32_RANDOM_CHARACTERS',
      apns: {
        teamId: 'YOUR_TEAM_ID',
        keyId: 'YOUR_KEY_ID',
        topic: 'com.example.app',
        privateKeyPath: '/run/secrets/AuthKey_YOUR_KEY_ID.p8',
      },
      bodyLimitBytes: 8192,
    });
  });

  it('applies sensible defaults when optional variables are omitted', () => {
    const config = loadServerConfig({});
    assert.equal(config.host, '0.0.0.0');
    assert.equal(config.port, 3000);
    assert.equal(config.databasePath, '/var/lib/DisasterAlert/devices.sqlite');
    assert.equal(config.trustProxy, false);
    assert.equal(config.apnsEnvironment, 'production');
    assert.equal(config.testPushApiKey, null);
    assert.equal(config.apns, null);
    assert.equal(config.bodyLimitBytes, 8192);
  });

  it('rejects partial APNs configuration, short TEST_PUSH_API_KEY, and invalid values', () => {
    assert.throws(() => loadServerConfig({ APNS_TEAM_ID: 'TEAM123456' }), ConfigValidationError);
    assert.throws(() => loadServerConfig({}, { requireApns: true }), ConfigValidationError);
    assert.throws(
      () => loadServerConfig({ TEST_PUSH_API_KEY: 'too-short-key' }),
      ConfigValidationError,
    );
    assert.throws(() => loadServerConfig({ APNS_ENVIRONMENT: 'staging' }), ConfigValidationError);
    assert.throws(() => loadServerConfig({ PORT: '70000' }), ConfigValidationError);
    assert.throws(() => loadServerConfig({ TRUST_PROXY: 'maybe' }), ConfigValidationError);
  });
});
