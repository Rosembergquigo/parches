import type { FastifyPluginAsync } from 'fastify';
import { INDIVIDUAL_SPORTS, isIndividualSport } from '@parches/config';
import { prisma } from '../lib/prisma.js';
import { computeStandings } from '../lib/standings.js';
import { requireTournamentEditor, requireTeamRosterAccess, userIdFrom } from '../lib/authz.js';
import { toTitleCase } from '../lib/text.js';
import { notifyCaptainAssigned, notifyPlayerEnrolled } from '../lib/notify.js';
import { withPlayerPhotos } from '../lib/playerPhoto.js';
import {
  ensurePlayerUser,
  findEnrollmentInTournament,
  loadEnrollment,
  normalizeEmail,
  parseCaptain,
  parseJersey,
  parseTeamImageUrl,
  sameTournamentConflict,
  teamForEditor,
  toEnrollmentDto,
} from '../lib/enrollments.js';

export const teamRoutes: FastifyPluginAsync = async (app) => {
  /**
   * GET /api/teams/captained
   * Equipos donde el usuario es capitán (enlace o correo).
   */
  app.get('/captained', { onRequest: [app.authenticate] }, async (req, reply) => {
    const userId = (req.user as { sub: string }).sub;
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { id: true, email: true },
    });
    if (!user) return reply.status(401).send({ error: 'Unauthorized' });
    const email = user.email.trim().toLowerCase();
    await prisma.team.updateMany({
      where: { captainUserId: null, captainEmail: email },
      data: { captainUserId: user.id },
    });
    const teams = await prisma.team.findMany({
      where: {
        tournament: { sport: { notIn: [...INDIVIDUAL_SPORTS] } },
        OR: [{ captainUserId: user.id }, { captainEmail: email }],
      },
      include: {
        group: true,
        tournament: {
          select: {
            id: true,
            name: true,
            slug: true,
            sport: true,
            organization: { select: { name: true, slug: true } },
          },
        },
      },
      orderBy: { name: 'asc' },
    });
    return reply.send(teams);
  });

  /**
   * GET /api/teams/:id
   *
   * Detalle de equipo para la página /teams/[id]: datos del equipo,
   * torneo al que pertenece, su posición en la tabla (calculada sobre
   * su grupo si tiene uno, o sobre todo el torneo si no) y sus partidos
   * (jugados y programados), más recientes primero.
   */
  app.get<{ Params: { id: string } }>('/:id', async (req, reply) => {
    const team = await prisma.team.findUnique({
      where: { id: req.params.id },
      include: {
        tournament: true,
        group: true,
        enrollments: {
          where: { isActive: true },
          include: { playerProfile: { include: { user: true } } },
        },
      },
    });
    if (!team) return reply.status(404).send({ error: 'Not found' });

    const [tableTeams, matches] = await Promise.all([
      prisma.team.findMany({ where: team.groupId ? { groupId: team.groupId } : { tournamentId: team.tournamentId } }),
      prisma.match.findMany({
        where: { tournamentId: team.tournamentId, OR: [{ homeTeamId: team.id }, { awayTeamId: team.id }] },
        include: { homeTeam: true, awayTeam: true },
        orderBy: [{ scheduledAt: 'desc' }, { createdAt: 'desc' }],
      }),
    ]);

    const sport = team.tournament.sport;
    const [lookedTable, lookedTeam] = await Promise.all([
      withPlayerPhotos(sport, tableTeams),
      withPlayerPhotos(sport, [team]),
    ]);
    const standing = computeStandings(lookedTable, matches).find(row => row.team.id === team.id);
    const matchTeams = await withPlayerPhotos(
      sport,
      matches.flatMap(m => [m.homeTeam, m.awayTeam]),
    );
    const byId = new Map(matchTeams.map(t => [t.id, t]));
    const lookedMatches = matches.map(m => ({
      ...m,
      homeTeam: byId.get(m.homeTeam.id) ?? m.homeTeam,
      awayTeam: byId.get(m.awayTeam.id) ?? m.awayTeam,
    }));

    return reply.send({ ...lookedTeam[0]!, standing, matches: lookedMatches });
  });

  app.patch<{
    Params: { id: string };
    Body: Partial<{
      name: string;
      shortName: string;
      color: string;
      logoUrl: string;
      groupId: string | null;
      captainName: string;
      captainEmail: string;
      captainPhone: string;
    }>;
  }>('/:id', { onRequest: [app.authenticate] }, async (req, reply) => {
    const existing = await prisma.team.findUnique({
      where: { id: req.params.id },
      include: { tournament: true },
    });
    if (!existing) return reply.status(404).send({ error: 'Not found' });
    const role = await requireTeamRosterAccess(req, reply, existing);
    if (!role) return;
    const body = req.body ?? {};

    if (role === 'captain') {
      const individual = isIndividualSport(existing.tournament.sport);
      if (individual) {
        return reply.status(403).send({
          error: 'Foto y color se cambian en Ajustes de perfil',
        });
      }
      const data: { logoUrl?: string | null } = {};
      try {
        if (body.logoUrl !== undefined) {
          data.logoUrl = parseTeamImageUrl(body.logoUrl) ?? null;
        }
      } catch (err) {
        const e = err as Error & { statusCode?: number };
        return reply.status(e.statusCode ?? 400).send({ error: e.message });
      }
      if (Object.keys(data).length === 0) {
        return reply.status(403).send({
          error: 'El capitán solo puede actualizar el escudo',
        });
      }
      const team = await prisma.team.update({
        where: { id: req.params.id },
        data,
      });
      return reply.send(team);
    }

    const data: {
      name?: string;
      shortName?: string;
      color?: string | null;
      logoUrl?: string | null;
      groupId?: string | null;
      captainName?: string;
      captainEmail?: string;
      captainPhone?: string;
      captainUserId?: string | null;
    } = {};
    if (typeof body.name === 'string') data.name = toTitleCase(body.name);
    if (typeof body.shortName === 'string') {
      data.shortName = body.shortName.trim().toUpperCase();
      if (!/^[A-Z0-9]{2,4}$/.test(data.shortName)) {
        return reply.status(400).send({ error: 'shortName must be 2–4 letters or numbers' });
      }
    }
    if (body.color !== undefined && !isIndividualSport(existing.tournament.sport)) {
      data.color = body.color?.trim() || null;
    }
    if (body.logoUrl !== undefined && !isIndividualSport(existing.tournament.sport)) {
      data.logoUrl = body.logoUrl?.trim() || null;
    }
    if (body.groupId !== undefined) {
      const groupId = body.groupId?.trim() || null;
      if (groupId) {
        const group = await prisma.group.findFirst({ where: { id: groupId, tournamentId: existing.tournamentId } });
        if (!group) return reply.status(400).send({ error: 'groupId is not in this tournament' });
      }
      data.groupId = groupId;
    }
    try {
      const captain = await parseCaptain(body, false);
      if (captain) Object.assign(data, captain);
    } catch (err) {
      const e = err as Error & { statusCode?: number };
      return reply.status(e.statusCode ?? 400).send({ error: e.message });
    }
    const team = await prisma.team.update({ where: { id: req.params.id }, data });
    if (
      !isIndividualSport(existing.tournament.sport) &&
      data.captainEmail &&
      data.captainEmail.trim().toLowerCase() !== (existing.captainEmail ?? '').trim().toLowerCase()
    ) {
      notifyCaptainAssigned({
        teamId: team.id,
        captainName: data.captainName ?? team.captainName ?? '',
        captainEmail: data.captainEmail,
      });
    }
    return reply.send(team);
  });

  app.delete<{ Params: { id: string } }>('/:id', { onRequest: [app.authenticate] }, async (req, reply) => {
    const existing = await prisma.team.findUnique({ where: { id: req.params.id } });
    if (!existing) return reply.status(404).send({ error: 'Not found' });
    const tournament = await prisma.tournament.findUnique({ where: { id: existing.tournamentId } });
    if (!tournament) return reply.status(404).send({ error: 'Not found' });
    if (!(await requireTournamentEditor(req, reply, tournament.organizationId))) return;
    const matchCount = await prisma.match.count({
      where: { OR: [{ homeTeamId: req.params.id }, { awayTeamId: req.params.id }] },
    });
    if (matchCount > 0) {
      return reply.status(409).send({ error: 'Cannot delete a team with existing matches' });
    }
    await prisma.playerEnrollment.deleteMany({ where: { teamId: req.params.id } });
    await prisma.team.delete({ where: { id: req.params.id } });
    return reply.status(204).send();
  });

  /**
   * GET /api/teams/:id/enrollments
   * Plantilla completa (activos e inactivos) — solo editor del torneo.
   */
  app.get<{ Params: { id: string } }>(
    '/:id/enrollments',
    { onRequest: [app.authenticate] },
    async (req, reply) => {
      const team = await teamForEditor(req, reply, req.params.id);
      if (!team) return;
      const rows = await prisma.playerEnrollment.findMany({
        where: { teamId: team.id },
        include: { playerProfile: { include: { user: true } } },
        orderBy: [{ isActive: 'desc' }, { jerseyNumber: 'asc' }, { joinedAt: 'asc' }],
      });
      return reply.send(rows.map(toEnrollmentDto));
    }
  );

  /**
   * POST /api/teams/:id/enrollments
   * Inscribe por correo: busca o crea User + PlayerProfile.
   * Un jugador no puede estar en dos equipos del mismo torneo.
   */
  app.post<{
    Params: { id: string };
    Body: { email?: string; name?: string; phone?: string; jerseyNumber?: number | null; position?: string };
  }>('/:id/enrollments', { onRequest: [app.authenticate] }, async (req, reply) => {
    const team = await teamForEditor(req, reply, req.params.id);
    if (!team) return;
    if (isIndividualSport(team.tournament.sport)) {
      return reply.status(400).send({
        error: 'En este deporte no hay plantilla: cada inscripción es un jugador',
      });
    }

    const email = normalizeEmail(req.body?.email);
    if (!email) return reply.status(400).send({ error: 'El correo no es válido' });

    let jersey: number | null | undefined;
    try {
      jersey = parseJersey(req.body?.jerseyNumber);
    } catch (err) {
      const e = err as Error & { statusCode?: number };
      return reply.status(e.statusCode ?? 400).send({ error: e.message });
    }

    let user: Awaited<ReturnType<typeof ensurePlayerUser>>;
    try {
      user = await ensurePlayerUser({
        email,
        name: req.body?.name,
        phone: req.body?.phone,
      });
    } catch (err) {
      const e = err as Error & { statusCode?: number };
      return reply.status(e.statusCode ?? 400).send({ error: e.message });
    }

    const playerProfileId = user.playerProfile?.id;
    if (!playerProfileId) {
      return reply.status(500).send({ error: 'No se pudo crear el perfil de jugador' });
    }

    const existing = await findEnrollmentInTournament(playerProfileId, team.tournamentId);

    if (existing) {
      if (existing.teamId !== team.id) {
        return reply.status(409).send(sameTournamentConflict(existing.team));
      }
      if (existing.isActive) {
        return reply.status(409).send({
          error: 'Este jugador ya está en este equipo',
          teamId: team.id,
          teamName: team.name,
        });
      }
      const reactivated = await prisma.playerEnrollment.update({
        where: { id: existing.id },
        data: {
          isActive: true,
          jerseyNumber: jersey === undefined ? existing.jerseyNumber : jersey,
          position: typeof req.body?.position === 'string'
            ? (toTitleCase(req.body.position) || null)
            : existing.position,
        },
        include: { playerProfile: { include: { user: true } } },
      });
      notifyPlayerEnrolled({
        teamId: team.id,
        playerName: reactivated.playerProfile.user.name,
        playerEmail: reactivated.playerProfile.user.email,
        jerseyNumber: reactivated.jerseyNumber,
        position: reactivated.position,
        actorUserId: userIdFrom(req),
        reactivated: true,
      });
      return reply.send(toEnrollmentDto(reactivated));
    }

    const created = await prisma.playerEnrollment.create({
      data: {
        playerProfileId,
        teamId: team.id,
        tournamentId: team.tournamentId,
        jerseyNumber: jersey ?? null,
        position: typeof req.body?.position === 'string'
          ? (toTitleCase(req.body.position) || null)
          : null,
        isActive: true,
      },
      include: { playerProfile: { include: { user: true } } },
    }).catch((err: { code?: string }) => {
      if (err.code === 'P2002') return null;
      throw err;
    });
    if (!created) {
      const conflict = await findEnrollmentInTournament(playerProfileId, team.tournamentId);
      if (conflict && conflict.teamId !== team.id) {
        return reply.status(409).send(sameTournamentConflict(conflict.team));
      }
      return reply.status(409).send({
        error: 'Este jugador ya está inscrito en otro equipo de este torneo',
        teamId: team.id,
        teamName: team.name,
      });
    }
    notifyPlayerEnrolled({
      teamId: team.id,
      playerName: created.playerProfile.user.name,
      playerEmail: created.playerProfile.user.email,
      jerseyNumber: created.jerseyNumber,
      position: created.position,
      actorUserId: userIdFrom(req),
    });
    return reply.status(201).send(toEnrollmentDto(created));
  });

  /**
   * PATCH /api/teams/:id/enrollments/:enrollmentId
   * Edita dorsal, posición, estado, nombre y celular.
   */
  app.patch<{
    Params: { id: string; enrollmentId: string };
    Body: Partial<{
      jerseyNumber: number | null;
      position: string | null;
      isActive: boolean;
      name: string;
      phone: string | null;
    }>;
  }>('/:id/enrollments/:enrollmentId', { onRequest: [app.authenticate] }, async (req, reply) => {
    const team = await teamForEditor(req, reply, req.params.id);
    if (!team) return;
    const current = await loadEnrollment(req.params.enrollmentId, team.id);
    if (!current) return reply.status(404).send({ error: 'Not found' });

    const body = req.body ?? {};
    const enrollmentData: {
      jerseyNumber?: number | null;
      position?: string | null;
      isActive?: boolean;
    } = {};
    try {
      const jersey = parseJersey(body.jerseyNumber);
      if (jersey !== undefined) enrollmentData.jerseyNumber = jersey;
    } catch (err) {
      const e = err as Error & { statusCode?: number };
      return reply.status(e.statusCode ?? 400).send({ error: e.message });
    }
    if (body.position !== undefined) {
      enrollmentData.position = typeof body.position === 'string'
        ? (toTitleCase(body.position) || null)
        : null;
    }
    if (typeof body.isActive === 'boolean') enrollmentData.isActive = body.isActive;

    const userData: { name?: string; phone?: string | null } = {};
    if (typeof body.name === 'string') {
      const name = toTitleCase(body.name);
      if (!name) return reply.status(400).send({ error: 'El nombre no puede quedar vacío' });
      userData.name = name;
    }
    if (body.phone !== undefined) {
      userData.phone = typeof body.phone === 'string' ? (body.phone.trim() || null) : null;
    }

    if (Object.keys(userData).length > 0) {
      await prisma.user.update({
        where: { id: current.playerProfile.userId },
        data: userData,
      });
    }

    const updated = await prisma.playerEnrollment.update({
      where: { id: current.id },
      data: enrollmentData,
      include: { playerProfile: { include: { user: true } } },
    });
    if (!current.isActive && updated.isActive) {
      notifyPlayerEnrolled({
        teamId: team.id,
        playerName: updated.playerProfile.user.name,
        playerEmail: updated.playerProfile.user.email,
        jerseyNumber: updated.jerseyNumber,
        position: updated.position,
        actorUserId: userIdFrom(req),
        reactivated: true,
      });
    }
    return reply.send(toEnrollmentDto(updated));
  });

  /**
   * DELETE /api/teams/:id/enrollments/:enrollmentId
   * Da de baja (isActive=false). Conserva stats e historial.
   */
  app.delete<{ Params: { id: string; enrollmentId: string } }>(
    '/:id/enrollments/:enrollmentId',
    { onRequest: [app.authenticate] },
    async (req, reply) => {
      const team = await teamForEditor(req, reply, req.params.id);
      if (!team) return;
      const current = await loadEnrollment(req.params.enrollmentId, team.id);
      if (!current) return reply.status(404).send({ error: 'Not found' });
      await prisma.playerEnrollment.update({
        where: { id: current.id },
        data: { isActive: false },
      });
      return reply.status(204).send();
    }
  );
};
