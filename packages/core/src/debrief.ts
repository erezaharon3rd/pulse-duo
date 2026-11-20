// תוצאות תחקור (אפיון 3.3, 1.13): עומס מפרקי בפועל לכל אדם, דקות וקלוריות.

import { displayRange, kcal, type Segment } from './calories.ts';
import type { SessionPlan } from './sessionBuilder.ts';
import { JOINTS, type Joint, type Pose } from './types.ts';

export interface DebriefResult {
  minutes: number;
  /** עומס מרבי שהופעל על כל מפרק אצל האדם הזה במפגש. */
  jointLoad: Record<Joint, number>;
  posesUsed: string[];
  kcal: { low: number; high: number };
}

export function debriefFor(plan: SessionPlan, userId: string, poses: Pose[], weightKg: number): DebriefResult {
  const byId = new Map(poses.map((p) => [p.poseId, p]));
  const jointLoad = Object.fromEntries(JOINTS.map((j) => [j, 0])) as Record<Joint, number>;
  const posesUsed: string[] = [];
  const segments: Segment[] = [];
  let minutes = 0;
  for (const s of plan.steps) {
    minutes += s.minutes;
    if (s.phase === 'warmup' || !s.assignment) {
      segments.push({ minutes: s.minutes, level: 'warmup' });
      continue;
    }
    segments.push({ minutes: s.minutes, level: plan.intensity });
    const pose = byId.get(s.assignment.poseId);
    if (!pose) continue;
    posesUsed.push(pose.poseId);
    const slot = s.assignment.moverUserId === userId ? pose.slots.mover : s.assignment.stabilizerUserId === userId ? pose.slots.stabilizer : null;
    if (!slot) continue;
    for (const j of JOINTS) jointLoad[j] = Math.max(jointLoad[j], slot.jointLoad[j] ?? 0);
  }
  return { minutes: Math.round(minutes * 10) / 10, jointLoad, posesUsed: [...new Set(posesUsed)], kcal: displayRange(kcal(weightKg, segments)) };
}

/** מתי לקבוע מפגש מניצוץ שנענה ב"כן". */
export function sparkSessionTime(reply: 'yes_now' | 'yes_hour' | 'yes_tonight', now: Date): Date {
  if (reply === 'yes_now') return new Date(now.getTime() + 5 * 60 * 1000);
  if (reply === 'yes_hour') return new Date(now.getTime() + 3600 * 1000);
  // "הערב": 19:00 UTC (21:00 בחורף, 22:00 בקיץ בישראל); אם כבר עבר – בעוד חצי שעה
  const t = new Date(now);
  t.setUTCHours(19, 0, 0, 0);
  return t.getTime() > now.getTime() ? t : new Date(now.getTime() + 30 * 60 * 1000);
}
