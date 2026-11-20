// דרגות ורצף (אפיון 1.13, 9.2).

export type Feeling = 'rose' | 'there_from_start' | 'calm' | 'did_not_arise' | 'uncomfortable' | 'did_not_want';

export interface SessionOutcome {
  date: string; // ISO
  maxPain: number; // הכאב הגבוה מבין השניים
  feelings: Feeling[]; // של שניהם
}

export interface LevelInput {
  level: number; // 1–5
  levelSince: string; // ISO
  fitnessA: number;
  fitnessB: number;
  sessionsAtLevel: SessionOutcome[];
  connectionActionsAtLevel: number; // תודה / שאלת היום / בקשה
  lastSessionAt: string | null;
  gamificationPaused: boolean;
  now: Date;
}

const DAY = 24 * 3600 * 1000;

export function nextLevel(i: LevelInput): number {
  const lvl = i.level;
  // ירידה: כאב 4+ במפגש האחרון
  const last = i.sessionsAtLevel[i.sessionsAtLevel.length - 1];
  if (last && last.maxPain >= 4) return Math.max(1, lvl - 1);
  // ירידה: 3 שבועות בלי מפגש
  if (i.lastSessionAt && i.now.getTime() - new Date(i.lastSessionAt).getTime() >= 21 * DAY) {
    return Math.max(1, lvl - 1);
  }
  if (i.gamificationPaused) return lvl;
  const cap = Math.min(5, Math.min(i.fitnessA, i.fitnessB) + 1);
  if (lvl >= cap) return lvl;
  if (i.now.getTime() - new Date(i.levelSince).getTime() < 14 * DAY) return lvl;
  const good = i.sessionsAtLevel.filter(
    (s) => s.maxPain <= 2 && !s.feelings.includes('uncomfortable') && !s.feelings.includes('did_not_want'),
  );
  if (good.length >= 3 && i.connectionActionsAtLevel >= 3) return lvl + 1;
  return lvl;
}

/** שבוע קל: כל שבוע רביעי מאז תחילת הצימוד. */
export function isLightWeek(weekIndexSincePairing: number): boolean {
  return weekIndexSincePairing > 0 && (weekIndexSincePairing + 1) % 4 === 0;
}

export type WeekResult = 'goal_met' | 'not_today_or_frozen' | 'empty';

/** רצף: עלה כשעומדים ביעד, קפוא ב"לא היום"/הקפאה/שבוע קל, מתאפס בשבוע ריק. */
export function nextStreak(current: number, week: WeekResult, optedIn: boolean): number {
  if (!optedIn) return 0;
  if (week === 'goal_met') return current + 1;
  if (week === 'not_today_or_frozen') return current;
  return 0;
}
