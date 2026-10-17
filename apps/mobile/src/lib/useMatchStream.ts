import { useEffect, useRef, useState } from 'react';
import type { WSMessage, MatchScore } from '@parches/types';
import { ENDPOINTS, matchWsUrl } from '@parches/config';

export function useMatchStream(matchId: string) {
  const [score, setScore] = useState<MatchScore>({ home: 0, away: 0 });
  const [isConnected, setIsConnected] = useState(false);
  useEffect(() => {
    const ws = new WebSocket(matchWsUrl(ENDPOINTS.STREAMING_DATA_WS, matchId));
    ws.onopen = () => setIsConnected(true);
    ws.onclose = () => setIsConnected(false);
    ws.onmessage = (e) => {
      const msg = JSON.parse(e.data) as WSMessage;
      if (msg.type === 'score_update') {
        const data = msg.data as { home?: number; away?: number; homeScore?: number; awayScore?: number };
        setScore({
          home: data.homeScore ?? data.home ?? 0,
          away: data.awayScore ?? data.away ?? 0,
        });
      }
    };
    return () => ws.close();
  }, [matchId]);
  return { score, isConnected };
}
