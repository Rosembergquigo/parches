/**
 * standings.ts — tabla de posiciones, tabla compilada de clasificados y
 * cruces sugeridos, calculados a partir de Match/Team reales.
 *
 * Espejo en el backend de la misma lógica que hoy vive en el mock del
 * frontend (apps/web/src/components/tournament/StandingsTable.astro):
 * mismo desempate (puntos → diferencia de gol → goles a favor → nombre)
 * y mismo algoritmo de cruces (1° vs último, 2° vs penúltimo... con bye
 * al equipo del medio si el total de clasificados es impar).
 *
 * Las standings NO se persisten: se recalculan siempre desde los Match
 * FINISHED, así una corrección de marcador se refleja al instante sin
 * tener que recalcular/cachear una tabla aparte.
 */
import type { Match, Team } from '@prisma/client';

export interface StandingsRow {
  position: number;
  team: Team;
  played: number;
  won: number;
  drawn: number;
  lost: number;
  goalsFor: number;
  goalsAgainst: number;
  points: number;
}

export interface QualifierRow extends StandingsRow {
  groupLabel: string;
}

export interface Crossmatch {
  seedA: number;
  seedB: number | null;
  teamA: QualifierRow;
  teamB: QualifierRow | null;
}

type MutableRow = Omit<StandingsRow, 'position'>;

/** Puntos: victoria 3, empate 1 (deportes sin empate simplemente nunca lo usan). */
export function computeStandings(teams: Team[], matches: Match[]): StandingsRow[] {
  const table = new Map<string, MutableRow>();
  for (const team of teams) {
    table.set(team.id, { team, played: 0, won: 0, drawn: 0, lost: 0, goalsFor: 0, goalsAgainst: 0, points: 0 });
  }

  for (const m of matches) {
    if (m.status !== 'FINISHED') continue;
    const home = table.get(m.homeTeamId);
    const away = table.get(m.awayTeamId);
    if (!home || !away) continue;

    home.played += 1;
    away.played += 1;
    home.goalsFor += m.homeScore;
    home.goalsAgainst += m.awayScore;
    away.goalsFor += m.awayScore;
    away.goalsAgainst += m.homeScore;

    if (m.homeScore > m.awayScore) {
      home.won += 1;
      home.points += 3;
      away.lost += 1;
    } else if (m.awayScore > m.homeScore) {
      away.won += 1;
      away.points += 3;
      home.lost += 1;
    } else {
      home.drawn += 1;
      away.drawn += 1;
      home.points += 1;
      away.points += 1;
    }
  }

  return [...table.values()]
    .sort(compareRows)
    .map((row, i) => ({ ...row, position: i + 1 }));
}

// Desempate estándar: puntos → diferencia de gol → goles a favor → nombre.
export function compareRows(a: MutableRow, b: MutableRow): number {
  if (b.points !== a.points) return b.points - a.points;
  const diffA = a.goalsFor - a.goalsAgainst;
  const diffB = b.goalsFor - b.goalsAgainst;
  if (diffB !== diffA) return diffB - diffA;
  if (b.goalsFor !== a.goalsFor) return b.goalsFor - a.goalsFor;
  return a.team.name.localeCompare(b.team.name);
}

/**
 * Tabla compilada: top `qualifyingSpots` de cada grupo, reordenados entre
 * sí y renumerados 1..N.
 */
export function computeCompiledQualifiers(
  groupStandings: { label: string; standings: StandingsRow[] }[],
  qualifyingSpots: number
): QualifierRow[] {
  return groupStandings
    .flatMap(g =>
      g.standings
        .filter(row => row.position <= qualifyingSpots)
        .map(row => ({ ...row, groupLabel: g.label }))
    )
    .sort(compareRows)
    .map((row, i) => ({ ...row, position: i + 1 }));
}

export interface CleanSheetRow {
  team: Team;
  played: number;
  cleanSheets: number;
  goalsAgainst: number;
}

/**
 * "Valla menos vencida" — partidos FINISHED en los que el equipo no
 * recibió goles, más el total de goles en contra como desempate.
 * Ordenado: más vallas invictas primero; a igualdad, menos goles en contra.
 */
export function computeCleanSheets(teams: Team[], matches: Match[]): CleanSheetRow[] {
  const table = new Map<string, CleanSheetRow>();
  for (const team of teams) {
    table.set(team.id, { team, played: 0, cleanSheets: 0, goalsAgainst: 0 });
  }

  for (const m of matches) {
    if (m.status !== 'FINISHED') continue;
    const home = table.get(m.homeTeamId);
    const away = table.get(m.awayTeamId);
    if (home) {
      home.played += 1;
      home.goalsAgainst += m.awayScore;
      if (m.awayScore === 0) home.cleanSheets += 1;
    }
    if (away) {
      away.played += 1;
      away.goalsAgainst += m.homeScore;
      if (m.homeScore === 0) away.cleanSheets += 1;
    }
  }

  return [...table.values()].sort((a, b) => {
    if (b.cleanSheets !== a.cleanSheets) return b.cleanSheets - a.cleanSheets;
    if (a.goalsAgainst !== b.goalsAgainst) return a.goalsAgainst - b.goalsAgainst;
    return a.team.name.localeCompare(b.team.name);
  });
}

/**
 * Cruces sobre la tabla compilada: 1° vs último, 2° vs penúltimo...
 * avanzando hacia el centro. Si el total es impar, el equipo del medio
 * clasifica directo (bye, `teamB: null`).
 */
export function computeCrossmatches(compiledTable: QualifierRow[]): Crossmatch[] {
  const n = compiledTable.length;
  const pairs: Crossmatch[] = [];
  for (let i = 0; i < Math.floor(n / 2); i++) {
    pairs.push({
      seedA: i + 1,
      seedB: n - i,
      teamA: compiledTable[i]!,
      teamB: compiledTable[n - 1 - i]!,
    });
  }
  if (n % 2 === 1) {
    const mid = Math.floor(n / 2);
    pairs.push({ seedA: mid + 1, seedB: null, teamA: compiledTable[mid]!, teamB: null });
  }
  return pairs;
}
