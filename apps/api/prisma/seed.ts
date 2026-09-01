/**
 * seed.ts — datos de desarrollo para poder probar la API contra una DB real.
 *
 * Crea tres torneos:
 *  1. "Sudamericano de Vóleibol (seed)" — 3 grupos x 4 equipos, con
 *     partidos FINISHED y hasPlayoffs/qualifyingSpots configurados, para
 *     poder probar GET /tournaments/:id/standings (grupos + compilada +
 *     cruces) y POST /tournaments/:id/crossmatches/generate. También trae
 *     jugadores demo para GET /tournaments/:id/player-stats (Anotadores/Aces).
 *  2. "Liga de Prueba (seed)" — fútbol, sin grupos, para probar el camino
 *     de tabla única (torneos que no usan fase de grupos) y sus stats
 *     (Goleadores / Valla menos vencida).
 *  3. "Liga de Basquetbol (seed)" — basket, sin grupos, con jugadores demo
 *     para sus 3 tabs de stats (Anotadores / Reboteadores / Asistencias).
 *
 * Y usuarios demo para probar los perfiles (login simplificado, solo
 * por email — ver apps/api/src/routes/auth.ts):
 *  - Organizador: OWNER de la empresa "Parches Demo", que es dueña de
 *    los tres torneos seed. User.role sigue siendo VIEWER — organizar
 *    es membresía, no un rol de usuario.
 *  - Jugador (PLAYER): enrolado en un equipo de Liga de Prueba, con stats.
 *  - Árbitro (REFEREE): asignado a partidos de Liga de Prueba (uno
 *    FINISHED con eventos registrados, uno SCHEDULED próximo).
 *  - Goleadores/anotadores/atacantes de relleno repartidos en los equipos
 *    de cada torneo, solo para poblar GET /tournaments/:id/player-stats
 *    con datos reales y variados (ver SPORT_LEADERBOARDS en
 *    apps/api/src/routes/tournaments.ts).
 *
 * Re-ejecutable: si ya existen, los borra (en orden por FKs) y los
 * vuelve a crear desde cero. Los usuarios se wipean *después* de los
 * torneos — así cualquier Match que los referenciara como árbitro en
 * una corrida anterior ya fue borrado y el delete de User no choca
 * con la FK de Match.refereeId.
 *
 * Uso: pnpm --filter @parches/api db:seed
 */
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

const VOLEIBOL_NAME = 'Sudamericano de Vóleibol (seed)';
const VOLEIBOL_SLUG = 'sudamericano-voleibol-seed';
const LIGA_NAME = 'Liga de Prueba (seed)';
const LIGA_SLUG = 'liga-de-prueba-seed';
const BASKET_NAME = 'Liga de Basquetbol (seed)';
const BASKET_SLUG = 'liga-de-basquetbol-seed';
const DEMO_ORG_NAME = 'Parches Demo';
const DEMO_ORG_SLUG = 'parches-demo';
const ORGANIZER_EMAIL = 'organizador.demo@parches.app';

async function wipeTournament(name: string) {
  const existing = await prisma.tournament.findFirst({ where: { name } });
  if (!existing) return;

  // Las inscripciones de jugadores (seedDemoPlayer) referencian teamId/tournamentId
  // de una corrida anterior — hay que borrarlas antes de borrar los equipos o
  // choca con la FK. PlayerTournamentStat cae en cascada con el enrollment.
  await prisma.playerEnrollment.deleteMany({ where: { tournamentId: existing.id } });
  await prisma.matchEvent.deleteMany({ where: { match: { tournamentId: existing.id } } });
  await prisma.match.deleteMany({ where: { tournamentId: existing.id } });
  await prisma.team.deleteMany({ where: { tournamentId: existing.id } });
  await prisma.group.deleteMany({ where: { tournamentId: existing.id } });
  await prisma.tournament.delete({ where: { id: existing.id } });
}

/** Empresa dueña de los torneos seed. Se reusa entre corridas (no se borra
 *  mientras haya torneos colgando); los members se wipean para re-enrolar
 *  al organizador demo. */
