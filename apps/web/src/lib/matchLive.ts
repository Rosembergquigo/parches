/**
 * Un WebSocket por partido, compartido entre islas Astro.
 * Scoreboard, feed y timeline no pueden compartir React Context
 * (cada client:load es un árbol aparte); el módulo sí es el mismo.
 * Si Redis/streaming-data se cae un momento, reintenta sola.
 */
import { useEffect, useRef, useState } from 'react';

export type MatchLiveMessage = {
  type: 'score_update' | 'event' | 'match_status' | 'ping';
  matchId: string;
  data: unknown;
  timestamp?: string;
};

export type DisplayMatchStatus = 'LIVE' | 'SCHEDULED' | 'FINISHED';

export function displayMatchStatus(raw: string | undefined | null): DisplayMatchStatus {
  if (raw === 'FINISHED') return 'FINISHED';
  if (raw === 'SCHEDULED') return 'SCHEDULED';
  return 'LIVE';
}

export function statusFromLiveMessage(msg: MatchLiveMessage): DisplayMatchStatus | null {
  if (msg.type !== 'match_status' && msg.type !== 'score_update') return null;
  if (!msg.data || typeof msg.data !== 'object') return null;
  const status = (msg.data as { status?: unknown }).status;
  if (typeof status !== 'string' || !status) return null;
  return displayMatchStatus(status);
}

type MessageFn = (msg: MatchLiveMessage) => void;
type ConnectedFn = (connected: boolean) => void;

type Bus = {
  ws: WebSocket | null;
  url: string;
  listeners: Set<MessageFn>;
  connectedListeners: Set<ConnectedFn>;
  connected: boolean;
  retry: number;
  timer: ReturnType<typeof setTimeout> | null;
  closing: boolean;
};

const buses = new Map<string, Bus>();

function wsUrlFor(base: string, matchId: string): string {
  return `${base.replace(/\/$/, '')}/matches/${matchId}/ws`;
}

function setConnected(bus: Bus, value: boolean): void {
  if (bus.connected === value) return;
  bus.connected = value;
  bus.connectedListeners.forEach(fn => fn(value));
}

function open(matchId: string, bus: Bus): void {
  if (bus.closing) return;
  bus.ws = new WebSocket(bus.url);
  bus.ws.onopen = () => {
    bus.retry = 0;
    setConnected(bus, true);
  };
  bus.ws.onmessage = (e: MessageEvent) => {
    try {
      const msg = JSON.parse(String(e.data)) as MatchLiveMessage;
      if (msg.matchId && msg.matchId !== matchId) return;
      bus.listeners.forEach(fn => fn(msg));
    } catch { /* ignore malformed */ }
  };
  bus.ws.onerror = () => setConnected(bus, false);
  bus.ws.onclose = () => {
    setConnected(bus, false);
    bus.ws = null;
    if (bus.closing || bus.listeners.size === 0) return;
    const wait = Math.min(1000 * 2 ** bus.retry, 8000);
    bus.retry += 1;
    bus.timer = setTimeout(() => open(matchId, bus), wait);
  };
}

export function subscribeMatchLive(
  matchId: string,
  wsUrl: string,
  onMessage: MessageFn,
  onConnected?: ConnectedFn,
): () => void {
  const url = wsUrlFor(wsUrl, matchId);
  let bus = buses.get(matchId);
  if (!bus) {
    bus = {
      ws: null,
      url,
      listeners: new Set(),
      connectedListeners: new Set(),
      connected: false,
      retry: 0,
      timer: null,
      closing: false,
    };
    buses.set(matchId, bus);
    open(matchId, bus);
  }
  bus.listeners.add(onMessage);
  if (onConnected) {
    bus.connectedListeners.add(onConnected);
    onConnected(bus.connected);
  }
  return () => {
    bus!.listeners.delete(onMessage);
    if (onConnected) bus!.connectedListeners.delete(onConnected);
    if (bus!.listeners.size > 0) return;
    bus!.closing = true;
    if (bus!.timer != null) clearTimeout(bus!.timer);
    bus!.timer = null;
    bus!.ws?.close();
    buses.delete(matchId);
  };
}

/** LIVE abre el bus; el handler va en un ref para no reabrir el socket cada render. */
export function useMatchLive(
  matchId: string,
  wsUrl: string,
  enabled: boolean,
  onMessage: MessageFn,
): boolean {
  const [connected, setConnected] = useState(false);
  const onMessageRef = useRef(onMessage);
  onMessageRef.current = onMessage;

  useEffect(() => {
    if (!enabled) {
      setConnected(false);
      return;
    }
    return subscribeMatchLive(
      matchId,
      wsUrl,
      msg => onMessageRef.current(msg),
      setConnected,
    );
  }, [matchId, wsUrl, enabled]);

  return connected;
}
