// רגע החשיפה: מחזיר את התוכנית רק לחבר בצימוד, ורק אחרי ששניהם אמרו כן.
// הפלט מוכן לתצוגה (כותרת, תת-כותרת, שניות) כדי שהממשק לא יצטרך שום לוגיקה.
import type { SessionPlan } from '../../_shared/core/index.ts';
import { assertMember, context, handle, HttpError, json } from '../../_shared/context.ts';
import { open } from '../../_shared/crypto.ts';
import poses from '../../_shared/poses.json' with { type: 'json' };

const PHASE_TITLE = { warmup: 'חימום 🌬️', work: 'תנועה', peak: 'השיא של הערב 🔥', release: 'שחרור 🌙' } as const;
const nameOf = (id?: string) => (poses as { poseId: string; nameHe?: string }[]).find((p) => p.poseId === id)?.nameHe;

export default handle(async (req) => {
  const ctx = await context(req);
  const { sessionId } = await req.json();
  const { data: s } = await ctx.admin.from('sessions').select('*').eq('session_id', sessionId).single();
  if (!s) throw new HttpError(404, 'not found');
  await assertMember(ctx, s.pairing_id);
  if (s.status !== 'confirmed' || !s.plan_enc) throw new HttpError(409, 'not ready');
  if (!s.revealed_at) await ctx.admin.from('sessions').update({ revealed_at: new Date().toISOString() }).eq('session_id', sessionId);

  const plan = (await open<SessionPlan>(s.plan_enc))!;
  const steps = plan.steps.map((st) => ({
    title: st.assignment ? `"${nameOf(st.assignment.poseId) ?? 'תנוחה'}"` : PHASE_TITLE[st.phase],
    subtitle: [
      PHASE_TITLE[st.phase],
      st.isNew ? 'חדש!' : null,
      st.assignment ? (st.assignment.moverUserId === ctx.userId ? 'את/ה מוביל/ה' : 'את/ה מייצב/ת') : null,
    ].filter(Boolean).join(' · '),
    seconds: Math.round(st.minutes * 60),
  }));
  return json({ plan: { steps } });
});
