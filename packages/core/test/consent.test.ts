// בדיקות קבלה: הסכמה, צימוד, ניצוץ, שובבות, קלוריות ודרגות.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { canStartSession, registerDidNotWant, isWarmupActive, shouldPauseGamification, unpairDeleteAt } from '../src/consent.ts';
import { agreementMatches, canCreateAnotherPairing, validateNickname, validateCoupleName, suggestNicknames } from '../src/pairing.ts';
import { canSendSpark, senderViewOfOutcome } from '../src/spark.ts';
import { effectiveSpice, passesLimits } from '../src/spice.ts';
import { kcal, displayRange, tempoMultiplier } from '../src/calories.ts';
import { nextLevel, nextStreak } from '../src/progress.ts';
import { seeded } from './fixtures.ts';

const now = new Date('2026-11-20T20:00:00Z');
const today = '2026-11-20';
const open = { frozenUntil: null, pendingDeleteAt: null, agreementMatched: true };

test('מפגש לא נפתח בלי "כן" פעיל משניהם מהיום', () => {
  const yes = { answer: 'yes' as const, answeredOn: today };
  assert.equal(canStartSession(yes, yes, open, today, now).canStart, true);
  assert.equal(canStartSession(yes, { answer: null, answeredOn: null }, open, today, now).canStart, false);
  assert.equal(canStartSession(yes, { answer: 'yes', answeredOn: '2026-11-19' }, open, today, now).canStart, false);
});

test('"המפגש הוזז" זהה לשניהם ולא מגלה מי סירב', () => {
  const yes = { answer: 'yes' as const, answeredOn: today };
  const no = { answer: 'not_today' as const, answeredOn: today };
  const r1 = canStartSession(yes, no, open, today, now);
  const r2 = canStartSession(no, yes, open, today, now);
  assert.deepEqual(r1, r2);
  assert.equal(JSON.stringify(r1).includes('A'), false);
});

test('הסכם צימוד שלא תואם / צימוד מוקפא / ממתין למחיקה = אין מפגש', () => {
  const yes = { answer: 'yes' as const, answeredOn: today };
  assert.equal(canStartSession(yes, yes, { ...open, agreementMatched: false }, today, now).canStart, false);
  assert.equal(canStartSession(yes, yes, { ...open, frozenUntil: '2026-11-25T00:00:00Z' }, today, now).canStart, false);
  assert.equal(canStartSession(yes, yes, { ...open, pendingDeleteAt: '2026-11-21T00:00:00Z' }, today, now).canStart, false);
});

test('מצב התחממות: פוקע בסוף השבוע ונכבה אחרי 2 × "לא באמת רציתי"', () => {
  let m = { weekOf: '2026-11-15', didNotWantCount: 0 };
  assert.equal(isWarmupActive(m, '2026-11-15'), true);
  assert.equal(isWarmupActive(m, '2026-11-22'), false);
  m = registerDidNotWant(m);
  assert.equal(isWarmupActive(m, '2026-11-15'), true);
  m = registerDidNotWant(m);
  assert.equal(isWarmupActive(m, '2026-11-15'), false);
});

test('עצירת משחקיות: 2 × "לא באמת רציתי" ב-30 יום', () => {
  assert.equal(shouldPauseGamification(['2026-11-01'], now), false);
  assert.equal(shouldPauseGamification(['2026-11-01', '2026-11-18'], now), true);
  assert.equal(shouldPauseGamification(['2026-09-01', '2026-11-18'], now), false);
});

test('פירוק: 24 שעות להתחרטות, מיידי מדיווח', () => {
  assert.equal(unpairDeleteAt(now, false).getTime() - now.getTime(), 24 * 3600000);
  assert.equal(unpairDeleteAt(now, true).getTime(), now.getTime());
});

test('הסכם צימוד: נפתח רק בבחירה זהה; בלעדי חוסם צימוד נוסף', () => {
  assert.equal(agreementMatches('exclusive', 'exclusive'), true);
  assert.equal(agreementMatches('exclusive', 'non_exclusive'), false);
  assert.equal(agreementMatches(null, 'exclusive'), false);
  assert.deepEqual(canCreateAnotherPairing([{ pairingId: '1', agreement: 'exclusive', active: true }]), { ok: false, reason: 'in_exclusive_pairing' });
  const three = ['1', '2', '3'].map((id) => ({ pairingId: id, agreement: 'non_exclusive' as const, active: true }));
  assert.deepEqual(canCreateAnotherPairing(three), { ok: false, reason: 'max_reached' });
  assert.deepEqual(canCreateAnotherPairing(three.slice(0, 2)), { ok: true });
});

