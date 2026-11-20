// בניית מפגש (אפיון 2.2, 9.1). פונקציה טהורה – רצה בשרת בלבד.

import {
  BLOCKING_FLAGS,
  INTENSITY_ORDER,
  JOINTS,
  type Assignment,
  type Intensity,
  type Person,
  type Pose,
  type ScreeningFlag,
  type SlotSpec,
} from './types.ts';
import { jointThreshold, FRESH_JOINT, type JointState } from './load.ts';
import { passesLimits } from './spice.ts';

export interface BuildInput {
  a: Person;
  b: Person;
  energyA: Intensity;
  energyB: Intensity;
  poses: Pose[];
  level: number; // דרגת הצימוד 1–5
  spiceEffective: number;
  minutes: 15 | 30;
  /** poseId → תאריך שימוש אחרון בצימוד (ISO). */
  history: Record<string, string>;
  favorites: string[];
  jointsA?: Partial<Record<string, JointState>>;
  jointsB?: Partial<Record<string, JointState>>;
  lightWeek?: boolean;
  now: Date;
  rand?: () => number;
}

export type Phase = 'warmup' | 'work' | 'peak' | 'release';

export interface PlanStep {
  phase: Phase;
  startPct: number; // 0–100
  endPct: number;
  minutes: number;
  assignment?: Assignment; // ריק = נשימה / מגע / תנועתיות
  isNew?: boolean;
}

export interface SessionPlan {
  kind: 'full' | 'touch_only';
  intensity: Intensity;
  steps: PlanStep[];
  warmupJoints: string[];
}

const hasUncleared = (p: Person, f: ScreeningFlag) => p.flags.includes(f) && !p.clearedFlags.includes(f);

/** עצימות = המינימום של אנרגיה, תקרות אישיות וסינון. */
export function sessionIntensity(i: BuildInput): Intensity {
  const caps: Intensity[] = [i.energyA, i.energyB, i.a.intensityCapSelf, i.b.intensityCapSelf];
  for (const p of [i.a, i.b]) {
    if (hasUncleared(p, 'uncontrolled_bp_diabetes')) caps.push('recovery');
    if (hasUncleared(p, 'pelvic_floor')) caps.push('balanced');
  }
  if (i.lightWeek) caps.push('balanced');
  return caps.reduce((m, c) => (INTENSITY_ORDER[c] < INTENSITY_ORDER[m] ? c : m));
}

export function isBlocked(p: Person): boolean {
  return BLOCKING_FLAGS.some((f) => hasUncleared(p, f));
}

/** האם אדם יכול למלא תפקיד בתנוחה. כל המסננים יחד (אפיון 3, 9.1). */
export function personFitsSlot(p: Person, s: SlotSpec, joints: Partial<Record<string, JointState>> = {}, now = new Date()): boolean {
  for (const j of JOINTS) {
    if (s.jointLoad[j] > jointThreshold(p, j, joints[j] ?? FRESH_JOINT, now)) return false;
  }
  const back = p.limitations.lowerBack;
  if (back !== 'none') {
    // מגבלה קיימת או שעוד לא נשאל: סינון לפי סוג, ובלי סוג – רק נייטרלי
    const type = p.backType ?? 'unknown';
    if (type === 'flexion' && s.spineMotion === 'flexion') return false;
    if (type === 'extension' && s.spineMotion === 'extension') return false;
    if (type === 'unknown' && s.spineMotion !== 'neutral') return false;
  }
  if (hasUncleared(p, 'osteoporosis') && s.spineMotion === 'flexion') return false;
  if (p.flags.includes('hip_replacement')) {
    const ap = p.hipApproach ?? 'unknown';
    const post = s.hip.flexionOver90 || s.hip.crossMidline || s.hip.internalRotation;
    const ant = s.hip.extensionExternalRotation;
    if ((ap === 'posterior' || ap === 'unknown') && post) return false;
    if ((ap === 'anterior' || ap === 'unknown') && ant) return false;
  }
  if (p.flags.includes('knee_replacement') && s.kneeling) return false;
  if (p.flags.includes('hernia') && s.abdominalPressure) return false;
  if (p.flags.includes('eye') && s.headDown) return false;
  if (p.flags.includes('pregnancy') && (s.supine || s.abdominalPressure)) return false;
  return true;
}

const totalLoad = (s: SlotSpec) => JOINTS.reduce((t, j) => t + s.jointLoad[j], 0);

/** בדיקה ברמת שיבוץ: מחזיר את השיבוץ הבטוח עם העומס הנמוך, או null. */
export function bestAssignment(pose: Pose, i: BuildInput): Assignment | null {
  const options: { a: Assignment; load: number }[] = [];
  const tryOrient = (mover: Person, stab: Person, jm: BuildInput['jointsA'], js: BuildInput['jointsB']) => {
    if (personFitsSlot(mover, pose.slots.mover, jm, i.now) && personFitsSlot(stab, pose.slots.stabilizer, js, i.now)) {
      options.push({
        a: { poseId: pose.poseId, moverUserId: mover.userId, stabilizerUserId: stab.userId },
        load: totalLoad(pose.slots.mover) + totalLoad(pose.slots.stabilizer),
      });
    }
  };
  tryOrient(i.a, i.b, i.jointsA, i.jointsB);
  tryOrient(i.b, i.a, i.jointsB, i.jointsA);
  if (options.length === 0) return null;
  options.sort((x, y) => x.load - y.load);
  return options[0].a;
}

