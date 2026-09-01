import type { FastifyPluginAsync } from 'fastify';
import type { Prisma } from '@prisma/client';
import { prisma } from '../lib/prisma.js';
import { generateUniqueTournamentSlug, tournamentWhere } from '../lib/slug.js';
import { requireTournamentEditor } from '../lib/authz.js';
import { dateForRound, planFixture } from '../lib/fixture.js';
import {
  computeStandings,
  computeCompiledQualifiers,
  computeCrossmatches,
  computeCleanSheets,
  type QualifierRow,
  type Crossmatch,
} from '../lib/standings.js';

/** Iniciales para el avatar placeholder ("Danilo Torres" → "DT"). */
function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return '?';
  if (parts.length === 1) return parts[0]!.slice(0, 2).toUpperCase();
  return (parts[0]![0]! + parts[parts.length - 1]![0]!).toUpperCase();
}

interface PlayerStatRow {
  position: number;
  playerName: string;
  playerShortName: string;
  userId?: string;
  team: { id: string; name: string; shortName: string };
  statValue: number;
  statLabel?: string;
}

interface PlayerStatTab {
  id: string;
  tabLabel: string;
  colHeader: string;
  rows: PlayerStatRow[];
}

type EnrollmentWithStats = Prisma.PlayerEnrollmentGetPayload<{
  include: { team: true; playerProfile: { include: { user: true } }; tournamentStats: true };
}>;

/** Un tab de leaderboard = un campo numérico de PlayerTournamentStat.stats a rankear. */
interface LeaderboardDef {
  id: string;
  tabLabel: string;
  colHeader: string;
  statKey: string;
}

/**
 * Tabs de "Estadísticas" por deporte — todas rankean un campo de
 * PlayerTournamentStat.stats (JSON libre, ver prisma/schema.prisma).
 * Fútbol además agrega "Valla menos vencida" aparte (ver más abajo),
 * porque esa se calcula de los marcadores, no de stats de jugador.
 */
const SPORT_LEADERBOARDS: Record<string, LeaderboardDef[]> = {
  football: [{ id: 'scorers', tabLabel: 'Goleadores', colHeader: 'Goles', statKey: 'goals' }],
  basketball: [
    { id: 'scorers', tabLabel: 'Anotadores', colHeader: 'Pts', statKey: 'points' },
    { id: 'rebounders', tabLabel: 'Reboteadores', colHeader: 'Reb', statKey: 'rebounds' },
    { id: 'assists', tabLabel: 'Asistencias', colHeader: 'Ast', statKey: 'assists' },
  ],
  volleyball: [
    { id: 'scorers', tabLabel: 'Anotadores', colHeader: 'Pts', statKey: 'points' },
    { id: 'acers', tabLabel: 'Aces', colHeader: 'Aces', statKey: 'aces' },
  ],
};

/** Rankea las inscripciones por `def.statKey` — genérico para cualquier deporte/stat. */
function buildLeaderboardTab(enrollments: EnrollmentWithStats[], def: LeaderboardDef): PlayerStatTab | null {
  const rows = enrollments
    .map(e => ({
      e,
      value: Number((e.tournamentStats?.stats as Record<string, unknown> | undefined)?.[def.statKey] ?? 0),
      matchesPlayed: e.tournamentStats?.matchesPlayed ?? 0,
    }))
    .filter(x => x.value > 0)
    .sort((a, b) => b.value - a.value)
    .map((x, i): PlayerStatRow => ({
      position: i + 1,
      playerName: x.e.playerProfile.user.name,
      playerShortName: initials(x.e.playerProfile.user.name),
      userId: x.e.playerProfile.user.id,
      team: { id: x.e.team.id, name: x.e.team.name, shortName: x.e.team.shortName },
      statValue: x.value,
      statLabel: `${x.matchesPlayed} partido${x.matchesPlayed === 1 ? '' : 's'}`,
    }));

  return rows.length > 0 ? { id: def.id, tabLabel: def.tabLabel, colHeader: def.colHeader, rows } : null;
}

