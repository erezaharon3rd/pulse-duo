// בדיקות קבלה מחלק 11 באפיון: סינון, בטיחות ועומס.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buildSession, personFitsSlot, bestAssignment, type BuildInput } from '../src/sessionBuilder.ts';
import { updateJoint, jointThreshold, weeklyCap, FRESH_JOINT } from '../src/load.ts';
import { library, person, pose, slot, seeded } from './fixtures.ts';

const now = new Date('2026-11-20T20:00:00Z');

function input(over: Partial<BuildInput> = {}): BuildInput {
  return {
    a: person('A'),
    b: person('B'),
    energyA: 'high',
    energyB: 'high',
    poses: library(),
    level: 5,
    spiceEffective: 5,
    minutes: 30,
    history: {},
    favorites: [],
    now,
    rand: seeded(),
    ...over,
  };
}

test('רגישות לכפיפת גב: לעולם לא מקבל תפקיד עם flexion', () => {
  const p = person('A', { limitations: { lowerBack: 'mild' }, backType: 'flexion' });
  assert.equal(personFitsSlot(p, slot({ spineMotion: 'flexion' })), false);
  assert.equal(personFitsSlot(p, slot({ spineMotion: 'extension' })), true);
  // בכל המפגשים שנבנים – אין שיבוץ כזה
  const poses = library().map((x, k) => ({ ...x, slots: { mover: slot({ spineMotion: k % 2 ? 'flexion' : 'neutral' }), stabilizer: slot({ spineMotion: 'flexion' }) } }));
  for (let s = 1; s < 30; s++) {
    const plan = buildSession(input({ a: p, poses, rand: seeded(s) }));
    for (const step of plan.steps) {
      if (!step.assignment) continue;
      const ps = poses.find((x) => x.poseId === step.assignment!.poseId)!;
      const slotOfA = step.assignment.moverUserId === 'A' ? ps.slots.mover : ps.slots.stabilizer;
      assert.notEqual(slotOfA.spineMotion, 'flexion');
    }
  }
});

test('גב שלא נשאל עליו = רק עמוד שדרה נייטרלי (המקרה הזהיר)', () => {
  const p = person('A', { limitations: {} });
  assert.equal(personFitsSlot(p, slot({ spineMotion: 'extension' })), false);
  assert.equal(personFitsSlot(p, slot({ spineMotion: 'neutral' })), true);
});

test('תנוחה שעוברת רק בשיבוצים שונים למסננים שונים נפסלת', () => {
  // A לא יכול כריעה (החלפת ברך), B לא יכול עומס על שורש כף יד.
  const a = person('A', { flags: ['knee_replacement'] });
  const b = person('B', { limitations: { wrists: 'severe' } });
  const tricky = pose('x', { slots: { mover: slot({ kneeling: true }, { wrists: 3 }), stabilizer: slot({ kneeling: true }, { wrists: 3 }) } });
  assert.equal(bestAssignment(tricky, input({ a, b })), null);
});

test('בוחרים את השיבוץ עם העומס הנמוך יותר כששניהם תקינים', () => {
  const p = pose('x', { slots: { mover: slot({}, { knees: 3 }), stabilizer: slot({}, { knees: 1 }) } });
  const a = person('A', { limitations: { knees: 'mild' } }); // סף 2: לא יכול מניע
  const r = bestAssignment(p, input({ a }));
  assert.deepEqual(r, { poseId: 'x', moverUserId: 'B', stabilizerUserId: 'A' });
});

test('כאב באזור המין או האגן: אין תנוחה עם חדירה', () => {
  const a = person('A', { flags: ['genital_pelvic_pain'] });
  const poses = library().map((p, k) => ({ ...p, penetrative: k % 2 === 0 }));
  for (let s = 1; s < 20; s++) {
    const plan = buildSession(input({ a, poses, rand: seeded(s) }));
    for (const step of plan.steps) {
      if (step.assignment) assert.equal(poses.find((p) => p.poseId === step.assignment!.poseId)!.penetrative, false);
    }
  }
});

