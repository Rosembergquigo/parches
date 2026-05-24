import type { FastifyPluginAsync } from 'fastify';
export const tournamentRoutes: FastifyPluginAsync = async (app) => {
  app.get('/', async (_, reply) => reply.send([]));
};
