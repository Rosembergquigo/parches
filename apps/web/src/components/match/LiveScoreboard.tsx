/**
 * LiveScoreboard.tsx — React island para el marcador en vivo.
 *
 * Se hidrata en el cliente. Si el partido está LIVE, abre un WebSocket
 * a streaming-data y actualiza el score/clock sin re-render del servidor.
 * Si está FINISHED, muestra el score final estático.
 *
 * Props vienen del servidor (Astro) con el estado inicial del partido.
 * El WS solo actualiza la UI — el estado inicial siempre viene SSR.
 */

import { useState, useEffect, useRef } from 'react';

interface Team {
  id: string;
  name: string;
  shortName: string;
}

interface Props {
  matchId: string;
  homeTeam: Team;
  awayTeam: Team;
  initialHomeScore: number;
  initialAwayScore: number;
  initialClock: string;
  initialPeriod: string;
  status: 'LIVE' | 'SCHEDULED' | 'FINISHED';
  wsUrl: string;             // URL del WebSocket de streaming-data
  viewerCount?: number;
}

type WSMessage = {
  type: 'score_update' | 'event' | 'match_status' | 'ping';
  matchId: string;
  data: {
    homeScore?: number;
    awayScore?: number;
    clock?: string;
    period?: string;
    viewerCount?: number;
  };
};

