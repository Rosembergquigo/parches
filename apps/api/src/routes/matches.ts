import type { FastifyPluginAsync } from 'fastify';
import type { MatchStatus, Prisma } from '@prisma/client';
import { prisma } from '../lib/prisma.js';
import { requireTournamentEditor, userIdFrom } from '../lib/authz.js';
import { withPlayerPhotos } from '../lib/playerPhoto.js';
import {
  kickoffRemindedValue,
  notifyMatchKickoff,
  sameMinute,
} from '../lib/notify.js';

export const matchRoutes: FastifyPluginAsync = async (app) => {
  app.get<{ Params: { id: string } }>('/:id', async (req, reply) => {
    const match = await prisma.match.findUnique({
      where: { id: req.params.id },
      include: {
        homeTeam: true,
        awayTeam: true,
        tournament: true,
        referee: { select: { id: true, name: true } },
        events: { orderBy: { createdAt: 'desc' }, take: 20 },
      },
    });
    if (!match) return reply.status(404).send({ error: 'Not found' });
    const [homeTeam, awayTeam] = await withPlayerPhotos(match.tournament.sport, [match.homeTeam, match.awayTeam]);
    return reply.send({ ...match, homeTeam, awayTeam });
  });

  app.patch<{
    Params: { id: string };
    Body: {
      homeScore?: number;
      awayScore?: number;
      status?: MatchStatus;
      clock?: string;
      period?: string;
      venue?: string | null;
      stage?: string | null;
      refereeId?: string | null;
      scheduledAt?: string | null;
      startedAt?: string | null;
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

    const body = req.body ?? {};
    const data: Prisma.MatchUpdateInput = {};
    if (body.homeScore !== undefined) data.homeScore = Number(body.homeScore);
    if (body.awayScore !== undefined) data.awayScore = Number(body.awayScore);
    if (body.status !== undefined) data.status = body.status;
    if (body.clock !== undefined) data.clock = body.clock || null;
    if (body.period !== undefined) data.period = body.period || null;
    if (body.venue !== undefined) data.venue = body.venue?.trim() || null;
    if (body.stage !== undefined) data.stage = body.stage?.trim() || null;
    if (body.refereeId !== undefined) {
      const refereeId = body.refereeId?.trim() || null;
      if (!refereeId) {
        data.referee = { disconnect: true };
      } else {
        const referee = await prisma.user.findFirst({ where: { id: refereeId, role: 'REFEREE' } });
        if (!referee && existing.refereeId !== refereeId) {
          return reply.status(400).send({ error: 'refereeId is not a referee' });
        }
        data.referee = { connect: { id: refereeId } };
      }
    }
    if (body.scheduledAt !== undefined) {
      data.scheduledAt = body.scheduledAt ? new Date(body.scheduledAt) : null;
    }
    if (body.startedAt !== undefined) {
      data.startedAt = body.startedAt ? new Date(body.startedAt) : null;
    }
    if (body.stats !== undefined) data.stats = body.stats;
    if (body.status === 'LIVE' && !existing.startedAt && data.startedAt === undefined) {
      data.startedAt = new Date();
    }

    const nextStatus = body.status ?? existing.status;
    const nextKickoff = body.scheduledAt !== undefined
      ? (body.scheduledAt ? new Date(body.scheduledAt) : null)
      : undefined;
    let kickoffKind: 'scheduled' | 'rescheduled' | null = null;
    if (nextKickoff !== undefined) {
      if (!nextKickoff) {
        data.kickoffRemindedAt = null;
      } else if (
        nextStatus === 'SCHEDULED'
        && !sameMinute(existing.scheduledAt, nextKickoff)
      ) {
        kickoffKind = existing.scheduledAt ? 'rescheduled' : 'scheduled';
        data.kickoffRemindedAt = kickoffRemindedValue(nextKickoff);
      }
    }

    const match = await prisma.match.update({
      where: { id: req.params.id },
      data,
      include: { homeTeam: true, awayTeam: true, referee: { select: { id: true, name: true } } },
    });
    if (kickoffKind) notifyMatchKickoff(match.id, kickoffKind);
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
