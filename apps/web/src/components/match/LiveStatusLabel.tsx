import { useState } from 'react';
import { statusFromLiveMessage, useMatchLive } from '../../lib/matchLive';

interface Props {
  matchId: string;
  wsUrl: string;
  status: 'LIVE' | 'SCHEDULED' | 'FINISHED';
}

export default function LiveStatusLabel({ matchId, wsUrl, status }: Props) {
  const [liveStatus, setLiveStatus] = useState(status);
  useMatchLive(matchId, wsUrl, liveStatus === 'LIVE', msg => {
    if (msg.matchId !== matchId) return;
    const next = statusFromLiveMessage(msg);
    if (next) setLiveStatus(next);
  });

  const label = liveStatus === 'LIVE'
    ? '● En vivo'
    : liveStatus === 'FINISHED'
      ? 'Finalizado'
      : 'Programado';

  return (
    <span
      className={[
        'match-info-card__value',
        liveStatus === 'LIVE' && 'match-info-card__value--live',
        liveStatus === 'FINISHED' && 'match-info-card__value--fin',
      ].filter(Boolean).join(' ')}
    >
      {label}
    </span>
  );
}
