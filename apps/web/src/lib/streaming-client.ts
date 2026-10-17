import type { WSMessage } from '@parches/types';
import { ENDPOINTS } from '@parches/config';
import { subscribeMatchLive } from './matchLive';

export function connectToMatch(matchId: string, onMessage: (msg: WSMessage) => void): () => void {
  return subscribeMatchLive(matchId, ENDPOINTS.STREAMING_DATA_WS, msg => {
    onMessage(msg as WSMessage);
  });
}
