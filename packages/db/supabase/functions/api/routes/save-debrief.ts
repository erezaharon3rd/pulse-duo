// תחקור אחרי מפגש: כל אחד לבד, פרטי. מעדכן עומס מפרקים, סטטיסטיקה אישית, היסטוריית תנוחות,
// מצב "פתוח/ה להתחמם" ועצירת משחקיות. כשגם השני סיים – בודק עליית/ירידת דרגה.
import {
  debriefFor, FRESH_JOINT, nextLevel, updateJoint, registerDidNotWant, sessionLoad, shouldPauseGamification,
  type Feeling, type JointState, type Pose, type SessionPlan,
} from '../../_shared/core/index.ts';
import { assertMember, body, context, handle, HttpError, json, loadPairing } from '../../_shared/context.ts';
import { open } from '../../_shared/crypto.ts';
import poses from '../../_shared/poses.json' with { type: 'json' };

const FEELINGS: Feeling[] = ['rose', 'there_from_start', 'calm', 'did_not_arise', 'uncomfortable', 'did_not_want'];

export default handle(async (req) => {
  const ctx = await context(req);
  const { sessionId, effort, pain, painPoseId, feeling } =
    await body<{ sessionId: string; effort: number; pain: number; painPoseId?: string; feeling: Feeling }>(req);
  if (!Number.isInteger(effort) || effort < 1 || effort > 5) throw new HttpError(400, 'bad effort');
  if (!Number.isInteger(pain) || pain < 0 || pain > 10) throw new HttpError(400, 'bad pain');
  if (!FEELINGS.includes(feeling)) throw new HttpError(400, 'bad feeling');

  const { data: s } = await ctx.admin.from('sessions').select('*').eq('session_id', sessionId).maybeSingle();
  if (!s) throw new HttpError(404, 'not found');
  const otherId = await assertMember(ctx, s.pairing_id);
  if (!['confirmed', 'done', 'stopped'].includes(s.status) || !s.revealed_at) throw new HttpError(409, 'not_started');

  const { error: dupe } = await ctx.admin.from('debriefs').insert({
    session_id: sessionId, user_id: ctx.userId, effort, pain, pain_pose_id: painPoseId ?? null, feeling,
  });
  if (dupe) throw new HttpError(409, 'already_debriefed');

  const now = new Date();
  const plan = (await open<SessionPlan>(s.plan_enc))!;
  const { data: prof } = await ctx.admin.from('profiles').select('weight_kg').eq('user_id', ctx.userId).single();
  const r = debriefFor(plan, ctx.userId, poses as Pose[], prof?.weight_kg ?? 70);
  const load = sessionLoad(r.minutes, effort);

  await ctx.admin.from('my_session_stats').upsert({
    session_id: sessionId, user_id: ctx.userId, minutes: r.minutes, kcal_low: r.kcal.low, kcal_high: r.kcal.high, load,
    new_poses: plan.steps.filter((st) => st.isNew).length,
  });

  // מפרקים: כאב מיוחס רק למפרקים שהתנוחה שכאבה (או כל המפגש, אם לא צוינה) העמיסה עליהם
  const painPose = painPoseId ? (poses as Pose[]).find((p) => p.poseId === painPoseId) : undefined;
  const { data: states } = await ctx.admin.from('joint_status_t').select('*').eq('user_id', ctx.userId);
  const rows: Record<string, unknown>[] = [];
  for (const [joint, applied] of Object.entries(r.jointLoad)) {
    const painHere = pain > 0 && (painPose
      ? Math.max(painPose.slots.mover.jointLoad[joint as keyof typeof r.jointLoad], painPose.slots.stabilizer.jointLoad[joint as keyof typeof r.jointLoad]) > 0
      : applied > 0) ? pain : 0;
    if (applied === 0 && painHere === 0) continue;
    const row = (states ?? []).find((x) => x.joint === joint);
    const prev: JointState = row
      ? { status: row.status, restUntil: row.rest_until, returnSessionsLeft: row.return_sessions_left, mildPainCount: row.mild_pain_count }
      : FRESH_JOINT;
    const next = updateJoint(prev, applied, painHere, now);
    rows.push({ user_id: ctx.userId, joint, status: next.status, rest_until: next.restUntil, return_sessions_left: next.returnSessionsLeft, mild_pain_count: next.mildPainCount });
  }
  if (rows.length) await ctx.admin.from('joint_status_t').upsert(rows);

  if (r.posesUsed.length) {
    await ctx.admin.from('pose_history').upsert(r.posesUsed.map((pose_id) => ({ pairing_id: s.pairing_id, pose_id, last_used_at: now.toISOString() })));
  }

  if (feeling === 'did_not_want') await onDidNotWant(ctx, s.pairing_id, now);

  // שניהם סיימו → המפגש נסגר ובודקים דרגה
  const { data: all } = await ctx.admin.from('debriefs').select('user_id').eq('session_id', sessionId);
  if (otherId && (all ?? []).some((d) => d.user_id === otherId)) {
    if (s.status !== 'stopped') await ctx.admin.from('sessions').update({ status: 'done' }).eq('session_id', sessionId);
    await updateLevel(ctx, s.pairing_id, otherId, now);
  }

  return json({
    minutes: r.minutes,
    kcal: r.kcal,
    // כאב 4+ = עצירה ובדיקה; הממשק מציג את מסך הטריאז' (כולל מד"א 101 בכאב חד/חזה)
    checkIn: pain >= 4,
  });
});

