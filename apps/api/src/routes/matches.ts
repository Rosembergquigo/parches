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
import {
  assertEligibleToScore,
  assertEventTypeForSport,
  cardDescription,
  goalDescription,
  isCardEvent,
  isJerseyNote,
  playerByJersey,
  pointsDescription,
  readOptionalJersey,
  readOwnGoal,
  readPoints,
  scoreDeltaForEvent,
  withPlayerNames,
} from '../lib/matchScore.js';
import { applyMatchEventStats } from '../lib/playerStats.js';
import { publishMatchLive, publishMatchStatus, publishScoreboard } from '../lib/live.js';
import {
  applyClockAction,
  clockLivePayload,
  formatFromTournament,
  freezeClock,
  resolveClock,
  type ClockAction,
} from '../lib/matchClock.js';

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
    const events = await withPlayerNames(match.events);
    const inPlay = match.status === 'LIVE' || match.status === 'HALFTIME';
    const clockFmt = { format: formatFromTournament(match.tournament), stage: match.stage };
    const clock = inPlay ? resolveClock(match.tournament.sport, match, Date.now(), clockFmt) : null;
    return reply.send({
      ...match,
      homeTeam,
      awayTeam,
      events,
      ...(clock ? {
        clock: clock.clock,
        period: clock.period,
        clockSeconds: clock.clockSeconds,
        clockRunning: clock.clockRunning,
        clockEpoch: clock.clockEpoch,
        periodIndex: clock.periodIndex,
      } : {}),
    });
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
    let frozenClock: ReturnType<typeof freezeClock> | null = null;
    if (body.status === 'SCHEDULED' && existing.status !== 'SCHEDULED') {
      data.clockElapsed = 0;
      data.clockRunning = false;
      data.clockEpoch = null;
      data.periodIndex = 1;
      data.clock = null;
      data.period = null;
      data.startedAt = null;
    }
    if (body.status === 'HALFTIME' || body.status === 'FINISHED') {
      frozenClock = freezeClock(existing.tournament.sport, existing, new Date(), {
        format: formatFromTournament(existing.tournament),
        stage: existing.stage,
      });
      data.clockElapsed = frozenClock.clockElapsed;
      data.clockRunning = false;
      data.clockEpoch = null;
      data.clock = frozenClock.clock;
      data.period = frozenClock.period;
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
    const nextPublishedStatus = body.status ?? existing.status;
    if (frozenClock) {
      const payload = clockLivePayload(existing.tournament.sport, {
        ...existing,
        ...frozenClock,
        status: nextPublishedStatus,
      }, {
        homeScore: match.homeScore,
        awayScore: match.awayScore,
        status: nextPublishedStatus,
      }, {
        format: formatFromTournament(existing.tournament),
        stage: existing.stage,
      });
      await publishScoreboard(match.id, payload);
    }
    if (body.status && body.status !== existing.status) {
      await publishMatchStatus(match.id, {
        status: body.status,
        clockRunning: body.status === 'LIVE',
      });
    }
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
    return reply.send(await withPlayerNames(events));
  });

  app.post<{
    Params: { id: string };
    Body: {
      type: string;
      clock?: string;
      teamId?: string;
      playerId?: string;
      description?: string;
      payload?: Prisma.InputJsonValue;
      refereeId?: string;
      scorerJersey?: number | string;
      assistJersey?: number | string;
      ownGoalJersey?: number | string;
      ownGoal?: boolean | string;
      jersey?: number | string;
      points?: number | string;
    };
  }>('/:id/events', { onRequest: [app.authenticate] }, async (req, reply) => {
    const match = await prisma.match.findUnique({
      where: { id: req.params.id },
      include: { tournament: true, homeTeam: true, awayTeam: true },
    });
    if (!match) return reply.status(404).send({ error: 'Not found' });
    const userId = userIdFrom(req);
    const isReferee = match.refereeId === userId;
    if (!isReferee && !(await requireTournamentEditor(req, reply, match.tournament.organizationId))) return;

    const body = req.body ?? {};
    const type = typeof body.type === 'string' ? body.type.trim() : '';
    if (!type) return reply.status(400).send({ error: 'El tipo de evento es obligatorio' });
    assertEventTypeForSport(match.tournament.sport, type);
    const liveClock = resolveClock(match.tournament.sport, match, Date.now(), {
      format: formatFromTournament(match.tournament),
      stage: match.stage,
    });
    const clock = (typeof body.clock === 'string' && body.clock.trim())
      || liveClock.clock
      || "0'";
    const teamId = typeof body.teamId === 'string' ? body.teamId.trim() : undefined;
    const ownGoalJersey = readOptionalJersey(body.ownGoalJersey);
    const ownGoal = readOwnGoal(body.ownGoal) || ownGoalJersey != null;
    const scorerJersey = ownGoalJersey ?? readOptionalJersey(body.scorerJersey);
    const assistJersey = readOptionalJersey(body.assistJersey);
    const jersey = readOptionalJersey(body.jersey);
    const points = type === 'score_update' ? readPoints(body.points) : undefined;

    if (isJerseyNote(type) && !teamId) {
      return reply.status(400).send({
        error: isCardEvent(type) ? 'La tarjeta necesita un equipo' : 'El evento necesita un equipo',
      });
    }
    if (type === 'custom') {
      const note = typeof body.description === 'string' ? body.description.trim() : '';
      if (!note) return reply.status(400).send({ error: 'La novedad necesita una descripción' });
    }

    if (type === 'goal' && ownGoal && assistJersey != null) {
      return reply.status(400).send({ error: 'La asistencia no aplica en gol en contra' });
    }
    if (type === 'goal' && ownGoalJersey != null && body.scorerJersey != null && String(body.scorerJersey).trim() !== '') {
      return reply.status(400).send({ error: 'Usa anotador o en contra, no ambos' });
    }

    const delta = scoreDeltaForEvent({
      type,
      sport: match.tournament.sport,
      teamId,
      ownGoal: type === 'goal' ? ownGoal : false,
      points,
      homeTeamId: match.homeTeamId,
      awayTeamId: match.awayTeamId,
      status: match.status,
    });

    const event = await prisma.$transaction(async tx => {
      let playerId = typeof body.playerId === 'string' && body.playerId.trim()
        ? body.playerId.trim()
        : undefined;
      let playerName: string | undefined;
      let assistPlayerId: string | undefined;
      let assistPlayerName: string | undefined;
      const teamLabel = teamId === match.homeTeamId
        ? match.homeTeam.shortName
        : teamId === match.awayTeamId
          ? match.awayTeam.shortName
          : undefined;

      if (type === 'goal' && teamId && scorerJersey != null) {
        const scorer = await playerByJersey(tx, {
          teamId,
          tournamentId: match.tournamentId,
          jersey: scorerJersey,
          teamLabel,
        });
        playerId = scorer.playerProfileId;
        playerName = scorer.name;
      }
      if (type === 'goal' && teamId && assistJersey != null) {
        const assist = await playerByJersey(tx, {
          teamId,
          tournamentId: match.tournamentId,
          jersey: assistJersey,
          teamLabel,
        });
        assistPlayerId = assist.playerProfileId;
        assistPlayerName = assist.name;
      }
      if (isJerseyNote(type) && teamId && jersey != null) {
        const booked = await playerByJersey(tx, {
          teamId,
          tournamentId: match.tournamentId,
          jersey,
          teamLabel,
        });
        playerId = booked.playerProfileId;
      }
      if (type === 'score_update' && teamId && jersey != null) {
        const scorer = await playerByJersey(tx, {
          teamId,
          tournamentId: match.tournamentId,
          jersey,
          teamLabel,
        });
        playerId = scorer.playerProfileId;
        playerName = scorer.name;
      }

      if (type === 'goal' || type === 'score_update') {
        if (playerId) {
          await assertEligibleToScore(tx, {
            matchId: match.id,
            playerProfileId: playerId,
            name: playerName,
          });
        }
        if (assistPlayerId) {
          await assertEligibleToScore(tx, {
            matchId: match.id,
            playerProfileId: assistPlayerId,
            name: assistPlayerName,
          });
        }
      }

      const autoDesc = type === 'goal'
        ? goalDescription({ ownGoal, scorerJersey, assistJersey })
        : isJerseyNote(type)
          ? cardDescription(type, jersey)
          : type === 'score_update' && points != null
            ? pointsDescription({ sport: match.tournament.sport, points, jersey })
            : undefined;
      const description = (typeof body.description === 'string' && body.description.trim())
        || autoDesc;

      const payload: Prisma.InputJsonValue = {
        ...(body.payload && typeof body.payload === 'object' && !Array.isArray(body.payload)
          ? body.payload as Record<string, unknown>
          : {}),
        ...(ownGoal ? { ownGoal: true } : {}),
        ...(scorerJersey != null ? { scorerJersey } : {}),
        ...(assistJersey != null ? { assistJersey } : {}),
        ...(assistPlayerId ? { assistPlayerId } : {}),
        ...(jersey != null ? { jersey } : {}),
        ...(points != null ? { points } : {}),
      };

      const created = await tx.matchEvent.create({
        data: {
          matchId: match.id,
          type,
          clock,
          teamId: teamId || null,
          playerId,
          description,
          payload: Object.keys(payload).length > 0 ? payload : undefined,
          refereeId: userId,
        },
      });
      if (delta) {
        await tx.match.update({
          where: { id: match.id },
          data: {
            homeScore: { increment: delta.home },
            awayScore: { increment: delta.away },
          },
        });
      }
      await applyMatchEventStats(tx, {
        type,
        matchId: match.id,
        tournamentId: match.tournamentId,
        teamId,
        playerId,
        assistPlayerId,
        ownGoal: type === 'goal' ? ownGoal : false,
        points,
      });
      return created;
    });

    const score = delta
      ? await prisma.match.findUnique({
          where: { id: match.id },
          select: { homeScore: true, awayScore: true },
        })
      : null;

    const [named] = await withPlayerNames([event]);
    await publishMatchLive({
      matchId: match.id,
      event: named,
      score: score ? { homeScore: score.homeScore, awayScore: score.awayScore } : null,
      clock: liveClock.clock,
      period: liveClock.period,
      clockSeconds: liveClock.clockSeconds,
      clockRunning: liveClock.clockRunning,
      clockEpoch: liveClock.clockEpoch ? liveClock.clockEpoch.toISOString() : null,
      periodIndex: liveClock.periodIndex,
    });
    return reply.status(201).send({
      ...named,
      ...(score ? { homeScore: score.homeScore, awayScore: score.awayScore } : {}),
    });
  });

  app.post<{ Params: { id: string }; Body: { action?: string } }>(
    '/:id/clock',
    { onRequest: [app.authenticate] },
    async (req, reply) => {
      const match = await prisma.match.findUnique({
        where: { id: req.params.id },
        include: { tournament: true },
      });
      if (!match) return reply.status(404).send({ error: 'Not found' });
      const userId = userIdFrom(req);
      const isReferee = match.refereeId === userId;
      if (!isReferee && !(await requireTournamentEditor(req, reply, match.tournament.organizationId))) return;

      const action = typeof req.body?.action === 'string' ? req.body.action.trim() : '';
      if (action !== 'start' && action !== 'pause' && action !== 'next') {
        return reply.status(400).send({ error: 'Indica start, pause o next' });
      }

      const clockFmt = {
        format: formatFromTournament(match.tournament),
        stage: match.stage,
      };
      const applied = applyClockAction({
        sport: match.tournament.sport,
        action: action as ClockAction,
        row: match,
        homeScore: match.homeScore,
        awayScore: match.awayScore,
        ...clockFmt,
      });

      const updated = await prisma.$transaction(async tx => {
        const next = await tx.match.update({
          where: { id: match.id },
          data: applied.data,
        });
        const events: { id: string; type: string; clock: string; createdAt: Date; description: string | null }[] = [];
        if (applied.periodEnd) {
          const ended = resolveClock(match.tournament.sport, match, Date.now(), clockFmt);
          events.push(await tx.matchEvent.create({
            data: {
              matchId: match.id,
              type: 'period_end',
              clock: ended.clock,
              description: ended.period,
              refereeId: userId,
            },
            select: { id: true, type: true, clock: true, createdAt: true, description: true },
          }));
        }
        if (applied.periodStart) {
          events.push(await tx.matchEvent.create({
            data: {
              matchId: match.id,
              type: 'period_start',
              clock: applied.data.clock,
              description: applied.data.period,
              refereeId: userId,
            },
            select: { id: true, type: true, clock: true, createdAt: true, description: true },
          }));
        }
        return { next, events };
      });

      const payload = clockLivePayload(match.tournament.sport, updated.next, {
        homeScore: updated.next.homeScore,
        awayScore: updated.next.awayScore,
      }, clockFmt);
      await publishScoreboard(match.id, payload);
      for (const ev of updated.events) {
        await publishMatchLive({
          matchId: match.id,
          event: { ...ev, teamId: null, playerName: null },
        });
      }

      return reply.send(payload);
    }
  );
};
