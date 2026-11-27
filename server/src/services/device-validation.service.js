const VALID_ENVIRONMENTS = new Set(['sandbox', 'production']);
const VALID_ALERT_MODES = new Set(['normal', 'critical']);
const VALID_KEYWORD_FILTER_MODES = new Set(['none', 'block', 'allow']);

const MIN_TOKEN_HEX_LENGTH = 64;
const MAX_TOKEN_HEX_LENGTH = 512;
const MIN_REGION_CODES = 1;
const MAX_REGION_CODES = 32;
const ALL_REGIONS_CODE = '00000';
const MAX_SOUND_NAME_LENGTH = 128;
const MIN_KEYWORDS = 1;
const MAX_KEYWORDS = 32;
const MIN_KEYWORD_LENGTH = 1;
const MAX_KEYWORD_LENGTH = 50;

export const DEFAULT_TEST_TITLE = '테스트 알림';
export const DEFAULT_TEST_BODY = 'APNs 연결을 확인합니다.';

export class ValidationError extends Error {
  constructor(message) {
    super(message);
    this.name = 'ValidationError';
    this.statusCode = 400;
  }
}

export function normalizeComparisonText(inputText) {
  return inputText.normalize('NFKC').toLowerCase();
}

function hasControlCharacters(text) {
  for (let index = 0; index < text.length; index += 1) {
    const charCode = text.charCodeAt(index);
    if (charCode <= 0x1f || charCode === 0x7f) {
      return true;
    }
  }
  return false;
}

export function validateDeviceToken(rawToken) {
  if (typeof rawToken !== 'string') {
    throw new ValidationError('token must be a hexadecimal string');
  }
  if (
    rawToken.length < MIN_TOKEN_HEX_LENGTH ||
    rawToken.length > MAX_TOKEN_HEX_LENGTH ||
    rawToken.length % 2 !== 0 ||
    !/^[0-9a-fA-F]+$/.test(rawToken)
  ) {
    throw new ValidationError(
      `token must be an even-length hexadecimal string between ${MIN_TOKEN_HEX_LENGTH} and ${MAX_TOKEN_HEX_LENGTH} characters`,
    );
  }
  return rawToken.toLowerCase();
}

export function validateEnvironment(rawEnvironment, defaultEnvironment) {
  if (rawEnvironment === undefined) {
    return defaultEnvironment;
  }
  if (typeof rawEnvironment !== 'string' || !VALID_ENVIRONMENTS.has(rawEnvironment)) {
    throw new ValidationError('environment must be "sandbox" or "production"');
  }
  return rawEnvironment;
}

export function validateRegionCodes(rawRegionCodes) {
  if (!Array.isArray(rawRegionCodes)) {
    throw new ValidationError('regionCodes must be an array');
  }
  if (rawRegionCodes.length < MIN_REGION_CODES || rawRegionCodes.length > MAX_REGION_CODES) {
    throw new ValidationError(
      `regionCodes must contain between ${MIN_REGION_CODES} and ${MAX_REGION_CODES} codes`,
    );
  }

  const seenCodes = new Set();
  for (const regionCode of rawRegionCodes) {
    if (typeof regionCode !== 'string' || !/^[0-9]{5}$/.test(regionCode)) {
      throw new ValidationError('Each regionCode must be a 5-digit numeric string');
    }
    if (seenCodes.has(regionCode)) {
      throw new ValidationError('regionCodes must not contain duplicates');
    }
    seenCodes.add(regionCode);
  }

  if (seenCodes.has(ALL_REGIONS_CODE) && seenCodes.size > 1) {
    throw new ValidationError('00000 represents all regions and cannot be combined with others');
  }

  return Array.from(seenCodes);
}

