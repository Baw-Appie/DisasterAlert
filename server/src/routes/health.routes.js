export async function registerHealthRoutes(fastify, { deviceRepository }) {
  fastify.get('/health', async (_request, reply) => {
    const databaseAlive = deviceRepository.ping();
    if (!databaseAlive) {
      return reply.code(503).send({ status: 'unavailable' });
    }
    return reply.code(200).send({ status: 'ok' });
  });
}
