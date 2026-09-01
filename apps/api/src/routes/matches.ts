import type { FastifyPluginAsync } from 'fastify';
import type { MatchStatus, Prisma } from '@prisma/client';
import { prisma } from '../lib/prisma.js';
import { requireTournamentEditor, userIdFrom } from '../lib/authz.js';

export const matchRoutes: FastifyPluginAsync = async (app) => {
  app.get<{ Params: { id: string } }>('/:id', async (req, reply) => {
    const match = await prisma.match.findUnique({
      where: { id: req.params.id },
      include: {
        homeTeam: true,
        awayTeam: true,
        tournament: true,
        events: { orderBy: { createdAt: 'desc' }, take: 20 },
      },
    });
    if (!match) return reply.status(404).send({ error: 'Not found' });
    return reply.send(match);
  });

  app.patch<{
    Params: { id: string };
    Body: {
      homeScore?: number;
      awayScore?: number;
      status?: MatchStatus;
      clock?: string;
      period?: string;
      venue?: string;
      scheduledAt?: string;
      startedAt?: string;
      stats?: Prisma.InputJsonValue;
    };
  }>('/:id', { onRequest: [app.authenticate] }, async (req, reply) => {
    const existing = await prisma.match.findUnique({
      where: { id: req.params.id },
      include: { tournament: true },
    });
    if (!existing) return reply.status(404).send({ error: 'Not found' });
    const userId = userIdFrom(req);
    const isReferee = existing.refereeId === userId;
    if (!isReferee && !(await requireTournamentEditor(req, reply, existing.tournament.organizationId))) return;
    const match = await prisma.match.update({
      where: { id: req.params.id },
      data: req.body,
      include: { homeTeam: true, awayTeam: true },
    });
    return reply.send(match);
  });

  app.delete<{ Params: { id: string } }>('/:id', { onRequest: [app.authenticate] }, async (req, reply) => {
    const existing = await prisma.match.findUnique({
      where: { id: req.params.id },
      include: { tournament: true },
    });
    if (!existing) return reply.status(404).send({ error: 'Not found' });
    if (!(await requireTournamentEditor(req, reply, existing.tournament.organizationId))) return;
    await prisma.matchEvent.deleteMany({ where: { matchId: req.params.id } });
    await prisma.match.delete({ where: { id: req.params.id } });
    return reply.status(204).send();
  });

  // ── Match events (bitácora del árbitro / relator) ────────────
  app.get<{ Params: { id: string } }>('/:id/events', async (req, reply) => {
    const events = await prisma.matchEvent.findMany({
      where: { matchId: req.params.id },
      orderBy: { createdAt: 'desc' },
    });
    return reply.send(events);
  });

  app.post<{
    Params: { id: string };
    Body: {
      type: string;
      clock: string;
      teamId?: string;
      playerId?: string;
      description?: string;
      payload?: Prisma.InputJsonValue;
      refereeId?: string;
    };
  }>('/:id/events', { onRequest: [app.authenticate] }, async (req, reply) => {
    const match = await prisma.match.findUnique({
      where: { id: req.params.id },
      include: { tournament: true },
    });
    if (!match) return reply.status(404).send({ error: 'Not found' });
    const userId = userIdFrom(req);
    const isReferee = match.refereeId === userId;
    if (!isReferee && !(await requireTournamentEditor(req, reply, match.tournament.organizationId))) return;
    const data: Prisma.MatchEventUncheckedCreateInput = { ...req.body, matchId: match.id };
    const event = await prisma.matchEvent.create({ data });
    return reply.status(201).send(event);
  });
};
