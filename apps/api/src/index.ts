import Fastify from 'fastify';
import cors from '@fastify/cors';
import jwt from '@fastify/jwt';
import { PORTS } from '@parches/config';
import { tournamentRoutes } from './routes/tournaments.js';
import { matchRoutes } from './routes/matches.js';
import { authRoutes } from './routes/auth.js';

const app = Fastify({ logger: true });

await app.register(cors, { origin: true });
await app.register(jwt, { secret: process.env.JWT_SECRET ?? 'dev-secret-change-in-prod' });

await app.register(authRoutes, { prefix: '/auth' });
await app.register(tournamentRoutes, { prefix: '/tournaments' });
await app.register(matchRoutes, { prefix: '/matches' });

app.get('/health', async () => ({ ok: true, ts: new Date().toISOString() }));

app.listen({ port: PORTS.API ?? 3000, host: '0.0.0.0' });
console.log(`🟢 api listening on :${PORTS.API ?? 3000}`);
