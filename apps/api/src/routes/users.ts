/**
 * routes/users.ts — perfil de usuario (viewer/referee/player).
 *
 * GET /:id                 → datos del usuario + extensión según rol:
 *                              REFEREE → matchesRefereed, eventsLogged (agregados)
 *                              PLAYER  → playerProfile con enrollments + stats
 * GET /:id/referee-matches  → partidos asignados (para UserSchedule/UserHistory
 *                              en el perfil propio de un árbitro)
 *
 * Nota: el modelo VIEWER (torneos seguidos / historial visto) no tiene
 * tablas propias todavía (no hay Follow ni WatchHistory) — se deja fuera
 * a propósito hasta que se decida esa parte del alcance.
 */
import type { FastifyPluginAsync } from 'fastify';
import { prisma } from '../lib/prisma.js';

export const userRoutes: FastifyPluginAsync = async (app) => {
  app.get<{ Params: { id: string } }>('/:id', async (req, reply) => {
    const user = await prisma.user.findUnique({
      where: { id: req.params.id },
      include: {
        playerProfile: {
          include: {
            enrollments: {
              include: { team: true, tournament: true, tournamentStats: true },
              orderBy: { joinedAt: 'desc' },
            },
          },
        },
      },
    });
    if (!user) return reply.status(404).send({ error: 'Not found' });

    if (user.role === 'REFEREE') {
      const [matchesRefereed, eventsLogged] = await Promise.all([
        prisma.match.count({ where: { refereeId: user.id } }),
        prisma.matchEvent.count({ where: { refereeId: user.id } }),
      ]);
      return reply.send({ ...user, matchesRefereed, eventsLogged });
    }

    return reply.send(user);
  });

  app.get<{ Params: { id: string } }>('/:id/referee-matches', async (req, reply) => {
    const include = { homeTeam: true, awayTeam: true, tournament: true } as const;

    const [scheduled, finished] = await Promise.all([
      prisma.match.findMany({
        where: { refereeId: req.params.id, status: 'SCHEDULED' },
        include,
        orderBy: { scheduledAt: 'asc' },
      }),
      prisma.match.findMany({
        where: { refereeId: req.params.id, status: 'FINISHED' },
        include,
        orderBy: [{ scheduledAt: 'desc' }, { createdAt: 'desc' }],
      }),
    ]);

    return reply.send({ scheduled, finished });
  });
};