test('כינוי ושם זוגי: בלי טלפון ובלי מייל', () => {
  assert.equal(validateNickname('קוקוס מסתורי').ok, true);
  assert.equal(validateNickname('050-1234567').ok, false);
  assert.equal(validateNickname('a@b.co').ok, false);
  assert.equal(validateCoupleName('צוות הפירוטכניקה').ok, true);
  assert.equal(suggestNicknames(seeded()).length, 3);
});

test('ניצוץ: "לא הפעם" ופקיעה נראים זהה; שלושה סירובים = מנוחה של 24 שעות', () => {
  assert.equal(senderViewOfOutcome('not_now'), senderViewOfOutcome('expired'));
  const base = { now, openSpark: false, receiverWeekCount: 0, receiverWeeklyQuota: 4, recentReplies: [], frozen: false };
  assert.equal(canSendSpark(base).send, true);
  const three = Array.from({ length: 3 }, () => ({ reply: 'not_now' as const, at: '2026-11-20T10:00:00Z' }));
  const r = canSendSpark({ ...base, recentReplies: three });
  assert.equal(r.send, false);
  const quota = canSendSpark({ ...base, receiverWeekCount: 4 });
  assert.equal(quota.send, false);
  if (!quota.send) assert.equal(quota.senderSees.includes('מכסה'), false);
});

test('שובבות: לפי הנמוך; תגים אסורים תמיד; גבולות של כל אחד מסננים', () => {
  assert.equal(effectiveSpice(4, 2), 2);
  assert.equal(passesLimits(['choking'], [], []), false);
  assert.equal(passesLimits(['role_swap'], ['role_swap'], []), false);
  assert.equal(passesLimits(['role_swap'], [], []), true);
});

test('קלוריות: 76 ק"ג מאוזן 25 דק\' ≈ 105; 60 ק"ג ≈ 83; עם שלבים ≈ 95 / 75', () => {
  assert.ok(Math.abs(kcal(76, [{ minutes: 25, level: 'balanced' }]) - 104.5) < 0.6);
  assert.ok(Math.abs(kcal(60, [{ minutes: 25, level: 'balanced' }]) - 82.5) < 0.6);
  const split = (w: number) => kcal(w, [{ minutes: 5, level: 'warmup' }, { minutes: 20, level: 'balanced' }]);
  assert.ok(Math.abs(split(76) - 95) < 1);
  assert.ok(Math.abs(split(60) - 75) < 1);
  assert.deepEqual(displayRange(100), { low: 70, high: 130 });
  assert.equal(tempoMultiplier(50, 50, 90), 0.8);
  assert.equal(tempoMultiplier(90, 50, 90), 1.2);
});

test('דרגות: לא עולים לפני שבועיים; צריך גם פעולות קשר; כאב מוריד', () => {
  const good = { date: '2026-11-10', maxPain: 0, feelings: ['calm' as const] };
  const base = {
    level: 2, levelSince: '2026-11-01', fitnessA: 3, fitnessB: 3,
    sessionsAtLevel: [good, good, good], connectionActionsAtLevel: 3,
    lastSessionAt: '2026-11-19', gamificationPaused: false, now,
  };
  assert.equal(nextLevel(base), 3);
  assert.equal(nextLevel({ ...base, levelSince: '2026-11-15' }), 2);
  assert.equal(nextLevel({ ...base, connectionActionsAtLevel: 1 }), 2);
  assert.equal(nextLevel({ ...base, sessionsAtLevel: [good, { ...good, maxPain: 5 }] }), 1);
  assert.equal(nextLevel({ ...base, level: 4 }), 4); // תקרה: min(fitness)+1 = 4
  assert.equal(nextLevel({ ...base, gamificationPaused: true }), 2);
});

test('רצף: "לא היום" מקפיא, שבוע ריק מאפס, בלי הסכמה – אין רצף', () => {
  assert.equal(nextStreak(3, 'goal_met', true), 4);
  assert.equal(nextStreak(3, 'not_today_or_frozen', true), 3);
  assert.equal(nextStreak(3, 'empty', true), 0);
  assert.equal(nextStreak(3, 'goal_met', false), 0);
});
