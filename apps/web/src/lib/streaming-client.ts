import type { WSMessage } from '@parches/types';
import { ENDPOINTS } from '@parches/config';

export function connectToMatch(matchId: string, onMessage: (msg: WSMessage) => void): WebSocket {
  const ws = new WebSocket(`${ENDPOINTS.STREAMING_DATA_WS}/matches/${matchId}`);
  ws.onmessage = (e) => onMessage(JSON.parse(e.data) as WSMessage);
  return ws;
}