test('דגל לבבי שלא אושר: רק נשימה ומגע', () => {
  const plan = buildSession(input({ a: person('A', { flags: ['cardiac'] }) }));
  assert.equal(plan.kind, 'touch_only');
  assert.equal(plan.steps.every((s) => !s.assignment), true);
  const cleared = buildSession(input({ a: person('A', { flags: ['cardiac'], clearedFlags: ['cardiac'] }) }));
  assert.equal(cleared.kind, 'full');
});

test('תנוחה שלא עברה סקירת פיזיותרפיה לא נכנסת', () => {
  const poses = library().map((p) => ({ ...p, reviewedBy: null }));
  assert.equal(buildSession(input({ poses })).kind, 'touch_only');
});

test('השיא תמיד בין 50% ל-70% מהמפגש, והוא הקשה ביותר', () => {
  for (const minutes of [15, 30] as const) {
    for (let s = 1; s < 25; s++) {
      const plan = buildSession(input({ minutes, rand: seeded(s) }));
      const peak = plan.steps.find((x) => x.phase === 'peak')!;
      assert.equal(peak.startPct, 50);
      assert.equal(peak.endPct, 70);
      const lib = library();
      const d = (id?: string) => lib.find((p) => p.poseId === id)?.difficulty ?? 0;
      for (const w of plan.steps.filter((x) => x.phase === 'work')) {
        assert.ok(d(w.assignment?.poseId) <= d(peak.assignment?.poseId));
      }
    }
  }
});

test('מאגר של 15 תנוחות: 12 התנוחות הראשונות לאורך מפגשים רצופים – בלי חזרה', () => {
  const poses = Array.from({ length: 15 }, (_, k) => pose(`q${k}`, { difficulty: ((k % 3) + 1) as 1 | 2 | 3 }));
  const history: Record<string, string> = {};
  const seen: string[] = [];
  for (let n = 0; n < 4; n++) {
    const day = new Date(now.getTime() + n * 86400000);
    const plan = buildSession(input({ poses, history: { ...history }, now: day, minutes: 30, rand: seeded(n + 3) }));
    for (const st of plan.steps) {
      if (!st.assignment) continue;
      seen.push(st.assignment.poseId);
      history[st.assignment.poseId] = day.toISOString();
    }
  }
  // 4 מפגשים × עד 4 תנוחות = עד 16; בתוך 12 הראשונות אין כפילות
  const first12 = seen.slice(0, 12);
  assert.equal(new Set(first12).size, first12.length);
});

test('מפרק במנוחה של 48 שעות לא מקבל עומס מעל 1, גם מצימוד אחר', () => {
  const st = updateJoint(FRESH_JOINT, 4, 0, now);
  const p = person('A');
  assert.equal(jointThreshold(p, 'knees', st, new Date(now.getTime() + 3600000)), 1);
  assert.equal(jointThreshold(p, 'knees', st, new Date(now.getTime() + 49 * 3600000)), 5);
});

test('כאב 4+ = פרוטוקול חזרה: עומס מקסימלי 2 בשלושת המפגשים הבאים', () => {
  let st = updateJoint(FRESH_JOINT, 2, 5, now);
  assert.equal(st.status, 'red');
  assert.equal(jointThreshold(person('A'), 'hips', st, now), 2);
  st = updateJoint(st, 1, 0, now);
  st = updateJoint(st, 1, 0, now);
  st = updateJoint(st, 1, 0, now);
  assert.equal(st.returnSessionsLeft, 0);
});

test('תקרה שבועית: 125% מהממוצע, ברירת מחדל בהתחלה', () => {
  assert.equal(weeklyCap([]), 300);
  assert.equal(weeklyCap([200, 200, 200, 200]), 250);
});

test('מגבלה חמורה = אפס עומס על המפרק', () => {
  const p = person('A', { limitations: { wrists: 'severe' } });
  assert.equal(personFitsSlot(p, slot({}, { wrists: 1 })), false);
  assert.equal(personFitsSlot(p, slot({}, { wrists: 0 })), true);
});
