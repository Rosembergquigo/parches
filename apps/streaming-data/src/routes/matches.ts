import type { FastifyPluginAsync } from 'fastify';
import type { RefereeEvent } from '@parches/types';
import { broadcastEvent } from '../ws/handler.js';

export const matchRoutes: FastifyPluginAsync = async (app) => {
  app.post<{ Params: { matchId: string }; Body: RefereeEvent }>(
    '/:matchId/events',
    async (req, reply) => { broadcastEvent(req.params.matchId, req.body); return reply.status(202).send({ ok: true }); }
  );
  app.get<{ Params: { matchId: string } }>(
    '/:matchId',
    async (req, reply) => reply.send({ id: req.params.matchId })
  );
};