async function upsertDemoOrg() {
  const existing = await prisma.organization.findUnique({ where: { slug: DEMO_ORG_SLUG } });
  if (existing) {
    await prisma.organizationMember.deleteMany({ where: { organizationId: existing.id } });
    return existing;
  }
  return prisma.organization.create({
    data: {
      name: DEMO_ORG_NAME,
      slug: DEMO_ORG_SLUG,
      city: 'Bogotá',
      brandColor: '#00e5ff',
      description: 'Empresa de prueba. Dueña de los torneos seed (fútbol, vóley y básquet).',
    },
  });
}

interface TeamSeed {
  key: string;
  name: string;
  shortName: string;
  color: string;
}

const GROUP_A: TeamSeed[] = [
  { key: 'bra', name: 'Brasil', shortName: 'BRA', color: '#009C3B' },
  { key: 'col', name: 'Colombia', shortName: 'COL', color: '#FCD116' },
  { key: 'per', name: 'Perú', shortName: 'PER', color: '#D91023' },
  { key: 'bol', name: 'Bolivia', shortName: 'BOL', color: '#007934' },
];
const GROUP_B: TeamSeed[] = [
  { key: 'arg', name: 'Argentina', shortName: 'ARG', color: '#75AADB' },
  { key: 'chi', name: 'Chile', shortName: 'CHI', color: '#D52B1E' },
  { key: 'ecu', name: 'Ecuador', shortName: 'ECU', color: '#FFDD00' },
  { key: 'par', name: 'Paraguay', shortName: 'PAR', color: '#D52B1E' },
];
const GROUP_C: TeamSeed[] = [
  { key: 'ven', name: 'Venezuela', shortName: 'VEN', color: '#FFCC00' },
  { key: 'uru', name: 'Uruguay', shortName: 'URU', color: '#75AADB' },
  { key: 'mex', name: 'México', shortName: 'MEX', color: '#006847' },
  { key: 'pan', name: 'Panamá', shortName: 'PAN', color: '#DA121A' },
];

// Resultados de todos-contra-todos dentro del grupo (índices sobre el array del grupo).
// [homeIdx, awayIdx, homeScore, awayScore]
const ROUND_ROBIN_4: [number, number, number, number][] = [
  [0, 1, 3, 1],
  [0, 2, 3, 0],
  [0, 3, 3, 1],
  [1, 2, 3, 1],
  [1, 3, 3, 2],
  [2, 3, 3, 1],
];

async function seedVoleibol(organizationId: string) {
  await wipeTournament(VOLEIBOL_NAME);

  const tournament = await prisma.tournament.create({
    data: {
      name: VOLEIBOL_NAME,
      slug: VOLEIBOL_SLUG,
      sport: 'volleyball',
      status: 'LIVE',
      startDate: new Date(),
      endDate: new Date(Date.now() + 21 * 24 * 60 * 60 * 1000),
      description: 'Fase de grupos con datos de prueba — 3 grupos de 4 selecciones.',
      hasPlayoffs: true,
      qualifyingSpots: 2,
      organizationId,
    },
  });

  const groupDefs = [
    { label: 'Grupo A', teams: GROUP_A },
    { label: 'Grupo B', teams: GROUP_B },
    { label: 'Grupo C', teams: GROUP_C },
  ];

  // Se guardan por `key` (bra, col, arg...) para poder enrolar jugadores
  // demo después sin depender del orden de creación.
  const teamsByKey: Record<string, Awaited<ReturnType<typeof prisma.team.create>>> = {};

  for (const [order, { label, teams }] of groupDefs.entries()) {
    const group = await prisma.group.create({
      data: { tournamentId: tournament.id, label, order },
    });

    const createdTeams = await Promise.all(
      teams.map(t =>
        prisma.team.create({
          data: {
            name: t.name,
            shortName: t.shortName,
            color: t.color,
            tournamentId: tournament.id,
            groupId: group.id,
          },
        })
      )
    );
    createdTeams.forEach((team, i) => { teamsByKey[teams[i]!.key] = team; });

    // El último partido de Grupo C queda como "próximo" en vez de FINISHED,
    // para tener variedad de estados (útil en el home / live strip).
    const isLastGroup = order === groupDefs.length - 1;

    for (const [i, [homeIdx, awayIdx, homeScore, awayScore]] of ROUND_ROBIN_4.entries()) {
      const isUpcoming = isLastGroup && i === ROUND_ROBIN_4.length - 1;
      await prisma.match.create({
        data: {
          tournamentId: tournament.id,
          homeTeamId: createdTeams[homeIdx]!.id,
          awayTeamId: createdTeams[awayIdx]!.id,
          homeScore: isUpcoming ? 0 : homeScore,
          awayScore: isUpcoming ? 0 : awayScore,
          status: isUpcoming ? 'SCHEDULED' : 'FINISHED',
          stage: label,
          scheduledAt: isUpcoming ? new Date(Date.now() + 4 * 24 * 60 * 60 * 1000) : undefined,
        },
      });
    }
  }

  console.log(`✅ ${VOLEIBOL_NAME} — 3 grupos, 12 equipos, 17 partidos FINISHED + 1 SCHEDULED`);
  return { id: tournament.id, teamsByKey };
}