export const tournamentRoutes: FastifyPluginAsync = async (app) => {
  app.get('/', async (_req, reply) => {
    const tournaments = await prisma.tournament.findMany({
      include: {
        organization: { select: { id: true, slug: true, name: true, logoUrl: true, brandColor: true } },
        teams: true,
        matches: {
          include: { homeTeam: true, awayTeam: true },
          orderBy: [{ status: 'asc' }, { scheduledAt: 'asc' }, { createdAt: 'desc' }],
          take: 6,
        },
      },
      orderBy: { startDate: 'desc' },
    });
    return reply.send(tournaments);
  });

  // :idOrSlug acepta el uuid del torneo o su slug ("liga-betplay-2025").
  app.get<{ Params: { idOrSlug: string } }>('/:idOrSlug', async (req, reply) => {
    const tournament = await prisma.tournament.findFirst({
      where: tournamentWhere(req.params.idOrSlug),
      include: {
        organization: { select: { id: true, slug: true, name: true, logoUrl: true, brandColor: true } },
        teams: { include: { group: true } },
        groups: { orderBy: { order: 'asc' } },
        matches: { include: { homeTeam: true, awayTeam: true }, orderBy: { createdAt: 'asc' } },
      },
    });
    if (!tournament) return reply.status(404).send({ error: 'Not found' });
    return reply.send(tournament);
  });

  app.post<{
    Body: {
      organizationId: string;
      name: string;
      sport: string;
      startDate: string;
      endDate: string;
      brandColor?: string;
      logoUrl?: string;
      backgroundImageUrl?: string;
      description?: string;
      hasPlayoffs?: boolean;
      qualifyingSpots?: number;
    };
  }>('/', { onRequest: [app.authenticate] }, async (req, reply) => {
    if (!req.body?.organizationId) {
      return reply.status(400).send({ error: 'organizationId is required' });
    }
    const org = await prisma.organization.findUnique({ where: { id: req.body.organizationId } });
    if (!org) return reply.status(404).send({ error: 'Organization not found' });
    if (!(await requireTournamentEditor(req, reply, org.id))) return;

    const slug = await generateUniqueTournamentSlug(req.body.name);
    const { organizationId, ...rest } = req.body;
    const tournament = await prisma.tournament.create({
      data: { ...rest, slug, organizationId },
    });
    return reply.status(201).send(tournament);
  });

  app.patch<{
    Params: { idOrSlug: string };
    Body: Partial<{
      name: string;
      sport: string;
      status: 'UPCOMING' | 'LIVE' | 'FINISHED';
      startDate: string;
      endDate: string;
      brandColor: string;
      logoUrl: string;
      backgroundImageUrl: string;
      description: string;
      hasPlayoffs: boolean;
      qualifyingSpots: number;
    }>;
  }>('/:idOrSlug', { onRequest: [app.authenticate] }, async (req, reply) => {
    const existing = await prisma.tournament.findFirst({ where: tournamentWhere(req.params.idOrSlug) });
    if (!existing) return reply.status(404).send({ error: 'Not found' });
    if (!(await requireTournamentEditor(req, reply, existing.organizationId))) return;
    const tournament = await prisma.tournament.update({ where: { id: existing.id }, data: req.body });
    return reply.send(tournament);
  });

  app.delete<{ Params: { idOrSlug: string } }>('/:idOrSlug', { onRequest: [app.authenticate] }, async (req, reply) => {
    const existing = await prisma.tournament.findFirst({ where: tournamentWhere(req.params.idOrSlug) });
    if (!existing) return reply.status(404).send({ error: 'Not found' });
    if (!(await requireTournamentEditor(req, reply, existing.organizationId))) return;
    try {
      await prisma.match.deleteMany({ where: { tournamentId: existing.id } });
      await prisma.team.deleteMany({ where: { tournamentId: existing.id } });
      await prisma.group.deleteMany({ where: { tournamentId: existing.id } });
      await prisma.tournament.delete({ where: { id: existing.id } });
    } catch {
      return reply.status(409).send({ error: 'Could not delete tournament (referenced by other records)' });
    }
    return reply.status(204).send();
  });

  // ── Nested: Teams ────────────────────────────────────────────
  app.post<{
    Params: { idOrSlug: string };
    Body: { name: string; shortName: string; color?: string; logoUrl?: string; groupId?: string };
  }>('/:idOrSlug/teams', { onRequest: [app.authenticate] }, async (req, reply) => {
    const tournament = await prisma.tournament.findFirst({ where: tournamentWhere(req.params.idOrSlug) });
    if (!tournament) return reply.status(404).send({ error: 'Not found' });
    if (!(await requireTournamentEditor(req, reply, tournament.organizationId))) return;
    const team = await prisma.team.create({
      data: { ...req.body, tournamentId: tournament.id },
    });
    return reply.status(201).send(team);
  });

  app.get<{ Params: { idOrSlug: string } }>('/:idOrSlug/teams', async (req, reply) => {
    const tournament = await prisma.tournament.findFirst({ where: tournamentWhere(req.params.idOrSlug) });
    if (!tournament) return reply.status(404).send({ error: 'Not found' });
    const teams = await prisma.team.findMany({
      where: { tournamentId: tournament.id },
      include: { group: true },
      orderBy: { name: 'asc' },
    });
    return reply.send(teams);
  });

  // ── Nested: Groups ───────────────────────────────────────────
  app.post<{ Params: { idOrSlug: string }; Body: { label: string; order?: number } }>(
    '/:idOrSlug/groups',
    { onRequest: [app.authenticate] },
    async (req, reply) => {
      const tournament = await prisma.tournament.findFirst({ where: tournamentWhere(req.params.idOrSlug) });
      if (!tournament) return reply.status(404).send({ error: 'Not found' });
      if (!(await requireTournamentEditor(req, reply, tournament.organizationId))) return;
      try {
        const group = await prisma.group.create({
          data: { label: req.body.label, order: req.body.order ?? 0, tournamentId: tournament.id },
        });
        return reply.status(201).send(group);
      } catch {
        return reply.status(409).send({ error: 'A group with that label already exists in this tournament' });
      }
    }
  );

  // ── Nested: Matches (partido regular, fuera de cruces) ────────
  app.post<{
    Params: { idOrSlug: string };
    Body: {
      homeTeamId: string;
      awayTeamId: string;
      scheduledAt?: string;
      venue?: string;
      stage?: string;
    };
  }>('/:idOrSlug/matches', { onRequest: [app.authenticate] }, async (req, reply) => {
    const tournament = await prisma.tournament.findFirst({ where: tournamentWhere(req.params.idOrSlug) });
    if (!tournament) return reply.status(404).send({ error: 'Not found' });
    if (!(await requireTournamentEditor(req, reply, tournament.organizationId))) return;
    if (req.body.homeTeamId === req.body.awayTeamId) {
      return reply.status(400).send({ error: 'homeTeamId and awayTeamId must differ' });
    }
    const match = await prisma.match.create({
      data: { ...req.body, tournamentId: tournament.id, status: 'SCHEDULED' },
      include: { homeTeam: true, awayTeam: true },
    });
    return reply.status(201).send(match);
  });

  /**
   * GET /api/tournaments/:idOrSlug/standings
   *
   * Tabla de posiciones calculada al vuelo desde los Match FINISHED
   * (no se persiste — así una corrección de marcador se refleja al
   * instante). Si el torneo tiene Group rows, devuelve una tabla por
   * grupo; si no, una sola tabla con todos los equipos.
   *
   * Cuando `hasPlayoffs` + `qualifyingSpots` están configurados y hay
   * más de un grupo, además incluye `compiled` (tabla compilada de
   * clasificados) y `crossmatches` (cruces sugeridos: 1° vs último,
   * 2° vs penúltimo... con bye al equipo del medio si el total es impar).
   */
  app.get<{ Params: { idOrSlug: string } }>('/:idOrSlug/standings', async (req, reply) => {
    const tournament = await prisma.tournament.findFirst({
      where: tournamentWhere(req.params.idOrSlug),
      include: {
        groups: { orderBy: { order: 'asc' }, include: { teams: true } },
        teams: true,
        matches: true,
      },
    });
    if (!tournament) return reply.status(404).send({ error: 'Not found' });

    const groupBuckets = tournament.groups.length > 0
      ? tournament.groups.map(g => ({ id: g.id, label: g.label, teams: g.teams }))
      : [{ id: 'all', label: 'Tabla de posiciones', teams: tournament.teams }];

    const groups = groupBuckets.map(g => ({
      id: g.id,
      label: g.label,
      standings: computeStandings(g.teams, tournament.matches),
    }));

    const response: {
      groups: typeof groups;
      compiled?: QualifierRow[];
      crossmatches?: Crossmatch[];
    } = { groups };

    if (tournament.hasPlayoffs && tournament.qualifyingSpots && groups.length > 1) {
      const compiled = computeCompiledQualifiers(groups, tournament.qualifyingSpots);
      response.compiled = compiled;
      response.crossmatches = computeCrossmatches(compiled);
    }

    return reply.send(response);
  });

  /**
   * GET /api/tournaments/:idOrSlug/player-stats
   *
   * Tabs de estadísticas de jugadores calculadas al vuelo (igual que
   * /standings, no se persisten). Los tabs de ranking (goleadores,
   * anotadores, reboteadores...) salen de SPORT_LEADERBOARDS y rankean
   * un campo de PlayerTournamentStat.stats — agregar un deporte nuevo
   * es solo agregar una entrada ahí.
   *
   * Fútbol además suma "Valla menos vencida": partidos FINISHED sin
   * recibir gol, por equipo (no requiere un arquero inscrito — se
   * calcula desde los marcadores, igual que la tabla de posiciones).
   *
   * Devuelve `[]` si el deporte no tiene leaderboards definidos o no
   * hay datos suficientes, así el frontend simplemente no muestra la
   * pestaña "Estadísticas".
   */
  app.get<{ Params: { idOrSlug: string } }>('/:idOrSlug/player-stats', async (req, reply) => {
    const tournament = await prisma.tournament.findFirst({
      where: tournamentWhere(req.params.idOrSlug),
      include: { teams: true, matches: true },
    });
    if (!tournament) return reply.status(404).send({ error: 'Not found' });

    const tabs: PlayerStatTab[] = [];

    const leaderboardDefs = SPORT_LEADERBOARDS[tournament.sport];
    if (leaderboardDefs?.length) {
      const enrollments = await prisma.playerEnrollment.findMany({
        where: { tournamentId: tournament.id, isActive: true },
        include: { team: true, playerProfile: { include: { user: true } }, tournamentStats: true },
      });

      for (const def of leaderboardDefs) {
        const tab = buildLeaderboardTab(enrollments, def);
        if (tab) tabs.push(tab);
      }
    }

    if (tournament.sport === 'football') {
      const cleanSheets = computeCleanSheets(tournament.teams, tournament.matches)
        .filter(row => row.played > 0)
        .map((row, i): PlayerStatRow => ({
          position: i + 1,
          playerName: row.team.name,
          playerShortName: row.team.shortName,
          team: { id: row.team.id, name: row.team.name, shortName: row.team.shortName },
          statValue: row.cleanSheets,
          statLabel: `${row.goalsAgainst} gol${row.goalsAgainst === 1 ? '' : 'es'} en contra`,
        }));

      if (cleanSheets.length > 0) {
        tabs.push({ id: 'cleansheets', tabLabel: 'Valla menos vencida', colHeader: 'Vallas', rows: cleanSheets });
      }
    }

    return reply.send(tabs);
  });

  /**
   * POST /api/tournaments/:idOrSlug/fixture/generate
   *
   * Arma el todos-contra-todos (liga o por grupo) como Match SCHEDULED
   * con stage="Jornada N". Las fechas se reparte entre startDate y
   * endDate del torneo.
   *
   * Si ya hay partidos de liga (no cruces) → 409, salvo `{ force: true }`
   * y que ninguno esté LIVE/FINISHED — en ese caso se reemplazan los
   * SCHEDULED.
   */
  app.post<{
    Params: { idOrSlug: string };
    Body: {
      doubleRound?: boolean;
      venue?: string;
      kickoff?: string;
      force?: boolean;
    };
  }>('/:idOrSlug/fixture/generate', { onRequest: [app.authenticate] }, async (req, reply) => {
    const tournament = await prisma.tournament.findFirst({
      where: tournamentWhere(req.params.idOrSlug),
      include: {
        groups: { orderBy: { order: 'asc' }, include: { teams: true } },
        teams: true,
      },
    });
    if (!tournament) return reply.status(404).send({ error: 'Not found' });
    if (!(await requireTournamentEditor(req, reply, tournament.organizationId))) return;

    const kickoff = req.body?.kickoff && /^\d{1,2}:\d{2}$/.test(req.body.kickoff)
      ? req.body.kickoff
      : '15:00';
    const doubleRound = !!req.body?.doubleRound;
    const venue = req.body?.venue?.trim() || undefined;

    const buckets = tournament.groups.length > 0
      ? tournament.groups.map(g => ({ teamIds: g.teams.map(t => t.id) }))
      : [{ teamIds: tournament.teams.map(t => t.id) }];

    const planned = planFixture(buckets, doubleRound);
    if (planned.length === 0) {
      return reply.status(400).send({ error: 'Need at least 2 teams (per group, if grouped) to generate a fixture' });
    }

    const played = await prisma.match.count({
      where: {
        tournamentId: tournament.id,
        status: { in: ['LIVE', 'HALFTIME', 'FINISHED'] },
        NOT: { stage: 'Cruces' },
      },
    });
    if (played > 0) {
      return reply.status(409).send({ error: 'Cannot regenerate fixture: some matches have already been played' });
    }

    const existing = await prisma.match.count({
      where: { tournamentId: tournament.id, NOT: { stage: 'Cruces' } },
    });
    if (existing > 0 && !req.body?.force) {
      return reply.status(409).send({
        error: 'Fixture already generated for this tournament. Pass { force: true } to replace scheduled matches.',
      });
    }
    if (existing > 0 && req.body?.force) {
      await prisma.match.deleteMany({
        where: { tournamentId: tournament.id, status: 'SCHEDULED', NOT: { stage: 'Cruces' } },
      });
    }

    const roundCount = planned.reduce((max, m) => Math.max(max, m.round), 1);
    await prisma.match.createMany({
      data: planned.map(m => ({
        tournamentId: tournament.id,
        homeTeamId: m.homeTeamId,
        awayTeamId: m.awayTeamId,
        status: 'SCHEDULED' as const,
        stage: m.stage,
        venue,
        scheduledAt: dateForRound(m.round, roundCount, tournament.startDate, tournament.endDate, kickoff),
      })),
    });

    return reply.status(201).send({
      count: planned.length,
      rounds: roundCount,
      doubleRound,
    });
  });

  /**
   * POST /api/tournaments/:idOrSlug/crossmatches/generate
   *
   * Materializa los cruces sugeridos (ver GET .../standings) como Match
   * reales con stage="Cruces". Requiere hasPlayoffs + qualifyingSpots
   * configurados y al menos 2 grupos.
   *
   * Idempotente: si ya existen cruces generados devuelve 409, salvo que
   * se envíe `{ force: true }` — en ese caso solo se reemplazan los que
   * siguen SCHEDULED (nunca se tocan cruces ya jugados/en vivo).
   */
  app.post<{ Params: { idOrSlug: string }; Body: { force?: boolean } }>(
    '/:idOrSlug/crossmatches/generate',
    { onRequest: [app.authenticate] },
    async (req, reply) => {
      const tournament = await prisma.tournament.findFirst({
        where: tournamentWhere(req.params.idOrSlug),
        include: { groups: { include: { teams: true } }, matches: true },
      });
      if (!tournament) return reply.status(404).send({ error: 'Not found' });
      if (!(await requireTournamentEditor(req, reply, tournament.organizationId))) return;

      if (!tournament.hasPlayoffs || !tournament.qualifyingSpots) {
        return reply.status(400).send({
          error: 'Tournament has no playoff policy configured (hasPlayoffs / qualifyingSpots)',
        });
      }
      if (tournament.groups.length < 2) {
        return reply.status(400).send({ error: 'Crossmatches require at least 2 groups' });
      }

      const existing = await prisma.match.findMany({
        where: { tournamentId: tournament.id, stage: 'Cruces' },
      });
      if (existing.length > 0 && !req.body?.force) {
        return reply.status(409).send({
          error: 'Crossmatches already generated for this tournament. Pass { force: true } to regenerate.',
          matches: existing,
        });
      }
      if (existing.length > 0 && req.body?.force) {
        // Solo se reemplazan cruces que no han arrancado — nunca se
        // borran partidos ya jugados o en vivo.
        await prisma.match.deleteMany({
          where: { tournamentId: tournament.id, stage: 'Cruces', status: 'SCHEDULED' },
        });
      }

      const groups = tournament.groups.map(g => ({
        label: g.label,
        standings: computeStandings(g.teams, tournament.matches),
      }));
      const compiled = computeCompiledQualifiers(groups, tournament.qualifyingSpots);
      const crossmatches = computeCrossmatches(compiled);

      const pairs = crossmatches.filter(
        (cm): cm is Crossmatch & { teamB: QualifierRow } => cm.teamB !== null
      );
      const byes = crossmatches.filter(cm => cm.teamB === null);

      const created = await prisma.$transaction(
        pairs.map(cm =>
          prisma.match.create({
            data: {
              tournamentId: tournament.id,
              homeTeamId: cm.teamA.team.id,
              awayTeamId: cm.teamB.team.id,
              status: 'SCHEDULED',
              stage: 'Cruces',
              period: `${cm.seedA}° vs ${cm.seedB}°`,
            },
            include: { homeTeam: true, awayTeam: true },
          })
        )
      );

      return reply.status(201).send({
        matches: created,
        byes: byes.map(b => ({ seed: b.seedA, team: b.teamA.team })),
      });
    }
  );
};
