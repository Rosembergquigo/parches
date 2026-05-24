/**
 * WebSocket handler con Redis pub/sub.
 *
 * Por qué Redis aquí: si corres 2+ instancias de streaming-data
 * (escalado horizontal), cada una tiene sus propios suscriptores WS
 * en memoria. Sin Redis, un evento publicado en instancia-1 no llega
 * a los clientes conectados a instancia-2.
 *
 * Redis pub/sub actúa como bus compartido entre instancias.
 */
import type { WebSocket } from 'ws';
import type { FastifyRequest } from 'fastify';
import type { WSMessage, RefereeEvent } from '@parches/types';
import Redis from 'ioredis';

const pub = new Redis(process.env.REDIS_URL ?? 'redis://localhost:6379');
const sub = new Redis(process.env.REDIS_URL ?? 'redis://localhost:6379');

// Map local: matchId → clientes WS conectados a ESTA instancia
const localSubscribers = new Map<string, Set<WebSocket>>();

// Escuchar eventos de Redis y reenviarlos a clientes locales
sub.on('message', (channel: string, message: string) => {
  const matchId = channel.replace('match:', '');
  localSubscribers.get(matchId)?.forEach((ws) => ws.send(message));
});

export function wsHandler(
  socket: WebSocket,
  request: FastifyRequest<{ Params: { matchId: string } }>
) {
  const { matchId } = request.params;

  if (!localSubscribers.has(matchId)) {
    localSubscribers.set(matchId, new Set());
    sub.subscribe(`match:${matchId}`);
  }
  localSubscribers.get(matchId)!.add(socket);

  socket.on('close', () => {
    const subs = localSubscribers.get(matchId);
    if (!subs) return;
    subs.delete(socket);
    if (subs.size === 0) {
      localSubscribers.delete(matchId);
      sub.unsubscribe(`match:${matchId}`);
    }
  });
  socket.on('error', console.error);
}

/** Publica en Redis — todas las instancias lo reciben y reenvían a sus clientes */
export async function broadcastEvent(matchId: string, event: RefereeEvent): Promise<void> {
  const msg: WSMessage<RefereeEvent> = {
    type: 'event',
    matchId,
    data: event,
    timestamp: new Date().toISOString(),
  };
  await pub.publish(`match:${matchId}`, JSON.stringify(msg));
}
