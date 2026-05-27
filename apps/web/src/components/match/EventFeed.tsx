/**
 * EventFeed.tsx — React island para el feed de eventos del partido.
 *
 * Muestra los eventos en orden cronológico inverso (más reciente arriba).
 * Recibe los eventos históricos del servidor como prop inicial.
 * Si el partido está LIVE, el WS agrega nuevos eventos al top de la lista.
 *
 * Comparte el WS lógicamente con LiveScoreboard pero son dos instancias
 * independientes — en una versión futura se podría centralizar el WS
 * en un Context o Zustand store. Por ahora la duplicación es aceptable
 * porque las conexiones son ligeras y Fastify las gestiona eficientemente.
 */

import { useState, useEffect, useRef } from 'react';

interface MatchEvent {
  id: string;
  type: 'goal' | 'yellow_card' | 'red_card' | 'foul' | 'substitution' |
        'period_start' | 'period_end' | 'timeout' | 'score_update' | 'custom';
  clock: string;
  teamId?: string;
  playerName?: string;
  description?: string;
  timestamp: string;
}

interface Team {
  id: string;
  name: string;
  shortName: string;
}

interface Props {
  matchId: string;
  homeTeam: Team;
  awayTeam: Team;
  initialEvents: MatchEvent[];
  status: 'LIVE' | 'SCHEDULED' | 'FINISHED';
  wsUrl: string;
}

// Event config: icon character (CSS) + label + accent color
const EVENT_CONFIG: Record<string, { symbol: string; label: string; color: string }> = {
  goal:         { symbol: '⚽', label: 'Gol',            color: '#00e5ff' },
  yellow_card:  { symbol: '🟨', label: 'Tarjeta amarilla', color: '#f5a623' },
  red_card:     { symbol: '🟥', label: 'Tarjeta roja',   color: '#ff3b3b' },
  foul:         { symbol: '⚠',  label: 'Falta',          color: '#8a9099' },
  substitution: { symbol: '🔄', label: 'Cambio',         color: '#8a9099' },
  period_start: { symbol: '▶',  label: 'Inicio',         color: '#454a52' },
  period_end:   { symbol: '⏸',  label: 'Fin de tiempo',  color: '#454a52' },
  timeout:      { symbol: '⏱',  label: 'Tiempo muerto',  color: '#8a9099' },
  score_update: { symbol: '📊', label: 'Actualización',  color: '#00e5ff' },
  custom:       { symbol: '📌', label: 'Evento',         color: '#8a9099' },
};

