import { normalizeComparisonText, validateRegionCodes } from './device-validation.service.js';

const CRITICAL_TITLE_MARKER = '긴급재난'.normalize('NFKC');
const ALL_REGIONS_CODE = '00000';
const DEFAULT_BROADCAST_CONCURRENCY = 32;

export function resolveEffectiveAlertMode(deviceAlertMode, title) {
  if (deviceAlertMode !== 'critical') {
    return 'normal';
  }
  const normalizedTitle = title.normalize('NFKC');
  return normalizedTitle.includes(CRITICAL_TITLE_MARKER) ? 'critical' : 'normal';
}

export function shouldDeliverByKeywordFilter(device, title, body) {
  if (device.keywordFilterMode === 'none') {
    return true;
  }

  const normalizedTitle = normalizeComparisonText(title);
  const normalizedBody = normalizeComparisonText(body);

  const hasKeywordMatch = device.keywords.some(({ normalizedKeyword }) => {
    return (
      normalizedTitle.includes(normalizedKeyword) || normalizedBody.includes(normalizedKeyword)
    );
  });

  if (device.keywordFilterMode === 'block') {
    return !hasKeywordMatch;
  }
  if (device.keywordFilterMode === 'allow') {
    return hasKeywordMatch;
  }
  return true;
}

export function regionsOverlap(targetCode, subscribedCode) {
  if (targetCode === ALL_REGIONS_CODE || subscribedCode === ALL_REGIONS_CODE) {
    return true;
  }
  if (targetCode === subscribedCode) {
    return true;
  }
  const targetPrefix = targetCode.slice(0, 2);
  const subscribedPrefix = subscribedCode.slice(0, 2);
  if (targetPrefix !== subscribedPrefix) {
    return false;
  }
  return targetCode.endsWith('000') || subscribedCode.endsWith('000');
}

export function buildApnsNotificationPayload({ device, title, body, customPayload = null }) {
  const effectiveAlertMode = resolveEffectiveAlertMode(device.alertMode, title);

  const apsPayload =
    effectiveAlertMode === 'critical'
      ? {
          alert: { title, body },
          sound: {
            critical: 1,
            name: device.soundName,
            volume: device.criticalVolume,
          },
          'interruption-level': 'critical',
        }
      : {
          alert: { title, body },
          sound: device.soundName,
        };

  const payload =
    customPayload && typeof customPayload === 'object'
      ? {
          ...customPayload,
          aps: apsPayload,
        }
      : {
          aps: apsPayload,
        };

  return {
    effectiveAlertMode,
    payload,
  };
}

export class PushNotificationService {
  constructor({ deviceRepository, apnsClient }) {
    this.deviceRepository = deviceRepository;
    this.apnsClient = apnsClient;
  }

  async sendTestNotification({ token, title, body }) {
    const device = this.deviceRepository.findDeviceByToken(token);
    if (!device) {
      return {
        outcome: 'not_found',
      };
    }

    const { effectiveAlertMode, payload } = buildApnsNotificationPayload({
      device,
      title,
      body,
    });

    const deliveryResult = await this.apnsClient.sendNotification({
      token: device.token,
      environment: device.environment,
      payload,
    });

    if (deliveryResult.ok) {
      return {
        outcome: 'sent',
        environment: device.environment,
        alertMode: effectiveAlertMode,
      };
    }

    if (deliveryResult.isInvalidToken) {
      this.deviceRepository.deleteDeviceByToken(device.token);
      return {
        outcome: 'invalid_token',
        reason: deliveryResult.reason,
      };
    }

    return {
      outcome: 'apns_failed',
      statusCode: deliveryResult.statusCode,
      reason: deliveryResult.reason,
    };
  }

