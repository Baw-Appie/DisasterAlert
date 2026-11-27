import crypto from 'node:crypto';
import {
  validateDeviceDeletionPayload,
  validateDeviceRegistrationPayload,
  validateTestPushPayload,
} from '../services/device-validation.service.js';

function verifyBearerToken(authorizationHeader, expectedApiKey) {
  if (typeof authorizationHeader !== 'string') {
    return false;
  }

  const trimmedHeader = authorizationHeader.trim();
  const bearerMatch = /^Bearer\s+(.+)$/i.exec(trimmedHeader);
  if (!bearerMatch) {
    return false;
  }

  const providedKey = bearerMatch[1].trim();
  if (providedKey.length === 0) {
    return false;
  }

  const providedDigest = crypto.createHash('sha256').update(providedKey, 'utf8').digest();
  const expectedDigest = crypto.createHash('sha256').update(expectedApiKey, 'utf8').digest();
  return crypto.timingSafeEqual(providedDigest, expectedDigest);
}

export class DevicesController {
  constructor({ config, deviceRepository, pushNotificationService }) {
    this.config = config;
    this.deviceRepository = deviceRepository;
    this.pushNotificationService = pushNotificationService;
  }

  async registerOrUpdateDevice(request, reply) {
    const registration = validateDeviceRegistrationPayload(
      request.body,
      this.config.apnsEnvironment,
    );
    this.deviceRepository.upsertDevice(registration);
    return reply.code(204).send();
  }

  async unregisterDevice(request, reply) {
    const { token } = validateDeviceDeletionPayload(request.body);
    this.deviceRepository.deleteDeviceByToken(token);
    return reply.code(204).send();
  }

  async sendTestPush(request, reply) {
    if (!this.config.testPushApiKey) {
      return reply.code(503).send({
        error: 'Service Unavailable',
        message: 'TEST_PUSH_API_KEY is not configured',
      });
    }

    const isAuthorized = verifyBearerToken(
      request.headers.authorization,
      this.config.testPushApiKey,
    );
    if (!isAuthorized) {
      return reply.code(401).header('WWW-Authenticate', 'Bearer').send({
        error: 'Unauthorized',
        message: 'Invalid or missing Bearer token',
      });
    }

    const { token, title, body } = validateTestPushPayload(request.body);
    const dispatchResult = await this.pushNotificationService.sendTestNotification({
      token,
      title,
      body,
    });

    if (dispatchResult.outcome === 'sent') {
      return reply.code(200).send({
        status: 'sent',
        environment: dispatchResult.environment,
        alertMode: dispatchResult.alertMode,
      });
    }

    if (dispatchResult.outcome === 'not_found') {
      return reply.code(404).send({
        error: 'Not Found',
        message: 'Device token is not registered',
      });
    }

    if (dispatchResult.outcome === 'invalid_token') {
      return reply.code(410).send({
        error: 'Gone',
        message: 'Device token is invalid and has been removed',
      });
    }

    return reply.code(502).send({
      error: 'Bad Gateway',
      message: 'APNs delivery failed',
    });
  }
}
