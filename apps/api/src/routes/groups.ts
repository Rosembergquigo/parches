import type { FastifyPluginAsync } from 'fastify';
import { prisma } from '../lib/prisma.js';
import { requireTournamentEditor } from '../lib/authz.js';

export const groupRoutes: FastifyPluginAsync = async (app) => {
  app.patch<{ Params: { id: string }; Body: Partial<{ label: string; order: number }> }>(
    '/:id',
    { onRequest: [app.authenticate] },
    async (req, reply) => {
      const existing = await prisma.group.findUnique({ where: { id: req.params.id } });
      if (!existing) return reply.status(404).send({ error: 'Not found' });
      const tournament = await prisma.tournament.findUnique({ where: { id: existing.tournamentId } });
      if (!tournament) return reply.status(404).send({ error: 'Not found' });
      if (!(await requireTournamentEditor(req, reply, tournament.organizationId))) return;
      try {
        const group = await prisma.group.update({ where: { id: req.params.id }, data: req.body });
        return reply.send(group);
      } catch {
        return reply.status(409).send({ error: 'A group with that label already exists in this tournament' });
      }
    }
  );

  // Borrar un grupo no borra sus equipos — solo los desvincula (groupId = null).
  app.delete<{ Params: { id: string } }>('/:id', { onRequest: [app.authenticate] }, async (req, reply) => {
    const existing = await prisma.group.findUnique({ where: { id: req.params.id } });
    if (!existing) return reply.status(404).send({ error: 'Not found' });
    const tournament = await prisma.tournament.findUnique({ where: { id: existing.tournamentId } });
    if (!tournament) return reply.status(404).send({ error: 'Not found' });
    if (!(await requireTournamentEditor(req, reply, tournament.organizationId))) return;
    await prisma.team.updateMany({ where: { groupId: req.params.id }, data: { groupId: null } });
    await prisma.group.delete({ where: { id: req.params.id } });
    return reply.status(204).send();
  });
};
