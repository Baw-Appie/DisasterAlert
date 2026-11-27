const VALID_APNS_ENVIRONMENTS = new Set(['production', 'sandbox']);
const MIN_TEST_PUSH_API_KEY_LENGTH = 32;
const DEFAULT_HOST = '0.0.0.0';
const DEFAULT_PORT = 3000;
const DEFAULT_DATABASE_PATH = '/var/lib/DisasterAlert/devices.sqlite';
const DEFAULT_APNS_ENVIRONMENT = 'production';
const MAX_BODY_BYTES = 8 * 1024;

export class ConfigValidationError extends Error {
  constructor(message) {
    super(message);
    this.name = 'ConfigValidationError';
  }
}

function readOptionalNonEmpty(rawValue) {
  if (typeof rawValue !== 'string') {
    return null;
  }
  const trimmed = rawValue.trim();
  return trimmed.length > 0 ? trimmed : null;
}

function parsePort(rawPort) {
  const portText = readOptionalNonEmpty(rawPort);
  if (portText === null) {
    return DEFAULT_PORT;
  }
  if (!/^[0-9]+$/.test(portText)) {
    throw new ConfigValidationError(`Invalid PORT value: "${rawPort}"`);
  }
  const parsedPort = Number.parseInt(portText, 10);
  if (!Number.isInteger(parsedPort) || parsedPort < 1 || parsedPort > 65535) {
    throw new ConfigValidationError(`PORT must be between 1 and 65535, got: "${rawPort}"`);
  }
  return parsedPort;
}

function parseTrustProxy(rawTrustProxy) {
  if (typeof rawTrustProxy === 'boolean') {
    return rawTrustProxy;
  }
  const normalized = readOptionalNonEmpty(rawTrustProxy);
  if (normalized === null) {
    return false;
  }
  const lower = normalized.toLowerCase();
  if (lower === 'true' || lower === '1') {
    return true;
  }
  if (lower === 'false' || lower === '0') {
    return false;
  }
  throw new ConfigValidationError(
    `TRUST_PROXY must be "true" or "false" (or "1"/"0"), got: "${rawTrustProxy}"`,
  );
}

function parseApnsEnvironment(rawEnvironment) {
  const normalized = readOptionalNonEmpty(rawEnvironment) ?? DEFAULT_APNS_ENVIRONMENT;
  if (!VALID_APNS_ENVIRONMENTS.has(normalized)) {
    throw new ConfigValidationError(
      `APNS_ENVIRONMENT must be "production" or "sandbox", got: "${rawEnvironment}"`,
    );
  }
  return normalized;
}

function parseTestPushApiKey(rawApiKey) {
  const apiKey = readOptionalNonEmpty(rawApiKey);
  if (apiKey === null) {
    return null;
  }
  if (apiKey.length < MIN_TEST_PUSH_API_KEY_LENGTH) {
    throw new ConfigValidationError(
      `TEST_PUSH_API_KEY must be at least ${MIN_TEST_PUSH_API_KEY_LENGTH} characters when provided`,
    );
  }
  return apiKey;
}

function parseApnsCredentials(rawEnv, requireApns) {
  const teamId = readOptionalNonEmpty(rawEnv.APNS_TEAM_ID);
  const keyId = readOptionalNonEmpty(rawEnv.APNS_KEY_ID);
  const topic = readOptionalNonEmpty(rawEnv.APNS_TOPIC);
  const privateKeyPath = readOptionalNonEmpty(rawEnv.APNS_PRIVATE_KEY_PATH);

  const providedCount = [teamId, keyId, topic, privateKeyPath].filter(
    (value) => value !== null,
  ).length;

  if (providedCount === 0) {
    if (requireApns) {
      throw new ConfigValidationError(
        'APNS_TEAM_ID, APNS_KEY_ID, APNS_TOPIC, and APNS_PRIVATE_KEY_PATH are required',
      );
    }
    return null;
  }

  if (providedCount < 4) {
    throw new ConfigValidationError(
      'APNS_TEAM_ID, APNS_KEY_ID, APNS_TOPIC, and APNS_PRIVATE_KEY_PATH must all be set together',
    );
  }

  return {
    teamId,
    keyId,
    topic,
    privateKeyPath,
  };
}

export function loadServerConfig(rawEnv = process.env, options = {}) {
  const { requireApns = false } = options;

  const host = readOptionalNonEmpty(rawEnv.HOST) ?? DEFAULT_HOST;
  const port = parsePort(rawEnv.PORT);
  const databasePath = readOptionalNonEmpty(rawEnv.DATABASE_PATH) ?? DEFAULT_DATABASE_PATH;
  const trustProxy = parseTrustProxy(rawEnv.TRUST_PROXY);
  const apnsEnvironment = parseApnsEnvironment(rawEnv.APNS_ENVIRONMENT);
  const testPushApiKey = parseTestPushApiKey(rawEnv.TEST_PUSH_API_KEY);
  const apns = parseApnsCredentials(rawEnv, requireApns);

  return Object.freeze({
    host,
    port,
    databasePath,
    trustProxy,
    apnsEnvironment,
    testPushApiKey,
    apns,
    bodyLimitBytes: MAX_BODY_BYTES,
  });
}