export default function LiveScoreboard({
  matchId,
  homeTeam,
  awayTeam,
  initialHomeScore,
  initialAwayScore,
  initialClock,
  initialPeriod,
  status,
  wsUrl,
  viewerCount: initialViewers,
}: Props) {
  const [homeScore,  setHomeScore]  = useState(initialHomeScore);
  const [awayScore,  setAwayScore]  = useState(initialAwayScore);
  const [clock,      setClock]      = useState(initialClock);
  const [period,     setPeriod]     = useState(initialPeriod);
  const [viewers,    setViewers]    = useState(initialViewers ?? 0);
  const [connected,  setConnected]  = useState(false);
  const wsRef = useRef<WebSocket | null>(null);

  useEffect(() => {
    if (status !== 'LIVE') return;

    const ws = new WebSocket(`${wsUrl}/matches/${matchId}`);
    wsRef.current = ws;

    ws.onopen  = () => setConnected(true);
    ws.onclose = () => setConnected(false);
    ws.onerror = () => setConnected(false);

    ws.onmessage = (e: MessageEvent) => {
      try {
        const msg: WSMessage = JSON.parse(e.data as string);
        if (msg.matchId !== matchId) return;
        if (msg.type === 'score_update') {
          if (msg.data.homeScore  !== undefined) setHomeScore(msg.data.homeScore);
          if (msg.data.awayScore  !== undefined) setAwayScore(msg.data.awayScore);
          if (msg.data.clock      !== undefined) setClock(msg.data.clock);
          if (msg.data.period     !== undefined) setPeriod(msg.data.period);
          if (msg.data.viewerCount !== undefined) setViewers(msg.data.viewerCount);
        }
      } catch { /* ignore malformed messages */ }
    };

    return () => ws.close();
  }, [matchId, status, wsUrl]);

  const homeWins = homeScore > awayScore;
  const awayWins = awayScore > homeScore;

  function formatViewers(n: number): string {
    return n >= 1000 ? `${(n / 1000).toFixed(1)}k` : String(n);
  }

  return (
    <div className="sb">
      {/* Status bar */}
      <div className="sb__status-bar">
        {status === 'LIVE' && (
          <>
            <span className="sb__live-pill">
              <span className="sb__live-dot" aria-hidden="true" />
              En vivo
            </span>
            <span className="sb__clock">{clock}</span>
            <span className="sb__period">{period}</span>
            <span className="sb__ws-status" title={connected ? 'Conectado' : 'Reconectando…'}>
              {connected ? '🟢' : '🔴'}
            </span>
          </>
        )}
        {status === 'FINISHED' && (
          <span className="sb__finished">Partido finalizado · FT</span>
        )}
        {status === 'SCHEDULED' && (
          <span className="sb__soon">Próximamente</span>
        )}
      </div>

      {/* Main scoreboard */}
      <div className="sb__main">
        {/* Home team */}
        <div className="sb__team sb__team--home">
          <div className="sb__logo" aria-hidden="true">{homeTeam.shortName}</div>
          <span className="sb__name">{homeTeam.name}</span>
        </div>

        {/* Score */}
        <div className="sb__score-block">
          <div className="sb__score">
            <span className={homeWins ? 'sb__num sb__num--win' : 'sb__num'}>
              {homeScore}
            </span>
            <span className="sb__sep">—</span>
            <span className={awayWins ? 'sb__num sb__num--win' : 'sb__num'}>
              {awayScore}
            </span>
          </div>
          {viewers > 0 && status === 'LIVE' && (
            <div className="sb__viewers">● {formatViewers(viewers)} viendo</div>
          )}
        </div>

        {/* Away team */}
        <div className="sb__team sb__team--away">
          <div className="sb__logo" aria-hidden="true">{awayTeam.shortName}</div>
          <span className="sb__name">{awayTeam.name}</span>
        </div>
      </div>

      <style>{`
        .sb { width: 100%; }

        .sb__status-bar {
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 10px;
          padding: 10px 0 6px;
        }
        .sb__live-pill {
          display: inline-flex;
          align-items: center;
          gap: 5px;
          padding: 3px 9px;
          background: rgba(255,59,59,0.14);
          border: 1px solid #ff3b3b;
          border-radius: 3px;
          font-family: 'Barlow Condensed', sans-serif;
          font-size: 0.62rem;
          font-weight: 700;
          letter-spacing: 0.1em;
          text-transform: uppercase;
          color: #ff3b3b;
        }
        .sb__live-dot {
          display: block;
          width: 5px; height: 5px;
          background: #ff3b3b;
          border-radius: 50%;
          animation: sbPulse 1.2s ease-in-out infinite;
        }
        @keyframes sbPulse {
          0%,100% { opacity:1; transform:scale(1); }
          50%      { opacity:.4; transform:scale(.65); }
        }
        .sb__clock, .sb__period {
          font-family: 'Barlow Condensed', sans-serif;
          font-size: 0.72rem;
          font-weight: 700;
          letter-spacing: 0.08em;
          text-transform: uppercase;
        }
        .sb__clock  { color: #ff3b3b; }
        .sb__period { color: #8a9099; }
        .sb__ws-status { font-size: 0.6rem; }
        .sb__finished, .sb__soon {
          font-family: 'Barlow Condensed', sans-serif;
          font-size: 0.72rem;
          font-weight: 600;
          letter-spacing: 0.1em;
          text-transform: uppercase;
          color: #8a9099;
        }

        .sb__main {
          display: flex;
          align-items: center;
          justify-content: center;
          gap: clamp(16px, 4vw, 48px);
          padding: 18px 24px 22px;
        }
        .sb__team {
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: 8px;
          flex: 1;
          max-width: 180px;
        }
        .sb__team--away { align-items: center; }

        .sb__logo {
          width: 56px; height: 56px;
          border-radius: 10px;
          background: #181c22;
          border: 1px solid rgba(255,255,255,0.1);
          display: flex;
          align-items: center;
          justify-content: center;
          font-family: 'Barlow Condensed', sans-serif;
          font-size: 0.7rem;
          font-weight: 900;
          color: #8a9099;
          letter-spacing: 0.04em;
        }
        .sb__name {
          font-family: 'Barlow Condensed', sans-serif;
          font-size: clamp(0.85rem, 2.5vw, 1.05rem);
          font-weight: 800;
          letter-spacing: 0.03em;
          text-transform: uppercase;
          color: #f0f2f5;
          text-align: center;
          line-height: 1.1;
        }

        .sb__score-block {
          text-align: center;
          flex-shrink: 0;
        }
        .sb__score {
          display: flex;
          align-items: center;
          gap: 8px;
          justify-content: center;
        }
        .sb__num {
          font-family: 'Barlow Condensed', sans-serif;
          font-size: clamp(3rem, 8vw, 5rem);
          font-weight: 900;
          color: #f0f2f5;
          letter-spacing: -0.02em;
          line-height: 1;
          transition: color 0.3s ease;
        }
        .sb__num--win { color: #00e5ff; }
        .sb__sep {
          font-family: 'Barlow Condensed', sans-serif;
          font-size: clamp(2rem, 5vw, 3rem);
          font-weight: 400;
          color: #454a52;
          line-height: 1;
        }
        .sb__viewers {
          font-family: 'Barlow Condensed', sans-serif;
          font-size: 0.68rem;
          font-weight: 600;
          letter-spacing: 0.08em;
          text-transform: uppercase;
          color: #8a9099;
          margin-top: 6px;
        }
      `}</style>
    </div>
  );
}