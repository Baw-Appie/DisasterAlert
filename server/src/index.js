import { fileURLToPath } from 'node:url';
import { buildApp } from './app.js';
import { loadServerConfig } from './config/env.config.js';

export { buildApp } from './app.js';
export { loadServerConfig } from './config/env.config.js';

export async function startServer(rawEnv = process.env) {
  const config = loadServerConfig(rawEnv);
  const app = await buildApp({
    config,
    logger: true,
  });

  if (!config.apns) {
    app.log.warn(
      'APNs credentials (APNS_TEAM_ID, APNS_KEY_ID, APNS_TOPIC, APNS_PRIVATE_KEY_PATH) are not configured; APNs delivery is inactive.',
    );
  }

  let shuttingDown = false;
  const shutdownGracefully = async (signal) => {
    if (shuttingDown) {
      return;
    }
    shuttingDown = true;
    app.log.info({ signal }, 'Shutting down server');
    try {
      await app.close();
      process.exit(0);
    } catch (closeError) {
      app.log.error(closeError, 'Error while closing server');
      process.exit(1);
    }
  };

  process.on('SIGINT', () => shutdownGracefully('SIGINT'));
  process.on('SIGTERM', () => shutdownGracefully('SIGTERM'));

  try {
    await app.listen({
      host: config.host,
      port: config.port,
    });
  } catch (listenError) {
    app.log.error(listenError, 'Failed to start server');
    process.exit(1);
  }

  return app;
}

const isExecutedDirectly =
  process.argv[1] !== undefined && fileURLToPath(import.meta.url) === process.argv[1];

if (isExecutedDirectly) {
  startServer();
}
