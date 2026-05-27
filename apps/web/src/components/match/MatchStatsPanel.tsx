/**
 * MatchStatsPanel.tsx — estadísticas comparativas del partido.
 *
 * Barras horizontales proporcionales estilo ESPN:
 *   [home bar ████░░] LABEL [░░████ away bar]
 *
 * El ancho de cada barra es proporcional al valor relativo
 * entre los dos equipos (no al máximo posible absoluto).
 * Así siempre hay contraste visual incluso con números similares.
 *
 * higherIsBetter = false (faltas, errores) invierte qué color
 * resalta al equipo "mejor" en esa stat.
 *
 * Recibe stats tipadas desde el servidor — el deporte ya decidió
 * qué filas mostrar (MATCH_STATS_BY_SPORT en mock.ts).
 */

interface MatchStatRow {
  label: string;
  home: number;
  away: number;
  isPercentage?: boolean;
  higherIsBetter?: boolean;
}

interface Props {
  rows: MatchStatRow[];
  homeTeam: string;
  awayTeam: string;
  homeColor?: string;   // color de marca del torneo o cyan por defecto
}

export default function MatchStatsPanel({
  rows,
  homeTeam,
  awayTeam,
  homeColor = '#00e5ff',
}: Props) {
  // Calcular porcentajes para las barras
  function getPct(home: number, away: number): { homePct: number; awayPct: number } {
    const total = home + away;
    if (total === 0) return { homePct: 50, awayPct: 50 };
    return {
      homePct: Math.round((home / total) * 100),
      awayPct: Math.round((away / total) * 100),
    };
  }

  function formatVal(val: number, isPct?: boolean): string {
    return isPct ? `${val}%` : String(val);
  }

  // Quién gana esta stat
  function homeWinsRow(row: MatchStatRow): boolean {
    const higherBetter = row.higherIsBetter !== false;
    return higherBetter ? row.home > row.away : row.home < row.away;
  }
  function awayWinsRow(row: MatchStatRow): boolean {
    const higherBetter = row.higherIsBetter !== false;
    return higherBetter ? row.away > row.home : row.away < row.home;
  }

  return (
    <div className="msp">
      {/* Teams header */}
      <div className="msp__header">
        <span className="msp__team-name">{homeTeam.split(' ')[0]}</span>
        <span className="msp__header-label">Estadísticas del partido</span>
        <span className="msp__team-name msp__team-name--away">{awayTeam.split(' ')[0]}</span>
      </div>

      {/* Stat rows */}
      <div className="msp__rows">
        {rows.map((row, i) => {
          const { homePct, awayPct } = getPct(row.home, row.away);
          const hWins = homeWinsRow(row);
          const aWins = awayWinsRow(row);

          return (
            <div key={i} className="msp__row">
              {/* Home value */}
              <div className={`msp__val msp__val--home${hWins ? ' msp__val--win' : ''}`}
                style={hWins ? { color: homeColor } : {}}>
                {formatVal(row.home, row.isPercentage)}
              </div>

              {/* Bar track */}
              <div className="msp__bar-wrap">
                {/* Home bar — grows from center-left */}
                <div className="msp__bar-home">
                  <div
                    className="msp__bar-fill msp__bar-fill--home"
                    style={{
                      width: `${homePct}%`,
                      background: hWins ? homeColor : 'rgba(255,255,255,0.18)',
                    }}
                  />
                </div>

                {/* Label in center */}
                <div className="msp__label">{row.label}</div>

                {/* Away bar — grows from center-right */}
                <div className="msp__bar-away">
                  <div
                    className="msp__bar-fill msp__bar-fill--away"
                    style={{
                      width: `${awayPct}%`,
                      background: aWins ? '#f0f2f5' : 'rgba(255,255,255,0.18)',
                    }}
                  />
                </div>
              </div>

              {/* Away value */}
              <div className={`msp__val msp__val--away${aWins ? ' msp__val--win' : ''}`}>
                {formatVal(row.away, row.isPercentage)}
              </div>
            </div>
          );
        })}
      </div>

      <style>{`
        .msp {
          padding: 0 4px;
        }

        /* Header */
        .msp__header {
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding: 14px 16px 12px;
          border-bottom: 1px solid rgba(255,255,255,0.07);
          margin-bottom: 4px;
        }
        .msp__team-name {
          font-family: 'Barlow Condensed', sans-serif;
          font-size: 0.78rem;
          font-weight: 800;
          letter-spacing: 0.05em;
          text-transform: uppercase;
          color: #f0f2f5;
          min-width: 60px;
        }
        .msp__team-name--away { text-align: right; }
        .msp__header-label {
          font-family: 'Barlow Condensed', sans-serif;
          font-size: 0.62rem;
          font-weight: 600;
          letter-spacing: 0.1em;
          text-transform: uppercase;
          color: #454a52;
          text-align: center;
          flex: 1;
        }

        /* Rows */
        .msp__rows {
          display: flex;
          flex-direction: column;
          gap: 0;
        }
        .msp__row {
          display: grid;
          grid-template-columns: 44px 1fr 44px;
          align-items: center;
          gap: 8px;
          padding: 8px 16px;
          border-bottom: 1px solid rgba(255,255,255,0.04);
          transition: background 0.15s;
        }
        .msp__row:hover { background: rgba(255,255,255,0.025); }
        .msp__row:last-child { border-bottom: none; }

        /* Values */
        .msp__val {
          font-family: 'Barlow Condensed', sans-serif;
          font-size: 0.88rem;
          font-weight: 800;
          letter-spacing: 0.02em;
          color: #8a9099;
          transition: color 0.2s;
        }
        .msp__val--home { text-align: left; }
        .msp__val--away { text-align: right; }
        .msp__val--win  { /* color applied inline */ }

        /* Bar layout */
        .msp__bar-wrap {
          display: grid;
          grid-template-columns: 1fr auto 1fr;
          align-items: center;
          gap: 8px;
        }
        .msp__label {
          font-family: 'Barlow Condensed', sans-serif;
          font-size: 0.68rem;
          font-weight: 600;
          letter-spacing: 0.07em;
          text-transform: uppercase;
          color: #8a9099;
          text-align: center;
          white-space: nowrap;
          min-width: 120px;
          padding: 0 4px;
        }

        /* Home bar: right-aligned fill */
        .msp__bar-home {
          display: flex;
          justify-content: flex-end;
          height: 6px;
          background: rgba(255,255,255,0.06);
          border-radius: 3px 0 0 3px;
          overflow: hidden;
        }
        /* Away bar: left-aligned fill */
        .msp__bar-away {
          display: flex;
          justify-content: flex-start;
          height: 6px;
          background: rgba(255,255,255,0.06);
          border-radius: 0 3px 3px 0;
          overflow: hidden;
        }
        .msp__bar-fill {
          height: 100%;
          border-radius: 3px;
          transition: width 0.6s cubic-bezier(0.4, 0, 0.2, 1);
        }
        .msp__bar-fill--home { border-radius: 3px 0 0 3px; }
        .msp__bar-fill--away { border-radius: 0 3px 3px 0; }
      `}</style>
    </div>
  );
}