  async broadcastAlert({
    title,
    body,
    regionCodes,
    customPayload = null,
    concurrency = DEFAULT_BROADCAST_CONCURRENCY,
  }) {
    const validatedTargetRegions = validateRegionCodes(regionCodes);
    const candidateDevices = this.#findRegionMatchedDevices(validatedTargetRegions);

    const eligibleDevices = [];
    let filteredOutCount = 0;

    for (const device of candidateDevices) {
      if (shouldDeliverByKeywordFilter(device, title, body)) {
        eligibleDevices.push(device);
      } else {
        filteredOutCount += 1;
      }
    }

    let sentCount = 0;
    let invalidTokenRemovedCount = 0;
    let failedCount = 0;

    const workerCount = Math.max(1, Math.min(concurrency, eligibleDevices.length || 1));
    let nextIndex = 0;

    const runWorker = async () => {
      while (nextIndex < eligibleDevices.length) {
        const currentIndex = nextIndex;
        nextIndex += 1;
        const device = eligibleDevices[currentIndex];

        const { payload } = buildApnsNotificationPayload({
          device,
          title,
          body,
          customPayload,
        });

        const deliveryResult = await this.apnsClient.sendNotification({
          token: device.token,
          environment: device.environment,
          payload,
        });

        if (deliveryResult.ok) {
          sentCount += 1;
        } else if (deliveryResult.isInvalidToken) {
          this.deviceRepository.deleteDeviceByToken(device.token);
          invalidTokenRemovedCount += 1;
        } else {
          failedCount += 1;
        }
      }
    };

    if (eligibleDevices.length > 0) {
      await Promise.all(Array.from({ length: workerCount }, () => runWorker()));
    }

    return {
      matchedCount: candidateDevices.length,
      filteredOutCount,
      sentCount,
      invalidTokenRemovedCount,
      failedCount,
    };
  }

  #findRegionMatchedDevices(targetRegionCodes) {
    if (targetRegionCodes.includes(ALL_REGIONS_CODE)) {
      const allDevicesQuery = this.deviceRepository.database.prepare(
        'SELECT token FROM devices ORDER BY token ASC',
      );
      const tokenRows = allDevicesQuery.all();
      return tokenRows
        .map((row) => this.deviceRepository.findDeviceByToken(row.token))
        .filter((device) => device !== null);
    }

    const directLookupCodes = new Set([ALL_REGIONS_CODE]);
    const provincePrefixes = new Set();

    for (const targetCode of targetRegionCodes) {
      directLookupCodes.add(targetCode);
      directLookupCodes.add(`${targetCode.slice(0, 2)}000`);
      if (targetCode.endsWith('000')) {
        provincePrefixes.add(targetCode.slice(0, 2));
      }
    }

    const matchedDevicesByToken = new Map();
    for (const device of this.deviceRepository.findDevicesByRegionCodes(
      Array.from(directLookupCodes),
    )) {
      matchedDevicesByToken.set(device.token, device);
    }

    if (provincePrefixes.size > 0) {
      const prefixClauses = Array.from(provincePrefixes).map(() => 'region_code LIKE ?');
      const prefixArgs = Array.from(provincePrefixes).map((prefix) => `${prefix}%`);
      const prefixTokenRows = this.deviceRepository.database
        .prepare(
          `SELECT DISTINCT token FROM device_regions WHERE ${prefixClauses.join(' OR ')} ORDER BY token ASC`,
        )
        .all(...prefixArgs);

      for (const row of prefixTokenRows) {
        if (!matchedDevicesByToken.has(row.token)) {
          const hydratedDevice = this.deviceRepository.findDeviceByToken(row.token);
          if (hydratedDevice) {
            matchedDevicesByToken.set(hydratedDevice.token, hydratedDevice);
          }
        }
      }
    }

    return Array.from(matchedDevicesByToken.values()).filter((device) =>
      device.regionCodes.some((subscribedCode) =>
        targetRegionCodes.some((targetCode) => regionsOverlap(targetCode, subscribedCode)),
      ),
    );
  }
}