export function poseAllowed(pose: Pose, i: BuildInput, maxDifficulty: number): boolean {
  if (!pose.reviewedBy) return false;
  if (pose.difficulty > maxDifficulty) return false;
  if (pose.spice > i.spiceEffective) return false;
  if (!passesLimits(pose.tags, i.a.hardLimits, i.b.hardLimits)) return false;
  if (pose.penetrative && (hasUncleared(i.a, 'genital_pelvic_pain') || hasUncleared(i.b, 'genital_pelvic_pain'))) return false;
  if (pose.requiresStanding && !(i.a.standingOk && i.b.standingOk)) return false;
  return true;
}

const MAX_DIFFICULTY_BY_INTENSITY: Record<Intensity, number> = { recovery: 2, balanced: 4, high: 5 };

function noveltyScore(poseId: string, i: BuildInput, rand: () => number): number {
  const last = i.history[poseId];
  if (!last) return 1000 + rand();
  const days = (i.now.getTime() - new Date(last).getTime()) / (24 * 3600 * 1000);
  return days + rand();
}

function touchOnly(intensity: Intensity, minutes: number): SessionPlan {
  return {
    kind: 'touch_only',
    intensity,
    warmupJoints: [],
    steps: [
      { phase: 'warmup', startPct: 0, endPct: 30, minutes: Math.round(minutes * 0.3) },
      { phase: 'release', startPct: 30, endPct: 100, minutes: Math.round(minutes * 0.7) },
    ],
  };
}

export function buildSession(i: BuildInput): SessionPlan {
  const rand = i.rand ?? Math.random;
  const intensity = sessionIntensity(i);
  if (isBlocked(i.a) || isBlocked(i.b)) return touchOnly('recovery', i.minutes);

  const maxDiff = Math.min(i.level, MAX_DIFFICULTY_BY_INTENSITY[intensity]);
  const candidates = i.poses
    .filter((p) => poseAllowed(p, i, maxDiff))
    .map((p) => ({ pose: p, assignment: bestAssignment(p, i) }))
    .filter((c): c is { pose: Pose; assignment: Assignment } => c.assignment !== null);

  const needed = i.minutes === 15 ? 2 : 4;
  if (candidates.length < 2) return touchOnly(intensity, i.minutes);

  const scored = candidates
    .map((c) => ({ ...c, score: noveltyScore(c.pose.poseId, i, rand) }))
    .sort((x, y) => y.score - x.score);

  // שיא: הקושי הגבוה ביותר מבין המועמדים המובילים בחידוש
  const top = scored.slice(0, Math.max(needed + 2, 6));
  const peak = [...top].sort((x, y) => y.pose.difficulty - x.pose.difficulty || y.score - x.score)[0];
  const rest = scored.filter((c) => c !== peak);

  // פתיחה: שובבות 1–2, קושי לא גבוה מהשיא
  const openers = rest.filter((c) => c.pose.spice <= 2 && c.pose.difficulty <= peak.pose.difficulty);
  const workCount = i.minutes === 15 ? 1 : 2;
  const work = (openers.length >= workCount ? openers : rest.filter((c) => c.pose.difficulty <= peak.pose.difficulty))
    .slice(0, workCount)
    .sort((x, y) => x.pose.difficulty - y.pose.difficulty);
  if (work.length < workCount) return touchOnly(intensity, i.minutes);

  // שחרור (רק במפגש של 30 דק'): תנוחה רגועה, קושי ≤ 2
  const used = new Set([peak.pose.poseId, ...work.map((w) => w.pose.poseId)]);
  const release =
    i.minutes === 30
      ? rest.filter((c) => !used.has(c.pose.poseId) && c.pose.difficulty <= 2).sort((x, y) => x.pose.difficulty - y.pose.difficulty)[0]
      : undefined;

  const m = i.minutes;
  const steps: PlanStep[] = [{ phase: 'warmup', startPct: 0, endPct: 15, minutes: m * 0.15 }];
  const workSpan = 35 / work.length;
  work.forEach((w, k) =>
    steps.push({
      phase: 'work',
      startPct: 15 + k * workSpan,
      endPct: 15 + (k + 1) * workSpan,
      minutes: (m * 0.35) / work.length,
      assignment: w.assignment,
      isNew: !i.history[w.pose.poseId],
    }),
  );
  steps.push({
    phase: 'peak',
    startPct: 50,
    endPct: 70,
    minutes: m * 0.2,
    assignment: peak.assignment,
    isNew: !i.history[peak.pose.poseId],
  });
  steps.push({
    phase: 'release',
    startPct: 70,
    endPct: 100,
    minutes: m * 0.3,
    assignment: release?.assignment,
    isNew: release ? !i.history[release.pose.poseId] : undefined,
  });

  const chosen = [peak, ...work, ...(release ? [release] : [])];
  const warmupJoints = JOINTS.filter((j) =>
    chosen.some((c) => c.pose.slots.mover.jointLoad[j] > 0 || c.pose.slots.stabilizer.jointLoad[j] > 0),
  );

  return { kind: 'full', intensity, steps, warmupJoints };
}
