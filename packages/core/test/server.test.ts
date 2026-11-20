// כללים שפונקציות השרת החדשות נשענות עליהם.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { canSendChannel, cardText, CHANNEL_DAILY_LIMIT } from '../src/channel.ts';
import { debriefFor, sparkSessionTime } from '../src/debrief.ts';
import type { SessionPlan } from '../src/sessionBuilder.ts';
import { pose, slot } from './fixtures.ts';

test('ערוץ: רק כרטיסים מוכנים, טקסט חופשי נדחה', () => {
  assert.ok(cardText('hype', 'cant_wait'));
  assert.equal(cardText('hype', 'שלום מה נשמע'), null);
  assert.equal(cardText('talk', 'tonight'), null);
});

test('ערוץ: חסום בהקפאה ומעל המגבלה היומית', () => {
  assert.equal(canSendChannel(0, true).reason, 'frozen');
  assert.equal(canSendChannel(CHANNEL_DAILY_LIMIT, false).reason, 'limit');
  assert.ok(canSendChannel(3, false).ok);
});

test('תחקור: עומס מפרקי נלקח מהתפקיד של האדם בכל תנוחה', () => {
  const p = pose('p1', { slots: { mover: slot({}, { knees: 4, hips: 2 }), stabilizer: slot({}, { wrists: 3 }) } });
  const plan: SessionPlan = {
    kind: 'full',
    intensity: 'balanced',
    warmupJoints: [],
    steps: [
      { phase: 'warmup', startPct: 0, endPct: 15, minutes: 4.5 },
      { phase: 'work', startPct: 15, endPct: 50, minutes: 10.5, assignment: { poseId: 'p1', moverUserId: 'A', stabilizerUserId: 'B' } },
    ],
  } as SessionPlan;
  const a = debriefFor(plan, 'A', [p], 70);
  const b = debriefFor(plan, 'B', [p], 70);
  assert.equal(a.jointLoad.knees, 4);
  assert.equal(a.jointLoad.wrists, 0);
  assert.equal(b.jointLoad.wrists, 3);
  assert.equal(b.jointLoad.knees, 0);
  assert.equal(a.minutes, 15);
  assert.deepEqual(a.posesUsed, ['p1']);
  assert.ok(a.kcal.low < a.kcal.high);
});

test('ניצוץ: "עכשיו" נקבע בעוד דקות, "הערב" לא בעבר', () => {
  const now = new Date('2026-11-20T20:00:00Z');
  assert.ok(sparkSessionTime('yes_now', now).getTime() - now.getTime() <= 10 * 60 * 1000);
  assert.ok(sparkSessionTime('yes_tonight', now).getTime() > now.getTime());
  const morning = new Date('2026-11-20T08:00:00Z');
  assert.equal(sparkSessionTime('yes_tonight', morning).toISOString(), '2026-11-20T19:00:00.000Z');
});
