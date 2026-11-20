// ניצוץ ✨ "יש לי חשק": הצעה, לא דרישה. כל הכללים מ-core (מכסה, מנוחה, ניצוץ פתוח).
import { canSendSpark, type SparkReply } from '../../_shared/core/index.ts';
import { assertMember, body, context, handle, HttpError, isFrozen, json, loadPairing } from '../../_shared/context.ts';

const weekStart = () => {
  const d = new Date();
  d.setUTCHours(0, 0, 0, 0);
  d.setUTCDate(d.getUTCDate() - d.getUTCDay()); // יום ראשון
  return d.toISOString();
};

export default handle(async (req) => {
  const ctx = await context(req);
  const { pairingId, when } = await body<{ pairingId: string; when: 'now' | 'tonight' | 'kids_asleep' }>(req);
  if (!['now', 'tonight', 'kids_asleep'].includes(when)) throw new HttpError(400, 'bad when');
  const receiverId = await assertMember(ctx, pairingId);
  if (!receiverId) throw new HttpError(409, 'not_paired_yet');
  const pairing = await loadPairing(ctx, pairingId);
  const now = new Date();

  const [{ data: open }, { count: weekCount }, { data: recent }, { data: quota }] = await Promise.all([
    ctx.admin.from('sparks').select('spark_id').eq('pairing_id', pairingId).is('reply', null).gt('expires_at', now.toISOString()).limit(1),
    // מכסה פרטית של המקבל, בכל הצימודים שלו
    ctx.admin.from('sparks').select('spark_id', { count: 'exact', head: true }).eq('receiver_id', receiverId).gte('created_at', weekStart()),
    ctx.admin.from('sparks').select('reply, expires_at, created_at').eq('pairing_id', pairingId).eq('sender_id', ctx.userId)
      .order('created_at', { ascending: false }).limit(3),
    ctx.admin.from('my_pairing_settings').select('spark_weekly_quota').eq('pairing_id', pairingId).eq('user_id', receiverId).single(),
  ]);

  const decision = canSendSpark({
    now,
    frozen: isFrozen(pairing),
    openSpark: (open ?? []).length > 0,
    receiverWeekCount: weekCount ?? 0,
    receiverWeeklyQuota: quota?.spark_weekly_quota ?? 4,
    recentReplies: (recent ?? []).map((r) => ({
      reply: (r.reply ?? (new Date(r.expires_at) <= now ? 'expired' : 'not_now')) as SparkReply | 'expired',
      at: r.created_at,
    })),
  });
  if (!decision.send) return json({ sent: false, senderSees: decision.senderSees });

  const { data: spark } = await ctx.admin.from('sparks').insert({
    pairing_id: pairingId, sender_id: ctx.userId, receiver_id: receiverId, when_hint: when, expires_at: decision.expiresAt.toISOString(),
  }).select('spark_id').single();
  return json({ sent: true, sparkId: spark!.spark_id, expiresAt: decision.expiresAt });
});
