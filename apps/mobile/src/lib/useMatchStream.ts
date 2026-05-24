import { useEffect, useRef, useState } from 'react';
import type { WSMessage, MatchScore } from '@parches/types';
import { ENDPOINTS } from '@parches/config';

export function useMatchStream(matchId: string) {
  const [score, setScore] = useState<MatchScore>({ home: 0, away: 0 });
  const [isConnected, setIsConnected] = useState(false);
  useEffect(() => {
    const ws = new WebSocket(`${ENDPOINTS.STREAMING_DATA_WS}/matches/${matchId}`);
    ws.onopen = () => setIsConnected(true);
    ws.onclose = () => setIsConnected(false);
    ws.onmessage = (e) => {
      const msg = JSON.parse(e.data) as WSMessage;
      if (msg.type === 'score_update') setScore(msg.data as MatchScore);
    };
    return () => ws.close();
  }, [matchId]);
  return { score, isConnected };
}
