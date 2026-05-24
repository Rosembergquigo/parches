// ─── Sports & Tournaments ────────────────────────────────────────
export type Sport = 'football' | 'basketball' | 'tennis' | 'volleyball' | 'baseball' | 'hockey';

export interface Tournament {
  id: string;
  name: string;
  sport: Sport;
  status: 'upcoming' | 'live' | 'finished';
  startDate: string;
  endDate: string;
  teams: Team[];
  currentMatch?: Match;
}

export interface Team {
  id: string;
  name: string;
  logoUrl?: string;
  players: Player[];
}

export interface Player {
  id: string;
  name: string;
  number: number;
  position: string;
}

// ─── Match & Streaming Events ────────────────────────────────────
export interface Match {
  id: string;
  tournamentId: string;
  homeTeam: Team;
  awayTeam: Team;
  score: MatchScore;
  status: 'scheduled' | 'live' | 'halftime' | 'finished';
  startedAt?: string;
  sport: Sport;
  streamKey?: string;      // For video streaming
  dataChannel?: string;    // For real-time data channel ID
}

export interface MatchScore {
  home: number;
  away: number;
  period?: number;          // Quarter, set, half, etc.
  periodLabel?: string;     // "Q1", "2nd Half", "Set 3"
  clock?: string;           // "12:34"
}

// ─── Referee Events (from iWatch / mobile app) ───────────────────
export type RefereeEventType =
  | 'goal'
  | 'yellow_card'
  | 'red_card'
  | 'foul'
  | 'timeout'
  | 'substitution'
  | 'period_start'
  | 'period_end'
  | 'score_update'
  | 'custom';

export interface RefereeEvent {
  id: string;
  matchId: string;
  type: RefereeEventType;
  timestamp: string;
  clock: string;
  teamId?: string;
  playerId?: string;
  payload?: Record<string, unknown>;
  refereeId: string;
}

// ─── Streaming ────────────────────────────────────────────────────
export interface StreamSession {
  id: string;
  matchId: string;
  type: 'data' | 'video';
  hlsUrl?: string;          // For video streaming (HLS manifest)
  wsChannel?: string;       // For data streaming (WebSocket channel)
  isLive: boolean;
  viewerCount?: number;
}

// ─── WebSocket Messages ───────────────────────────────────────────
export type WSMessageType = 'score_update' | 'event' | 'match_status' | 'ping';

export interface WSMessage<T = unknown> {
  type: WSMessageType;
  matchId: string;
  data: T;
  timestamp: string;
}
