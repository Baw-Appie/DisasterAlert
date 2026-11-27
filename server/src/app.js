import Fastify from 'fastify';
import { ApnsJwtSigner } from './clients/apns-jwt.signer.js';
import { ApnsClient } from './clients/apns.client.js';
import { loadServerConfig } from './config/env.config.js';
import { DevicesController } from './controllers/devices.controller.js';
import { DeviceRepository } from './db/device.repository.js';
import { openSqliteDatabase } from './db/sqlite.connection.js';
import { registerDeviceRoutes } from './routes/devices.routes.js';
import { registerHealthRoutes } from './routes/health.routes.js';
import { ValidationError } from './services/device-validation.service.js';
import { PushNotificationService } from './services/push-notification.service.js';

export async function buildApp({
  config = loadServerConfig(),
  database = null,
  apnsClient = null,
  logger = false,
  rateLimitOptions = {},
} = {}) {
  const ownsDatabase = database === null;
  const sqliteDatabase = database ?? openSqliteDatabase(config.databasePath);
  const deviceRepository = new DeviceRepository(sqliteDatabase);

  let resolvedApnsClient = apnsClient;
  if (!resolvedApnsClient) {
    if (config.apns) {
      const jwtSigner = ApnsJwtSigner.fromKeyFile({
        teamId: config.apns.teamId,
        keyId: config.apns.keyId,
        privateKeyPath: config.apns.privateKeyPath,
      });
      resolvedApnsClient = new ApnsClient({
        topic: config.apns.topic,
        jwtSigner,
      });
    } else {
      resolvedApnsClient = new ApnsClient();
    }
  }

  const pushNotificationService = new PushNotificationService({
    deviceRepository,
    apnsClient: resolvedApnsClient,
  });

  const devicesController = new DevicesController({
    config,
    deviceRepository,
    pushNotificationService,
  });

  const app = Fastify({
    logger,
    trustProxy: config.trustProxy,
    bodyLimit: config.bodyLimitBytes,
  });

  app.decorate('deviceRepository', deviceRepository);
  app.decorate('pushNotificationService', pushNotificationService);
  app.decorate('apnsClient', resolvedApnsClient);

  app.setErrorHandler((error, request, reply) => {
    if (error instanceof ValidationError) {
      return reply.code(400).send({
        error: 'Bad Request',
        message: error.message,
      });
    }

    if (error.statusCode === 413) {
      return reply.code(413).send({
        error: 'Payload Too Large',
        message: 'Request body must not exceed 8KB',
      });
    }

    if (error.statusCode === 429) {
      return reply.code(429).send({
        error: 'Too Many Requests',
        message: error.message,
      });
    }

    if (typeof error.statusCode === 'number' && error.statusCode >= 400 && error.statusCode < 500) {
      return reply.code(error.statusCode).send({
        error: error.name || 'Client Error',
        message: error.message,
      });
    }

    request.log.error(error);
    return reply.code(500).send({
      error: 'Internal Server Error',
      message: 'Unexpected server error',
    });
  });

  await registerHealthRoutes(app, { deviceRepository });
  await registerDeviceRoutes(app, {
    devicesController,
    ...rateLimitOptions,
  });

  app.addHook('onClose', async () => {
    await resolvedApnsClient.close();
    if (ownsDatabase && sqliteDatabase.isOpen !== false) {
      try {
        sqliteDatabase.close();
      } catch {
        // Ignore if database was already closed.
      }
    }
  });

  return app;
}