interface VolleyballScorerSeed {
  email: string;
  name: string;
  teamKey: string;
  points: number;
  aces: number;
  blocks: number;
  attacks: number;
  matchesPlayed: number;
  jerseyNumber: number;
  position: string;
}

// Anotadores demo repartidos entre selecciones de distintos grupos, para
// poblar los tabs "Anotadores" / "Aces" de GET .../player-stats.
const VOLLEYBALL_SCORERS_SEED: VolleyballScorerSeed[] = [
  { email: 'voley1.demo@parches.app', name: 'Yeisson Gómez',    teamKey: 'col', points: 18, aces: 4, blocks: 2, attacks: 14, matchesPlayed: 6, jerseyNumber: 7,  position: 'Opuesto' },
  { email: 'voley2.demo@parches.app', name: 'Wallace Souza',    teamKey: 'bra', points: 16, aces: 3, blocks: 3, attacks: 12, matchesPlayed: 6, jerseyNumber: 10, position: 'Punta' },
  { email: 'voley3.demo@parches.app', name: 'Facundo Conte',    teamKey: 'arg', points: 15, aces: 5, blocks: 1, attacks: 11, matchesPlayed: 6, jerseyNumber: 17, position: 'Opuesto' },
  { email: 'voley4.demo@parches.app', name: 'Luis Díaz',        teamKey: 'per', points: 12, aces: 2, blocks: 4, attacks: 9,  matchesPlayed: 6, jerseyNumber: 3,  position: 'Central' },
  { email: 'voley5.demo@parches.app', name: 'Bruno Rezende',    teamKey: 'bra', points: 9,  aces: 6, blocks: 0, attacks: 5,  matchesPlayed: 6, jerseyNumber: 1,  position: 'Armador' },
];

/** Jugadores de relleno con stats variadas — solo para poblar Anotadores/Aces del Sudamericano. */
async function seedDemoVolleyballScorers(
  teamsByKey: Record<string, { id: string; name: string }>,
  tournamentId: string
) {
  for (const s of VOLLEYBALL_SCORERS_SEED) {
    await wipeUserByEmail(s.email);
    const team = teamsByKey[s.teamKey]!;
    await prisma.user.create({
      data: {
        email: s.email,
        name: s.name,
        role: 'PLAYER',
        playerProfile: {
          create: {
            enrollments: {
              create: {
                teamId: team.id,
                tournamentId,
                jerseyNumber: s.jerseyNumber,
                position: s.position,
                isActive: true,
                tournamentStats: {
                  create: {
                    matchesPlayed: s.matchesPlayed,
                    stats: { points: s.points, aces: s.aces, blocks: s.blocks, attacks: s.attacks },
                  },
                },
              },
            },
          },
        },
      },
    });
  }
  console.log(`✅ ${VOLLEYBALL_SCORERS_SEED.length} anotadores demo repartidos en ${VOLEIBOL_NAME}`);
}

