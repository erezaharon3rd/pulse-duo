// "מתאים לי" / "לא היום". כשהשני כבר אמר כן – בונה את המפגש בשרת ושומר אותו מוצפן.
import { buildSession, canStartSession, effectiveSpice, type Person, type Pose } from '@pulse/core';
import { assertMember, context, handle, HttpError, json } from '../_shared/context.ts';
import { open, seal } from '../_shared/crypto.ts';
import poses from '../_shared/poses.json' with { type: 'json' };

Deno.serve(
  handle(async (req) => {
    const ctx = await context(req);
    const { sessionId, answer, energy } = await req.json();
    if (!['yes', 'not_today'].includes(answer)) throw new HttpError(400, 'bad answer');

    const { data: session } = await ctx.admin.from('sessions').select('*').eq('session_id', sessionId).single();
    if (!session) throw new HttpError(404, 'not found');
    const otherId = await assertMember(ctx, session.pairing_id);
    const today = new Date().toISOString().slice(0, 10);

    await ctx.admin.from('willingness').upsert({ session_id: sessionId, user_id: ctx.userId, answer, energy, answered_on: today });

    const { data: answers } = await ctx.admin.from('willingness').select('*').eq('session_id', sessionId);
    const mine = answers!.find((a) => a.user_id === ctx.userId);
    const theirs = answers!.find((a) => a.user_id === otherId);
    const { data: pairing } = await ctx.admin.from('pairings').select('*').eq('pairing_id', session.pairing_id).single();

    const w = (a?: { answer: string; answered_on: string }) => ({ answer: (a?.answer ?? null) as 'yes' | 'not_today' | null, answeredOn: a?.answered_on ?? null });
    const consent = canStartSession(
      w(mine),
      w(theirs),
      { frozenUntil: pairing.frozen_until, pendingDeleteAt: pairing.pending_delete_at, agreementMatched: pairing.agreement !== null },
      today,
      new Date(),
    );

    if (!consent.canStart) {
      if (answer === 'not_today' || theirs?.answer === 'not_today') {
        await ctx.admin.from('sessions').update({ status: 'postponed' }).eq('session_id', sessionId);
      }
      // אותה תשובה לשני הצדדים, בלי לציין מי
      return json({ status: theirs ? 'postponed_or_waiting' : 'waiting', message: consent.neutralMessage });
    }

    const [a, b] = await Promise.all([loadPerson(ctx.admin, ctx.userId, session.pairing_id), loadPerson(ctx.admin, otherId, session.pairing_id)]);
    const { data: hist } = await ctx.admin.from('pose_history').select('*').eq('pairing_id', session.pairing_id);
    const plan = buildSession({
      a, b,
      energyA: mine!.energy, energyB: theirs!.energy,
      poses: poses as Pose[],
      level: pairing.level,
      spiceEffective: effectiveSpice(a.spiceLevel, b.spiceLevel),
      minutes: 30,
      history: Object.fromEntries((hist ?? []).map((h) => [h.pose_id, h.last_used_at])),
      favorites: [],
      now: new Date(),
    });
    await ctx.admin.from('sessions').update({ status: 'confirmed', intensity: plan.intensity, plan_enc: await seal(plan) }).eq('session_id', sessionId);
    return json({ status: 'ready' }); // התוכנית עצמה נחשפת רק דרך reveal-session
  }),
);

async function loadPerson(admin: any, userId: string, pairingId: string): Promise<Person> {
  const [{ data: p }, { data: s }, { data: lim }, { data: set }] = await Promise.all([
    admin.from('profiles').select('*').eq('user_id', userId).single(),
    admin.from('screening').select('*').eq('user_id', userId).maybeSingle(),
    admin.from('limitations').select('*').eq('user_id', userId),
    admin.from('my_pairing_settings').select('*').eq('user_id', userId).eq('pairing_id', pairingId).single(),
  ]);
  const back = (lim ?? []).find((l: any) => l.joint === 'lowerBack');
  return {
    userId,
    weightKg: p.weight_kg ?? 70,
    heightCm: p.height_cm ?? 170,
    fitnessLevel: p.fitness_level,
    // רק מגבלות שנענו נכנסות; מה שלא נשאל נשאר undefined = זהיר
    limitations: Object.fromEntries((lim ?? []).map((l: any) => [l.joint, l.severity])),
    backType: back?.back_type ?? undefined,
    hipApproach: (lim ?? []).find((l: any) => l.joint === 'hips')?.hip_approach ?? undefined,
    flags: (await open<string[]>(s?.flags_enc)) ?? [],
    clearedFlags: (await open<string[]>(s?.cleared_flags_enc)) ?? [],
    intensityCapSelf: p.intensity_cap_self,
    spiceLevel: set.spice_level,
    hardLimits: (await open<string[]>(set.hard_limits_enc)) ?? [],
    standingOk: false,
  } as Person;
}