export function validateSoundName(rawSoundName) {
  if (typeof rawSoundName !== 'string') {
    throw new ValidationError('soundName must be a string');
  }
  if (
    rawSoundName.length < 1 ||
    rawSoundName.length > MAX_SOUND_NAME_LENGTH ||
    rawSoundName.trim() !== rawSoundName
  ) {
    throw new ValidationError(
      `soundName must be a non-empty string up to ${MAX_SOUND_NAME_LENGTH} characters without surrounding whitespace`,
    );
  }
  if (
    rawSoundName === '.' ||
    rawSoundName === '..' ||
    rawSoundName.includes('..') ||
    /[/\\:]/.test(rawSoundName) ||
    hasControlCharacters(rawSoundName)
  ) {
    throw new ValidationError('soundName must not contain path characters or control characters');
  }
  return rawSoundName;
}

export function validateAlertModeAndVolume(rawAlertMode, rawCriticalVolume) {
  if (typeof rawAlertMode !== 'string' || !VALID_ALERT_MODES.has(rawAlertMode)) {
    throw new ValidationError('alertMode must be "normal" or "critical"');
  }

  if (rawAlertMode === 'critical') {
    if (
      typeof rawCriticalVolume !== 'number' ||
      !Number.isFinite(rawCriticalVolume) ||
      rawCriticalVolume < 0 ||
      rawCriticalVolume > 1
    ) {
      throw new ValidationError(
        'criticalVolume is required for critical alertMode and must be between 0 and 1',
      );
    }
    return {
      alertMode: 'critical',
      criticalVolume: rawCriticalVolume,
    };
  }

  if (rawCriticalVolume !== undefined && rawCriticalVolume !== null) {
    if (
      typeof rawCriticalVolume !== 'number' ||
      !Number.isFinite(rawCriticalVolume) ||
      rawCriticalVolume < 0 ||
      rawCriticalVolume > 1
    ) {
      throw new ValidationError('criticalVolume must be between 0 and 1');
    }
  }

  return {
    alertMode: 'normal',
    criticalVolume: null,
  };
}

export function validateKeywordFilter(rawKeywordFilterMode, rawKeywords) {
  if (rawKeywordFilterMode === undefined) {
    if (rawKeywords === undefined || (Array.isArray(rawKeywords) && rawKeywords.length === 0)) {
      return {
        keywordFilterMode: 'none',
        keywords: [],
      };
    }
    throw new ValidationError('keywordFilterMode is required when keywords are provided');
  }

  if (
    typeof rawKeywordFilterMode !== 'string' ||
    !VALID_KEYWORD_FILTER_MODES.has(rawKeywordFilterMode)
  ) {
    throw new ValidationError('keywordFilterMode must be "none", "block", or "allow"');
  }

  if (rawKeywordFilterMode === 'none') {
    if (rawKeywords === undefined || (Array.isArray(rawKeywords) && rawKeywords.length === 0)) {
      return {
        keywordFilterMode: 'none',
        keywords: [],
      };
    }
    throw new ValidationError('keywords must be empty when keywordFilterMode is "none"');
  }

  if (!Array.isArray(rawKeywords)) {
    throw new ValidationError('keywords must be an array when keywordFilterMode is block or allow');
  }
  if (rawKeywords.length < MIN_KEYWORDS || rawKeywords.length > MAX_KEYWORDS) {
    throw new ValidationError(
      `keywords must contain between ${MIN_KEYWORDS} and ${MAX_KEYWORDS} items`,
    );
  }

  const normalizedSet = new Set();
  const validatedKeywords = [];

  for (const rawKeyword of rawKeywords) {
    if (typeof rawKeyword !== 'string') {
      throw new ValidationError('Each keyword must be a string');
    }

    const trimmedDisplayKeyword = rawKeyword.trim().normalize('NFC');
    const characterCount = Array.from(trimmedDisplayKeyword).length;
    if (characterCount < MIN_KEYWORD_LENGTH || characterCount > MAX_KEYWORD_LENGTH) {
      throw new ValidationError(
        `Each keyword must be between ${MIN_KEYWORD_LENGTH} and ${MAX_KEYWORD_LENGTH} characters after trimming`,
      );
    }

    const normalizedKeyword = normalizeComparisonText(trimmedDisplayKeyword);
    if (normalizedKeyword.length === 0) {
      throw new ValidationError('Keyword must not be empty');
    }
    if (normalizedSet.has(normalizedKeyword)) {
      throw new ValidationError(
        'keywords must not contain duplicates (case- and Unicode-insensitive)',
      );
    }

    normalizedSet.add(normalizedKeyword);
    validatedKeywords.push({
      keyword: trimmedDisplayKeyword,
      normalizedKeyword,
    });
  }

  return {
    keywordFilterMode: rawKeywordFilterMode,
    keywords: validatedKeywords,
  };
}