const LIGA_TEAMS: TeamSeed[] = [
  { key: 'nal', name: 'Atlético Nacional', shortName: 'NAL', color: '#159F42' },
  { key: 'mil', name: 'Millonarios FC', shortName: 'MIL', color: '#005BAA' },
  { key: 'med', name: 'Independiente Medellín', shortName: 'MED', color: '#E4572E' },
  { key: 'san', name: 'Santa Fe', shortName: 'SAN', color: '#E4032B' },
];

/** Estadísticas comparativas de ejemplo para un partido de fútbol ya jugado (o en curso). */
function footballStats(homeScore: number, awayScore: number) {
  const homeShots = 8 + homeScore * 3;
  const awayShots = 8 + awayScore * 3;
  const totalShots = homeShots + awayShots;
  const homePossession = totalShots > 0 ? Math.round((homeShots / totalShots) * 100) : 50;

  return [
    { label: 'Remates',            home: homeShots, away: awayShots, higherIsBetter: true },
    { label: 'Remates al arco',    home: Math.max(homeScore, Math.round(homeShots * 0.4)), away: Math.max(awayScore, Math.round(awayShots * 0.4)), higherIsBetter: true },
    { label: 'Posesión',           home: homePossession, away: 100 - homePossession, isPercentage: true, higherIsBetter: true },
    { label: 'Pases',              home: 320 + homeShots * 8, away: 300 + awayShots * 8, higherIsBetter: true },
    { label: 'Precisión de pases', home: 82, away: 76, isPercentage: true, higherIsBetter: true },
    { label: 'Faltas',             home: 10, away: 12, higherIsBetter: false },
    { label: 'Tarjetas amarillas', home: 2, away: 3, higherIsBetter: false },
    { label: 'Tiros de esquina',   home: 5, away: 4, higherIsBetter: true },
  ];
}

async function seedLiga(organizationId: string) {
  await wipeTournament(LIGA_NAME);

  const tournament = await prisma.tournament.create({
    data: {
      name: LIGA_NAME,
      slug: LIGA_SLUG,
      sport: 'football',
      status: 'LIVE',
      startDate: new Date(),
      endDate: new Date(Date.now() + 60 * 24 * 60 * 60 * 1000),
      description: 'Torneo de prueba sin fase de grupos — tabla única.',
      hasPlayoffs: false,
      brandColor: '#00e5ff',
      // Ejemplo de imagen de fondo del header (progressive enhancement —
      // si el organizador no la sube, el header cae al gradiente de brandColor).
      backgroundImageUrl:
        'https://images.unsplash.com/photo-1522778119026-d647f0596c20?auto=format&fit=crop&w=1600&q=60',
      organizationId,
    },
  });

  const teams = await Promise.all(
    LIGA_TEAMS.map(t =>
      prisma.team.create({
        data: { name: t.name, shortName: t.shortName, color: t.color, tournamentId: tournament.id },
      })
    )
  );

  // Últimos dos partidos del round-robin quedan LIVE / SCHEDULED en vez de
  // FINISHED, para que el home / live strip tengan contenido real que mostrar.
  const lastIdx = ROUND_ROBIN_4.length - 1;
  for (const [i, [homeIdx, awayIdx, homeScore, awayScore]] of ROUND_ROBIN_4.entries()) {
    const isLive = i === lastIdx;
    await prisma.match.create({
      data: {
        tournamentId: tournament.id,
        homeTeamId: teams[homeIdx]!.id,
        awayTeamId: teams[awayIdx]!.id,
        homeScore: isLive ? Math.min(homeScore, 1) : homeScore,
        awayScore: isLive ? Math.min(awayScore, 1) : awayScore,
        status: isLive ? 'LIVE' : 'FINISHED',
        clock: isLive ? "58'" : undefined,
        period: isLive ? '2do Tiempo' : undefined,
        venue: isLive ? 'Est. de prueba' : undefined,
        streamKey: isLive ? `seed-live-${teams[homeIdx]!.id}` : undefined,
        stage: 'Jornada única (seed)',
        stats: footballStats(
          isLive ? Math.min(homeScore, 1) : homeScore,
          isLive ? Math.min(awayScore, 1) : awayScore,
        ),
      },
    });
  }

  // Partido adicional SCHEDULED (revancha), para tener también una card "próximo partido".
  await prisma.match.create({
    data: {
      tournamentId: tournament.id,
      homeTeamId: teams[3]!.id,
      awayTeamId: teams[0]!.id,
      status: 'SCHEDULED',
      scheduledAt: new Date(Date.now() + 3 * 24 * 60 * 60 * 1000),
      venue: 'Est. de prueba',
      stage: 'Jornada única (seed)',
    },
  });

  console.log(`✅ ${LIGA_NAME} — 4 equipos, tabla única, 5 FINISHED + 1 LIVE + 1 SCHEDULED`);

  const finalMatches = await prisma.match.findMany({ where: { tournamentId: tournament.id } });
  return { id: tournament.id, teams, matches: finalMatches };
}

