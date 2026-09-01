import type { FastifyPluginAsync } from 'fastify';
import { prisma } from '../lib/prisma.js';
import { computeStandings } from '../lib/standings.js';
import { requireTournamentEditor } from '../lib/authz.js';

export const teamRoutes: FastifyPluginAsync = async (app) => {
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

    const standing = computeStandings(tableTeams, matches).find(row => row.team.id === team.id);

    return reply.send({ ...team, standing, matches });
  });

  app.patch<{
    Params: { id: string };
    Body: Partial<{ name: string; shortName: string; color: string; logoUrl: string; groupId: string | null }>;
  }>('/:id', { onRequest: [app.authenticate] }, async (req, reply) => {
    const existing = await prisma.team.findUnique({ where: { id: req.params.id } });
    if (!existing) return reply.status(404).send({ error: 'Not found' });
    const tournament = await prisma.tournament.findUnique({ where: { id: existing.tournamentId } });
    if (!tournament) return reply.status(404).send({ error: 'Not found' });
    if (!(await requireTournamentEditor(req, reply, tournament.organizationId))) return;
    const team = await prisma.team.update({ where: { id: req.params.id }, data: req.body });
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
    await prisma.team.delete({ where: { id: req.params.id } });
    return reply.status(204).send();
  });
};