export function validateDeviceRegistrationPayload(rawPayload, defaultEnvironment) {
  if (rawPayload === null || typeof rawPayload !== 'object' || Array.isArray(rawPayload)) {
    throw new ValidationError('Request body must be a JSON object');
  }

  const allowedKeys = new Set([
    'token',
    'environment',
    'regionCodes',
    'alertMode',
    'soundName',
    'criticalVolume',
    'keywordFilterMode',
    'keywords',
  ]);
  for (const key of Object.keys(rawPayload)) {
    if (!allowedKeys.has(key)) {
      throw new ValidationError(`Unknown property "${key}"`);
    }
  }

  const token = validateDeviceToken(rawPayload.token);
  const environment = validateEnvironment(rawPayload.environment, defaultEnvironment);
  const regionCodes = validateRegionCodes(rawPayload.regionCodes);
  const soundName = validateSoundName(rawPayload.soundName);
  const { alertMode, criticalVolume } = validateAlertModeAndVolume(
    rawPayload.alertMode,
    rawPayload.criticalVolume,
  );
  const { keywordFilterMode, keywords } = validateKeywordFilter(
    rawPayload.keywordFilterMode,
    rawPayload.keywords,
  );

  return {
    token,
    environment,
    regionCodes,
    alertMode,
    soundName,
    criticalVolume,
    keywordFilterMode,
    keywords,
  };
}

export function validateDeviceDeletionPayload(rawPayload) {
  if (rawPayload === null || typeof rawPayload !== 'object' || Array.isArray(rawPayload)) {
    throw new ValidationError('Request body must be a JSON object');
  }

  const keys = Object.keys(rawPayload);
  for (const key of keys) {
    if (key !== 'token') {
      throw new ValidationError(`Unknown property "${key}"`);
    }
  }

  return {
    token: validateDeviceToken(rawPayload.token),
  };
}

export function validateTestPushPayload(rawPayload) {
  if (rawPayload === null || typeof rawPayload !== 'object' || Array.isArray(rawPayload)) {
    throw new ValidationError('Request body must be a JSON object');
  }

  const allowedKeys = new Set(['token', 'title', 'body']);
  for (const key of Object.keys(rawPayload)) {
    if (!allowedKeys.has(key)) {
      throw new ValidationError(`Unknown property "${key}"`);
    }
  }

  const token = validateDeviceToken(rawPayload.token);

  let title = DEFAULT_TEST_TITLE;
  if (rawPayload.title !== undefined) {
    if (
      typeof rawPayload.title !== 'string' ||
      rawPayload.title.trim().length === 0 ||
      rawPayload.title.length > 256
    ) {
      throw new ValidationError('title must be a non-empty string up to 256 characters');
    }
    title = rawPayload.title;
  }

  let body = DEFAULT_TEST_BODY;
  if (rawPayload.body !== undefined) {
    if (
      typeof rawPayload.body !== 'string' ||
      rawPayload.body.trim().length === 0 ||
      rawPayload.body.length > 2048
    ) {
      throw new ValidationError('body must be a non-empty string up to 2048 characters');
    }
    body = rawPayload.body;
  }

  return {
    token,
    title,
    body,
  };
}