const BASKET_TEAMS: TeamSeed[] = [
  { key: 'hal', name: 'Halcones de Bogotá',      shortName: 'HAL', color: '#1D4ED8' },
  { key: 'tib', name: 'Tiburones de Medellín',   shortName: 'TIB', color: '#0EA5E9' },
  { key: 'agu', name: 'Águilas de Cali',         shortName: 'AGU', color: '#F97316' },
  { key: 'tor', name: 'Toros de Barranquilla',   shortName: 'TOR', color: '#DC2626' },
];

// Marcadores realistas de basket en vez de reusar ROUND_ROBIN_4 (pensado
// para fútbol/vóley) — [homeIdx, awayIdx, homeScore, awayScore].
const BASKET_ROUND_ROBIN: [number, number, number, number][] = [
  [0, 1, 88, 76],
  [0, 2, 91, 85],
  [0, 3, 102, 94],
  [1, 2, 79, 82],
  [1, 3, 90, 88],
  [2, 3, 95, 90],
];

async function seedBasketball(organizationId: string) {
  await wipeTournament(BASKET_NAME);

  const tournament = await prisma.tournament.create({
    data: {
      name: BASKET_NAME,
      slug: BASKET_SLUG,
      sport: 'basketball',
      status: 'LIVE',
      startDate: new Date(),
      endDate: new Date(Date.now() + 45 * 24 * 60 * 60 * 1000),
      description: 'Torneo de prueba de basquetbol — tabla única, para probar Anotadores/Reboteadores/Asistencias.',
      hasPlayoffs: false,
      brandColor: '#f97316',
      organizationId,
    },
  });

  const teams = await Promise.all(
    BASKET_TEAMS.map(t =>
      prisma.team.create({
        data: { name: t.name, shortName: t.shortName, color: t.color, tournamentId: tournament.id },
      })
    )
  );

  // Igual que en Liga de Prueba: el último partido queda LIVE, el resto FINISHED.
  const lastIdx = BASKET_ROUND_ROBIN.length - 1;
  for (const [i, [homeIdx, awayIdx, homeScore, awayScore]] of BASKET_ROUND_ROBIN.entries()) {
    const isLive = i === lastIdx;
    await prisma.match.create({
      data: {
        tournamentId: tournament.id,
        homeTeamId: teams[homeIdx]!.id,
        awayTeamId: teams[awayIdx]!.id,
        homeScore: isLive ? Math.round(homeScore * 0.7) : homeScore,
        awayScore: isLive ? Math.round(awayScore * 0.7) : awayScore,
        status: isLive ? 'LIVE' : 'FINISHED',
        clock: isLive ? '3er Cuarto' : undefined,
        period: isLive ? '3Q' : undefined,
        venue: isLive ? 'Coliseo de prueba' : undefined,
        streamKey: isLive ? `seed-live-${teams[homeIdx]!.id}` : undefined,
        stage: 'Jornada única (seed)',
      },
    });
  }

  console.log(`✅ ${BASKET_NAME} — 4 equipos, tabla única, 5 FINISHED + 1 LIVE`);
  return { id: tournament.id, teams };
}

