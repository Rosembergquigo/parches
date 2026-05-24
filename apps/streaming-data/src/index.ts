import Fastify from 'fastify';
import websocket from '@fastify/websocket';
import cors from '@fastify/cors';
import { PORTS } from '@parches/config';
import { matchRoutes } from './routes/matches.js';
import { tournamentRoutes } from './routes/tournaments.js';
import { wsHandler } from './ws/handler.js';

const app = Fastify({ logger: true });

await app.register(cors, { origin: true });
await app.register(websocket);
await app.register(matchRoutes, { prefix: '/matches' });
await app.register(tournamentRoutes, { prefix: '/tournaments' });

// WebSocket live channel per match
app.get('/matches/:matchId/ws', { websocket: true }, wsHandler);

app.listen({ port: PORTS.STREAMING_DATA, host: '0.0.0.0' });
console.log(`🟢 streaming-data listening on :${PORTS.STREAMING_DATA}`);
