/**
 * EventTimeline.tsx — línea de tiempo horizontal con los eventos del partido.
 *
 * Ubica cada evento como un ícono a lo largo de una línea horizontal,
 * posicionado proporcionalmente a su minuto/clock: los eventos del
 * equipo local quedan arriba de la línea, los del visitante abajo, y
 * los eventos estructurales (inicio/fin de tiempo, etc.) sobre la línea.
 *
 * Vive siempre visible debajo del video (no es parte de las pestañas)
 * para dar una vista rápida del partido sin ocupar el ancho del stream.
 * Comparte el mismo WS que EventFeed para actualizarse en vivo — ver
 * nota de duplicación de conexión en EventFeed.tsx.
 */

import { useState, useEffect, useMemo, useRef } from 'react';
import { EVENT_CONFIG, parseClockMinutes, type MatchEventItem } from '../../lib/matchEvents';

interface Team {
  id: string;
  name: string;
  shortName: string;
}

interface Props {
  matchId: string;
  homeTeam: Team;
  awayTeam: Team;
  initialEvents: MatchEventItem[];
  status: 'LIVE' | 'SCHEDULED' | 'FINISHED';
  wsUrl: string;
}

export default function EventTimeline({
  matchId, homeTeam, awayTeam,
  initialEvents, status, wsUrl,
}: Props) {
  const [events, setEvents] = useState<MatchEventItem[]>(initialEvents);
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
          setEvents(prev => [...prev, msg.data as MatchEventItem]);
        }
      } catch { /* ignore */ }
    };

    return () => ws.close();
  }, [matchId, status, wsUrl]);

  const sorted = useMemo(
    () => [...events].sort((a, b) => parseClockMinutes(a.clock) - parseClockMinutes(b.clock)),
    [events]
  );

  // Dominio de la línea = el evento más tardío (con un mínimo de 1 para evitar división por 0)
  const domainMax = useMemo(() => {
    const max = sorted.reduce((acc, ev) => Math.max(acc, parseClockMinutes(ev.clock)), 0);
    return Math.max(max, 1);
  }, [sorted]);

  function pct(clock: string): number {
    return Math.min(100, Math.max(0, (parseClockMinutes(clock) / domainMax) * 100));
  }

  function side(teamId?: string): 'home' | 'away' | 'mid' {
    if (!teamId) return 'mid';
    if (teamId === homeTeam.id) return 'home';
    if (teamId === awayTeam.id) return 'away';
    return 'mid';
  }

  const isEmpty = sorted.length === 0;

  return (
    <div className="et">
      <div className="et__header">
        <span className="et__team et__team--home">{homeTeam.shortName}</span>
        <span className="et__title">Línea de tiempo</span>
        <span className="et__team et__team--away">{awayTeam.shortName}</span>
      </div>

      {isEmpty ? (
        <div className="et__empty">
          {status === 'SCHEDULED'
            ? 'El partido aún no ha comenzado'
            : 'Sin eventos registrados'}
        </div>
      ) : (
        <div className="et__track" role="list" aria-label="Línea de tiempo de eventos">
          <div className="et__line" aria-hidden="true" />
          {sorted.map(ev => {
            const cfg = EVENT_CONFIG[ev.type] ?? EVENT_CONFIG.custom!;
            const pos = side(ev.teamId);

            return (
              <div
                key={ev.id}
                className={`et__marker et__marker--${pos}`}
                style={{ left: `${pct(ev.clock)}%` }}
                role="listitem"
                tabIndex={0}
              >
                <div
                  className="et__dot"
                  style={{ background: cfg.color, color: '#0a0c0f' }}
                >
                  <span aria-hidden="true">{cfg.symbol}</span>
                </div>
                <div className="et__connector" style={{ background: cfg.color }} aria-hidden="true" />

                <div className="et__tooltip">
                  <span className="et__tooltip-clock" style={{ color: cfg.color }}>{ev.clock}</span>
                  <span className="et__tooltip-label">{cfg.label}</span>
                  {ev.playerName && <span className="et__tooltip-player">{ev.playerName}</span>}
                </div>
              </div>
            );
          })}
        </div>
      )}

      <style>{`
        .et {
          background: var(--bg-surface);
          border: 1px solid var(--border);
          border-radius: var(--radius-lg);
          padding: 0;
        }
        .et__header {
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding: 12px 18px;
          border-bottom: 1px solid rgba(255,255,255,0.07);
        }
        .et__team {
          font-family: 'Barlow Condensed', sans-serif;
          font-size: 0.72rem;
          font-weight: 800;
          letter-spacing: 0.06em;
          text-transform: uppercase;
          color: #f0f2f5;
        }
        .et__title {
          font-family: 'Barlow Condensed', sans-serif;
          font-size: 0.62rem;
          font-weight: 600;
          letter-spacing: 0.1em;
          text-transform: uppercase;
          color: #454a52;
        }

        .et__empty {
          padding: 28px 16px;
          font-family: 'Barlow Condensed', sans-serif;
          font-size: 0.8rem;
          font-weight: 600;
          letter-spacing: 0.06em;
          text-transform: uppercase;
          color: #454a52;
          text-align: center;
        }

        .et__track {
          position: relative;
          height: 108px;
          margin: 0 22px;
          padding-top: 56px;
        }
        .et__line {
          position: absolute;
          top: 54px;
          left: 0;
          right: 0;
          height: 2px;
          background: rgba(255,255,255,0.09);
          border-radius: 1px;
        }

        .et__marker {
          position: absolute;
          top: 0;
          bottom: 0;
          display: flex;
          flex-direction: column;
          align-items: center;
          transform: translateX(-50%);
        }

        .et__dot {
          width: 22px;
          height: 22px;
          border-radius: 50%;
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 0.68rem;
          flex-shrink: 0;
          box-shadow: 0 0 0 3px var(--bg-surface);
          cursor: default;
          transition: transform 0.15s;
          z-index: 2;
        }
        .et__marker:hover .et__dot,
        .et__marker:focus .et__dot { transform: scale(1.18); }

        .et__connector {
          width: 1px;
          flex: 1;
          opacity: 0.35;
        }

        /* Home: dot above the line, connector goes down to the line */
        .et__marker--home {
          top: 0;
          height: 54px;
        }

        /* Away: dot below the line, connector goes up to the line */
        .et__marker--away {
          top: 54px;
          height: 54px;
          flex-direction: column-reverse;
        }

        /* Mid (structural/generic): dot sits centered on the line */
        .et__marker--mid {
          top: 43px;
          height: 22px;
        }
        .et__marker--mid .et__connector { display: none; }

        .et__tooltip {
          position: absolute;
          left: 50%;
          bottom: calc(100% + 8px);
          transform: translateX(-50%) translateY(4px);
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: 1px;
          padding: 6px 10px;
          background: #16191d;
          border: 1px solid rgba(255,255,255,0.1);
          border-radius: 6px;
          white-space: nowrap;
          opacity: 0;
          pointer-events: none;
          transition: opacity 0.15s, transform 0.15s;
          z-index: 5;
        }
        .et__marker--away .et__tooltip {
          bottom: auto;
          top: calc(100% + 8px);
        }
        .et__marker:hover .et__tooltip,
        .et__marker:focus .et__tooltip {
          opacity: 1;
          transform: translateX(-50%) translateY(0);
        }
        .et__tooltip-clock {
          font-family: 'Barlow Condensed', sans-serif;
          font-size: 0.68rem;
          font-weight: 800;
          letter-spacing: 0.05em;
        }
        .et__tooltip-label {
          font-family: 'Barlow Condensed', sans-serif;
          font-size: 0.66rem;
          font-weight: 600;
          letter-spacing: 0.04em;
          text-transform: uppercase;
          color: #c7cbd1;
        }
        .et__tooltip-player {
          font-family: 'Barlow', sans-serif;
          font-size: 0.68rem;
          color: #8a9099;
        }

        @media (max-width: 600px) {
          .et__track { margin: 0 12px; }
          .et__team { font-size: 0.62rem; }
        }
      `}</style>
    </div>
  );
}