interface BasketballScorerSeed {
  email: string;
  name: string;
  teamIdx: number;
  points: number;
  rebounds: number;
  assists: number;
  steals: number;
  blocks: number;
  matchesPlayed: number;
  jerseyNumber: number;
  position: string;
}

// Repartidos entre los 4 equipos con perfiles distintos (anotador, reboteador,
// asistente...) para que los 3 tabs de stats muestren líderes distintos.
const BASKETBALL_SCORERS_SEED: BasketballScorerSeed[] = [
  { email: 'basket1.demo@parches.app', name: 'Cristian Vargas', teamIdx: 0, points: 24, rebounds: 5,  assists: 8, steals: 2, blocks: 0, matchesPlayed: 5, jerseyNumber: 23, position: 'Base' },
  { email: 'basket2.demo@parches.app', name: 'Julián Restrepo', teamIdx: 1, points: 22, rebounds: 10, assists: 3, steals: 1, blocks: 2, matchesPlayed: 5, jerseyNumber: 11, position: 'Ala-pívot' },
  { email: 'basket3.demo@parches.app', name: 'Esteban Duque',   teamIdx: 2, points: 19, rebounds: 12, assists: 2, steals: 1, blocks: 3, matchesPlayed: 5, jerseyNumber: 44, position: 'Pívot' },
  { email: 'basket4.demo@parches.app', name: 'Camilo Ríos',     teamIdx: 3, points: 17, rebounds: 4,  assists: 9, steals: 3, blocks: 0, matchesPlayed: 5, jerseyNumber: 5,  position: 'Base' },
  { email: 'basket5.demo@parches.app', name: 'Daniel Zapata',   teamIdx: 0, points: 15, rebounds: 6,  assists: 4, steals: 2, blocks: 1, matchesPlayed: 5, jerseyNumber: 8,  position: 'Escolta' },
  { email: 'basket6.demo@parches.app', name: 'Felipe Osorio',   teamIdx: 2, points: 12, rebounds: 3,  assists: 5, steals: 1, blocks: 0, matchesPlayed: 5, jerseyNumber: 14, position: 'Alero' },
];

/** Jugadores de relleno con stats variadas — solo para poblar Anotadores/Reboteadores/Asistencias. */
async function seedDemoBasketballScorers(teams: { id: string; name: string }[], tournamentId: string) {
  for (const s of BASKETBALL_SCORERS_SEED) {
    await wipeUserByEmail(s.email);
    const team = teams[s.teamIdx]!;
    await prisma.user.create({
      data: {
        email: s.email,
        name: s.name,
        role: 'PLAYER',
        playerProfile: {
          create: {
            nationality: 'COL',
            enrollments: {
              create: {
                teamId: team.id,
                tournamentId,
                jerseyNumber: s.jerseyNumber,
                position: s.position,
                isActive: true,
                tournamentStats: {
                  create: {
                    matchesPlayed: s.matchesPlayed,
                    stats: { points: s.points, rebounds: s.rebounds, assists: s.assists, steals: s.steals, blocks: s.blocks },
                  },
                },
              },
            },
          },
        },
      },
    });
  }
  console.log(`✅ ${BASKETBALL_SCORERS_SEED.length} anotadores demo repartidos en ${BASKET_NAME}`);
}

// ── Usuarios demo (perfiles) ──────────────────────────────────

const PLAYER_EMAIL = 'jugador.demo@parches.app';
const REFEREE_EMAIL = 'arbitro.demo@parches.app';

