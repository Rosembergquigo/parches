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
import type { SocketStream } from '@fastify/websocket';
import type { FastifyRequest } from 'fastify';
import type { WebSocket } from 'ws';
import type { WSMessage, RefereeEvent } from '@parches/types';
import { matchLiveChannel } from '@parches/config';
import Redis from 'ioredis';

const redisUrl = process.env.REDIS_URL ?? 'redis://localhost:6379';
const pub = new Redis(redisUrl);
const sub = new Redis(redisUrl);
pub.on('error', err => console.error('redis pub', err.message));
sub.on('error', err => console.error('redis sub', err.message));

// Map local: matchId → clientes WS conectados a ESTA instancia
const localSubscribers = new Map<string, Set<WebSocket>>();

function liveSocket(connection: SocketStream): WebSocket {
  return connection.socket;
}

function fanOut(matchId: string, payload: string): void {
  if (!payload.startsWith('{')) return;
  localSubscribers.get(matchId)?.forEach(ws => {
    if (ws.readyState === 1) ws.send(payload);
  });
}

// Escuchar eventos de Redis y reenviarlos a clientes locales
sub.on('message', (channel: string, message: string) => {
  const matchId = channel.startsWith('match:') ? channel.slice('match:'.length) : channel;
  fanOut(matchId, message);
});

export function wsHandler(
  connection: SocketStream,
  request: FastifyRequest<{ Params: { matchId: string } }>
) {
  const { matchId } = request.params;
  const socket = liveSocket(connection);

  if (!localSubscribers.has(matchId)) {
    localSubscribers.set(matchId, new Set());
    sub.subscribe(matchLiveChannel(matchId));
  }
  localSubscribers.get(matchId)!.add(socket);

  socket.on('close', () => {
    const subs = localSubscribers.get(matchId);
    if (!subs) return;
    subs.delete(socket);
    if (subs.size === 0) {
      localSubscribers.delete(matchId);
      sub.unsubscribe(matchLiveChannel(matchId));
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
  await pub.publish(matchLiveChannel(matchId), JSON.stringify(msg));
}