async function onDidNotWant(ctx: any, pairingId: string, now: Date) {
  const { data: set } = await ctx.admin.from('my_pairing_settings').select('warmup_week_of, warmup_did_not_want')
    .eq('pairing_id', pairingId).eq('user_id', ctx.userId).single();
  if (set?.warmup_week_of) {
    const m = registerDidNotWant({ weekOf: set.warmup_week_of, didNotWantCount: set.warmup_did_not_want });
    await ctx.admin.from('my_pairing_settings').update({ warmup_week_of: m.weekOf, warmup_did_not_want: m.didNotWantCount })
      .eq('pairing_id', pairingId).eq('user_id', ctx.userId);
  }
  const since = new Date(now.getTime() - 30 * 24 * 3600 * 1000).toISOString();
  const { data: rows } = await ctx.admin.from('debriefs').select('created_at, sessions!inner(pairing_id)')
    .eq('feeling', 'did_not_want').eq('sessions.pairing_id', pairingId).gte('created_at', since);
  if (shouldPauseGamification((rows ?? []).map((r: any) => r.created_at), now)) {
    await ctx.admin.from('pairings').update({ gamification_paused_until: new Date(now.getTime() + 30 * 24 * 3600 * 1000).toISOString() })
      .eq('pairing_id', pairingId);
  }
}

async function updateLevel(ctx: any, pairingId: string, otherId: string, now: Date) {
  const p = await loadPairing(ctx, pairingId);
  const [{ data: profs }, { data: done }, { count: thanks }, { count: msgs }] = await Promise.all([
    ctx.admin.from('profiles').select('user_id, fitness_level').in('user_id', [ctx.userId, otherId]),
    ctx.admin.from('sessions').select('session_id, scheduled_at, debriefs(pain, feeling)').eq('pairing_id', pairingId)
      .in('status', ['done', 'stopped']).gte('scheduled_at', p.level_since).order('scheduled_at'),
    ctx.admin.from('thanks').select('session_id, sessions!inner(pairing_id)', { count: 'exact', head: true })
      .eq('sessions.pairing_id', pairingId),
    ctx.admin.from('pairing_messages').select('msg_id', { count: 'exact', head: true })
      .eq('pairing_id', pairingId).in('kind', ['thinking_of_you', 'talk']).gte('created_at', p.level_since),
  ]);
  const fit = (id: string) => profs?.find((x: any) => x.user_id === id)?.fitness_level ?? 3;
  const sessions = (done ?? []).map((x: any) => ({
    date: x.scheduled_at,
    maxPain: Math.max(0, ...x.debriefs.map((d: any) => d.pain ?? 0)),
    feelings: x.debriefs.map((d: any) => d.feeling).filter(Boolean),
  }));
  const level = nextLevel({
    level: p.level,
    levelSince: p.level_since,
    fitnessA: fit(ctx.userId),
    fitnessB: fit(otherId),
    sessionsAtLevel: sessions,
    connectionActionsAtLevel: (thanks ?? 0) + (msgs ?? 0),
    lastSessionAt: sessions.length ? sessions[sessions.length - 1].date : null,
    gamificationPaused: !!p.gamification_paused_until && new Date(p.gamification_paused_until) > now,
    now,
  });
  if (level !== p.level) await ctx.admin.from('pairings').update({ level, level_since: now.toISOString() }).eq('pairing_id', pairingId);
}