async function wipeUserByEmail(email: string) {
  const existing = await prisma.user.findUnique({ where: { email } });
  if (!existing) return;
  // Cascada: User -> PlayerProfile -> PlayerEnrollment -> PlayerTournamentStat.
  await prisma.user.delete({ where: { id: existing.id } });
}

/** Jugador enrolado en `team`, con stats de ejemplo — también llena la Plantilla del equipo. */
async function seedDemoPlayer(team: { id: string; name: string }, tournamentId: string) {
  await wipeUserByEmail(PLAYER_EMAIL);

  const user = await prisma.user.create({
    data: {
      email: PLAYER_EMAIL,
      name: 'Danilo Torres',
      role: 'PLAYER',
      bio: 'Delantero. Juego fútbol desde los 8 años.',
      playerProfile: {
        create: {
          nationality: 'COL',
          dateOfBirth: new Date('2000-03-14'),
          height: 181,
          weight: 76,
          enrollments: {
            create: {
              teamId: team.id,
              tournamentId,
              jerseyNumber: 11,
              position: 'Delantero',
              isActive: true,
              tournamentStats: {
                create: {
                  matchesPlayed: 5,
                  stats: { goals: 7, assists: 3, yellowCards: 2, redCards: 0, minutesPlayed: 430 },
                },
              },
            },
          },
        },
      },
    },
  });

  console.log(`✅ Jugador demo: ${user.name} (${user.email}) — enrolado en ${team.name}`);
  return user;
}

interface ScorerSeed {
  email: string;
  name: string;
  teamIdx: number;
  goals: number;
  assists: number;
  matchesPlayed: number;
  jerseyNumber: number;
  position: string;
}

// Goleadores adicionales repartidos entre los 4 equipos de Liga de Prueba,
// para que la tabla de "Goleadores" tenga variedad real (no un solo jugador).
const SCORERS_SEED: ScorerSeed[] = [
  { email: 'goleador1.demo@parches.app', name: 'Mateo Rentería',  teamIdx: 0, goals: 6, assists: 2, matchesPlayed: 5, jerseyNumber: 9,  position: 'Delantero' },
  { email: 'goleador2.demo@parches.app', name: 'Luis Ibarra',     teamIdx: 1, goals: 5, assists: 1, matchesPlayed: 5, jerseyNumber: 7,  position: 'Delantero' },
  { email: 'goleador3.demo@parches.app', name: 'Andrés Cadavid',  teamIdx: 2, goals: 4, assists: 3, matchesPlayed: 5, jerseyNumber: 10, position: 'Mediocampista' },
  { email: 'goleador4.demo@parches.app', name: 'Kevin Palacios',  teamIdx: 3, goals: 3, assists: 0, matchesPlayed: 5, jerseyNumber: 17, position: 'Delantero' },
  { email: 'goleador5.demo@parches.app', name: 'Sergio Otálvaro', teamIdx: 1, goals: 2, assists: 4, matchesPlayed: 5, jerseyNumber: 21, position: 'Mediocampista' },
];

/** Jugadores de relleno con stats variadas — solo para poblar la tabla de Goleadores. */
async function seedDemoScorers(teams: { id: string; name: string }[], tournamentId: string) {
  for (const s of SCORERS_SEED) {
    await wipeUserByEmail(s.email);
    const team = teams[s.teamIdx]!;
    await prisma.user.create({
      data: {
        email: s.email,
        name: s.name,
        role: 'PLAYER',
        playerProfile: {
          create: {
            nationality: 'COL',
            enrollments: {
              create: {
                teamId: team.id,
                tournamentId,
                jerseyNumber: s.jerseyNumber,
                position: s.position,
                isActive: true,
                tournamentStats: {
                  create: {
                    matchesPlayed: s.matchesPlayed,
                    stats: { goals: s.goals, assists: s.assists, yellowCards: 0, redCards: 0, minutesPlayed: s.matchesPlayed * 80 },
                  },
                },
              },
            },
          },
        },
      },
    });
  }
  console.log(`✅ ${SCORERS_SEED.length} goleadores demo repartidos en ${LIGA_NAME}`);
}