export default function EventFeed({
  matchId, homeTeam, awayTeam,
  initialEvents, status, wsUrl,
}: Props) {
  // Newest first
  const [events, setEvents] = useState<MatchEvent[]>(
    [...initialEvents].reverse()
  );
  const wsRef = useRef<WebSocket | null>(null);

  useEffect(() => {
    if (status !== 'LIVE') return;

    const ws = new WebSocket(`${wsUrl}/matches/${matchId}`);
    wsRef.current = ws;

    ws.onmessage = (e: MessageEvent) => {
      try {
        const msg = JSON.parse(e.data as string);
        if (msg.matchId !== matchId) return;
        if (msg.type === 'event' && msg.data) {
          setEvents(prev => [msg.data as MatchEvent, ...prev]);
        }
      } catch { /* ignore */ }
    };

    return () => ws.close();
  }, [matchId, status, wsUrl]);

  function getTeamName(teamId?: string): string {
    if (!teamId) return '';
    if (teamId === homeTeam.id) return homeTeam.shortName;
    if (teamId === awayTeam.id) return awayTeam.shortName;
    return teamId;
  }

  const isStructural = (type: string) =>
    type === 'period_start' || type === 'period_end';

  return (
    <div className="ef">
      <div className="ef__header">
        <span className="ef__title">Eventos del partido</span>
        {status === 'LIVE' && (
          <span className="ef__live-badge">
            <span className="ef__live-dot" aria-hidden="true" />
            En vivo
          </span>
        )}
      </div>

      {events.length === 0 && (
        <div className="ef__empty">
          {status === 'SCHEDULED'
            ? 'El partido aún no ha comenzado'
            : 'Sin eventos registrados'}
        </div>
      )}

      <ol className="ef__list" aria-label="Eventos del partido">
        {events.map(ev => {
          const cfg  = EVENT_CONFIG[ev.type] ?? EVENT_CONFIG.custom!;
          const team = getTeamName(ev.teamId);
          const isGoal = ev.type === 'goal';

          return (
            <li
              key={ev.id}
              className={[
                'ef__item',
                isStructural(ev.type) && 'ef__item--structural',
                isGoal && 'ef__item--goal',
              ].filter(Boolean).join(' ')}
            >
              {/* Clock */}
              <div className="ef__clock">{ev.clock}</div>

              {/* Symbol */}
              <div
                className="ef__symbol"
                style={{ color: cfg.color }}
                aria-hidden="true"
              >
                {cfg.symbol}
              </div>

              {/* Content */}
              <div className="ef__content">
                {team && (
                  <span className="ef__team" style={{ color: cfg.color }}>
                    [{team}]
                  </span>
                )}
                {ev.playerName && (
                  <span className="ef__player">{ev.playerName}</span>
                )}
                {ev.description && (
                  <span className="ef__desc">{ev.description}</span>
                )}
              </div>
            </li>
          );
        })}
      </ol>

      <style>{`
        .ef {
          height: 100%;
          display: flex;
          flex-direction: column;
        }
        .ef__header {
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding: 14px 16px 10px;
          border-bottom: 1px solid rgba(255,255,255,0.07);
          flex-shrink: 0;
        }
        .ef__title {
          font-family: 'Barlow Condensed', sans-serif;
          font-size: 0.8rem;
          font-weight: 800;
          letter-spacing: 0.08em;
          text-transform: uppercase;
          color: #f0f2f5;
        }
        .ef__live-badge {
          display: inline-flex;
          align-items: center;
          gap: 4px;
          font-family: 'Barlow Condensed', sans-serif;
          font-size: 0.6rem;
          font-weight: 700;
          letter-spacing: 0.1em;
          text-transform: uppercase;
          color: #ff3b3b;
        }
        .ef__live-dot {
          display: block;
          width: 5px; height: 5px;
          background: #ff3b3b;
          border-radius: 50%;
          animation: efPulse 1.2s ease-in-out infinite;
        }
        @keyframes efPulse {
          0%,100% { opacity:1; transform:scale(1); }
          50%      { opacity:.4; transform:scale(.65); }
        }

        .ef__empty {
          padding: 24px 16px;
          font-family: 'Barlow Condensed', sans-serif;
          font-size: 0.8rem;
          font-weight: 600;
          letter-spacing: 0.06em;
          text-transform: uppercase;
          color: #454a52;
          text-align: center;
        }

        .ef__list {
          list-style: none;
          overflow-y: auto;
          flex: 1;
          scrollbar-width: thin;
          scrollbar-color: rgba(255,255,255,0.07) transparent;
        }
        .ef__list::-webkit-scrollbar { width: 3px; }
        .ef__list::-webkit-scrollbar-thumb {
          background: rgba(255,255,255,0.07);
          border-radius: 2px;
        }

        .ef__item {
          display: flex;
          align-items: flex-start;
          gap: 10px;
          padding: 10px 16px;
          border-bottom: 1px solid rgba(255,255,255,0.04);
          transition: background 0.15s;
          animation: efSlide 0.3s ease;
        }
        @keyframes efSlide {
          from { opacity:0; transform: translateY(-4px); }
          to   { opacity:1; transform: translateY(0); }
        }
        .ef__item:hover { background: rgba(255,255,255,0.03); }

        /* Structural events (period start/end) — muted */
        .ef__item--structural {
          padding: 7px 16px;
          background: rgba(255,255,255,0.02);
        }
        .ef__item--structural .ef__content { color: #454a52; }

        /* Goal — highlighted */
        .ef__item--goal {
          background: rgba(0,229,255,0.04);
          border-left: 2px solid rgba(0,229,255,0.3);
        }

        .ef__clock {
          font-family: 'Barlow Condensed', sans-serif;
          font-size: 0.7rem;
          font-weight: 700;
          letter-spacing: 0.06em;
          color: #8a9099;
          min-width: 28px;
          flex-shrink: 0;
          padding-top: 1px;
        }
        .ef__symbol {
          font-size: 0.9rem;
          flex-shrink: 0;
          line-height: 1.3;
        }
        .ef__content {
          display: flex;
          flex-direction: column;
          gap: 2px;
          flex: 1;
          min-width: 0;
        }
        .ef__team {
          font-family: 'Barlow Condensed', sans-serif;
          font-size: 0.65rem;
          font-weight: 700;
          letter-spacing: 0.09em;
          text-transform: uppercase;
        }
        .ef__player {
          font-family: 'Barlow Condensed', sans-serif;
          font-size: 0.82rem;
          font-weight: 700;
          letter-spacing: 0.03em;
          text-transform: uppercase;
          color: #f0f2f5;
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
        }
        .ef__desc {
          font-family: 'Barlow', sans-serif;
          font-size: 0.75rem;
          color: #8a9099;
          line-height: 1.3;
        }
      `}</style>
    </div>
  );
}