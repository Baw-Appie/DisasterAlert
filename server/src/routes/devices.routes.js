import rateLimit from '@fastify/rate-limit';

const MUTATION_RATE_LIMIT_MAX = 60;
const TEST_PUSH_RATE_LIMIT_MAX = 10;
const ONE_MINUTE_MS = 60_000;

export async function registerDeviceRoutes(
  fastify,
  {
    devicesController,
    mutationRateLimitMax = MUTATION_RATE_LIMIT_MAX,
    testPushRateLimitMax = TEST_PUSH_RATE_LIMIT_MAX,
    rateLimitWindowMs = ONE_MINUTE_MS,
  },
) {
  await fastify.register(async function deviceMutationRoutes(mutationScope) {
    await mutationScope.register(rateLimit, {
      global: true,
      max: mutationRateLimitMax,
      timeWindow: rateLimitWindowMs,
      keyGenerator: (request) => request.ip,
    });

    mutationScope.put('/v1/devices', (request, reply) =>
      devicesController.registerOrUpdateDevice(request, reply),
    );

    mutationScope.delete('/v1/devices', (request, reply) =>
      devicesController.unregisterDevice(request, reply),
    );
  });

  await fastify.register(async function deviceTestPushRoutes(testPushScope) {
    await testPushScope.register(rateLimit, {
      global: true,
      max: testPushRateLimitMax,
      timeWindow: rateLimitWindowMs,
      keyGenerator: (request) => request.ip,
    });

    testPushScope.post('/v1/devices/test', (request, reply) =>
      devicesController.sendTestPush(request, reply),
    );
  });
}
