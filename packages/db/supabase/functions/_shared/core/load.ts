// נוצר אוטומטית מ-packages/core/src על ידי scripts/sync-core.mjs. לא לערוך כאן.
// ניהול עומס אישי ומפרקי בכל הצימודים יחד (אפיון 3.3, 9.1 שלב 4).

import type { Joint, Person, Severity } from './types.ts';

export type JointStatus = 'green' | 'yellow' | 'red';

export interface JointState {
  status: JointStatus;
  /** עד מתי המפרק נח (אחרי עומס 4+). */
  restUntil: string | null;
  /** כמה מפגשים נשארו בפרוטוקול חזרה (אחרי כאב 4+). */
  returnSessionsLeft: number;
  /** כמה פעמים דווח כאב 1–3 במפרק הזה. */
  mildPainCount: number;
}

export const FRESH_JOINT: JointState = { status: 'green', restUntil: null, returnSessionsLeft: 0, mildPainCount: 0 };

const BASE_THRESHOLD: Record<Severity, number> = { none: 5, mild: 2, severe: 0 };

/**
 * הסף המותר לעומס על מפרק אצל אדם. 0 = אסור כל עומס.
 * מגבלה שעוד לא נשאלה (undefined) מטופלת כ-"קלה" – המקרה הזהיר.
 */
export function jointThreshold(person: Person, joint: Joint, state: JointState = FRESH_JOINT, now = new Date()): number {
  const severity = person.limitations[joint] ?? 'mild';
  let t = BASE_THRESHOLD[severity];
  if (state.status === 'yellow') t = Math.max(0, t - 1);
  if (state.returnSessionsLeft > 0) t = Math.min(t, 2);
  if (state.restUntil && new Date(state.restUntil) > now) t = Math.min(t, 1);
  return t;
}

/** עומס מפגש = דקות × מאמץ (1–5). */
export function sessionLoad(minutes: number, effort: number): number {
  return minutes * effort;
}

export const DEFAULT_WEEKLY_CAP = 300; // למשל 3 מפגשים × 25 דק' × מאמץ 4

/** תקרה שבועית: עד 125% מהממוצע של 4 השבועות האחרונים. בפחות משבועיים היסטוריה – ברירת מחדל. */
export function weeklyCap(lastWeeksTotals: number[]): number {
  const weeks = lastWeeksTotals.slice(0, 4);
  if (weeks.length < 2) return DEFAULT_WEEKLY_CAP;
  const avg = weeks.reduce((a, b) => a + b, 0) / weeks.length;
  return Math.max(60, Math.round(avg * 1.25));
}

export function withinWeeklyCap(thisWeekSoFar: number, plannedLoad: number, cap: number): boolean {
  return thisWeekSoFar + plannedLoad <= cap;
}

/** אחרי מפגש: עדכון מצב מפרק לפי העומס שהופעל עליו והכאב שדווח. */
export function updateJoint(state: JointState, appliedLoad: number, pain: number, now: Date): JointState {
  const next: JointState = { ...state };
  if (next.returnSessionsLeft > 0) next.returnSessionsLeft -= 1;
  if (appliedLoad >= 4) next.restUntil = new Date(now.getTime() + 48 * 3600 * 1000).toISOString();
  if (pain >= 4) {
    next.status = 'red';
    next.returnSessionsLeft = 3;
    next.mildPainCount = 0;
  } else if (pain >= 1) {
    next.mildPainCount += 1;
    if (next.mildPainCount >= 2) next.status = 'yellow';
  } else if (next.status === 'red' && next.returnSessionsLeft === 0) {
    next.status = 'yellow';
  }
  return next;
}
