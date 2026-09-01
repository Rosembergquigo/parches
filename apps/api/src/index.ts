import Fastify, { type FastifyReply, type FastifyRequest } from 'fastify';
import cors from '@fastify/cors';
import jwt from '@fastify/jwt';
import { PORTS } from '@parches/config';
import { tournamentRoutes } from './routes/tournaments.js';
import { matchRoutes } from './routes/matches.js';
import { teamRoutes } from './routes/teams.js';
import { groupRoutes } from './routes/groups.js';
import { authRoutes } from './routes/auth.js';
import { userRoutes } from './routes/users.js';
import { organizationRoutes } from './routes/organizations.js';

// `app.authenticate` no lo agrega @fastify/jwt automáticamente — hay que
// declararlo. Sin esto, `{ onRequest: [app.authenticate] }` en auth.ts
// (ruta /auth/me) recibía `undefined` y tiraba abajo el registro de rutas.
declare module 'fastify' {
  interface FastifyInstance {
    authenticate: (request: FastifyRequest, reply: FastifyReply) => Promise<void>;
  }
}

const app = Fastify({ logger: true });

await app.register(cors, { origin: true });
await app.register(jwt, { secret: process.env.JWT_SECRET ?? 'dev-secret-change-in-prod' });

app.decorate('authenticate', async function (request: FastifyRequest, reply: FastifyReply) {
  try {
    await request.jwtVerify();
  } catch {
    return reply.status(401).send({ error: 'Unauthorized' });
  }
});

app.setErrorHandler((error, _req, reply) => {
  app.log.error(error);
  const status = error.statusCode ?? 500;
  reply.status(status).send({ error: status >= 500 ? 'Internal server error' : error.message });
});

await app.register(
  async (api) => {
    await api.register(authRoutes, { prefix: '/auth' });
    await api.register(organizationRoutes, { prefix: '/organizations' });
    await api.register(tournamentRoutes, { prefix: '/tournaments' });
    await api.register(matchRoutes, { prefix: '/matches' });
    await api.register(teamRoutes, { prefix: '/teams' });
    await api.register(groupRoutes, { prefix: '/groups' });
    await api.register(userRoutes, { prefix: '/users' });
  },
  { prefix: '/api' }
);

app.get('/health', async () => ({ ok: true, ts: new Date().toISOString() }));

app.listen({ port: PORTS.API ?? 3000, host: '0.0.0.0' });
console.log(`🟢 api listening on :${PORTS.API ?? 3000}`);