/** Árbitro asignado a un par de partidos de Liga de Prueba (uno jugado, uno próximo). */
async function seedDemoReferee(matches: { id: string; status: string }[]) {
  await wipeUserByEmail(REFEREE_EMAIL);

  const user = await prisma.user.create({
    data: {
      email: REFEREE_EMAIL,
      name: 'Jorge Ospina',
      role: 'REFEREE',
      bio: 'Árbitro certificado. Liga de Prueba y torneos amateur.',
    },
  });

  const finished = matches.filter(m => m.status === 'FINISHED').slice(0, 2);
  const scheduled = matches.filter(m => m.status === 'SCHEDULED').slice(0, 1);

  await prisma.$transaction(
    [...finished, ...scheduled].map(m =>
      prisma.match.update({ where: { id: m.id }, data: { refereeId: user.id } })
    )
  );

  if (finished.length > 0) {
    await prisma.matchEvent.createMany({
      data: finished.flatMap(m => [
        { matchId: m.id, type: 'period_start', clock: "0'", description: 'Inicio del partido', refereeId: user.id },
        { matchId: m.id, type: 'period_end', clock: "90'", description: 'Fin del partido', refereeId: user.id },
      ]),
    });
  }

  console.log(
    `✅ Árbitro demo: ${user.name} (${user.email}) — ${finished.length} partido(s) finalizado(s) + ${scheduled.length} próximo(s)`
  );
  return user;
}

/** Dueño de Parches Demo. User.role = VIEWER: organizar es la membresía OWNER. */
async function seedDemoOrganizer(organizationId: string) {
  await wipeUserByEmail(ORGANIZER_EMAIL);

  const user = await prisma.user.create({
    data: {
      email: ORGANIZER_EMAIL,
      name: 'Laura Méndez',
      role: 'VIEWER',
      bio: 'Organizo ligas amateur en Bogotá.',
      memberships: {
        create: { organizationId, role: 'OWNER' },
      },
    },
  });

  console.log(`✅ Organizador demo: ${user.name} (${user.email}) — OWNER de ${DEMO_ORG_NAME}`);
  return user;
}

const demoOrg = await upsertDemoOrg();
const voleibol = await seedVoleibol(demoOrg.id);
const liga = await seedLiga(demoOrg.id);
const basket = await seedBasketball(demoOrg.id);

const demoPlayer = await seedDemoPlayer(liga.teams[0]!, liga.id);
await seedDemoScorers(liga.teams, liga.id);
await seedDemoVolleyballScorers(voleibol.teamsByKey, voleibol.id);
await seedDemoBasketballScorers(basket.teams, basket.id);
const demoReferee = await seedDemoReferee(liga.matches);
const demoOrganizer = await seedDemoOrganizer(demoOrg.id);

console.log('\nProbar con:');
console.log(`  curl http://localhost:3000/api/tournaments/${voleibol.id}/standings | jq`);
console.log(`  curl -X POST http://localhost:3000/api/tournaments/${voleibol.id}/crossmatches/generate | jq`);
console.log(`  curl http://localhost:3000/api/tournaments/${voleibol.id}/player-stats | jq`);
console.log(`  curl http://localhost:3000/api/tournaments/${liga.id}/standings | jq`);
console.log(`  curl http://localhost:3000/api/tournaments/${liga.id}/player-stats | jq`);
console.log(`  curl http://localhost:3000/api/tournaments/${basket.id}/player-stats | jq`);
console.log(`  curl http://localhost:3000/api/organizations/${demoOrg.slug} | jq`);
console.log('\nUsuarios demo (login solo con email, sin password — POST /api/auth/login):');
console.log(`  Organizador: ${demoOrganizer.email}  → GET /api/organizations/me`);
console.log(`  Jugador:     ${demoPlayer.email}  → GET /api/users/${demoPlayer.id}`);
console.log(`  Árbitro:     ${demoReferee.email}  → GET /api/users/${demoReferee.id}`);

await prisma.$disconnect();
