import { prisma } from './prisma.js';
import { notifyMatchKickoff, withinKickoffWindow } from './notify.js';

const TICK_MS = 15 * 60 * 1000;

let running = false;
let timer: ReturnType<typeof setInterval> | null = null;

/** Marca y avisa partidos SCHEDULED en las próximas 24 h que aún no tuvieron recordatorio. */
export async function runMatchReminders(now = new Date()): Promise<number> {
  if (running) return 0;
  running = true;
  try {
    const until = new Date(now.getTime() + 24 * 60 * 60 * 1000);
    const matches = await prisma.match.findMany({
      where: {
        status: 'SCHEDULED',
        kickoffRemindedAt: null,
        scheduledAt: { gt: now, lte: until },
      },
      select: { id: true, scheduledAt: true },
    });

    let sent = 0;
    for (const match of matches) {
      if (!match.scheduledAt || !withinKickoffWindow(match.scheduledAt, now)) continue;
      await prisma.match.update({
        where: { id: match.id },
        data: { kickoffRemindedAt: now },
      });
      notifyMatchKickoff(match.id, 'reminder');
      sent += 1;
    }
    if (sent > 0) console.info('[mail:remind]', { sent });
    return sent;
  } finally {
    running = false;
  }
}

export function startMatchReminderJob(): void {
  if (timer) return;
  const tick = () => {
    void runMatchReminders().catch((err) => {
      console.error('[mail:remind]', err);
    });
  };
  tick();
  timer = setInterval(tick, TICK_MS);
  timer.unref?.();
}
