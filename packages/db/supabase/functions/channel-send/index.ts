// ערוץ הזוג: כרטיסים מוכנים בלבד. הצעה ("proposal") יוצרת גם מפגש מוצע.
import { canSendChannel, cardText, type ChannelKind } from '../_shared/core/index.ts';
import { assertMember, body, context, handle, HttpError, isFrozen, json, loadPairing } from '../_shared/context.ts';

const proposalTime = (cardId: string, now: Date): Date | null => {
  const at = (days: number, utcHour: number) => {
    const d = new Date(now);
    d.setUTCDate(d.getUTCDate() + days);
    d.setUTCHours(utcHour, 0, 0, 0);
    return d;
  };
  if (cardId === 'tonight') return at(0, 19) > now ? at(0, 19) : null;
  if (cardId === 'tomorrow_morning') return at(1, 6);
  if (cardId === 'weekend') {
    const days = (5 - now.getUTCDay() + 7) % 7 || 7; // שישי הקרוב
    return at(days, 8);
  }
  return null;
};

Deno.serve(
  handle(async (req) => {
    const ctx = await context(req);
    const { pairingId, kind, cardId } = await body<{ pairingId: string; kind: ChannelKind; cardId: string }>(req);
    const text = cardText(kind, cardId);
    if (!text) throw new HttpError(400, 'unknown card');
    const otherId = await assertMember(ctx, pairingId);
    if (!otherId) throw new HttpError(409, 'not_paired_yet');
    const pairing = await loadPairing(ctx, pairingId);

    const since = new Date(Date.now() - 24 * 3600 * 1000).toISOString();
    const { count } = await ctx.admin.from('pairing_messages').select('msg_id', { count: 'exact', head: true })
      .eq('pairing_id', pairingId).eq('sender_id', ctx.userId).gte('created_at', since);
    const can = canSendChannel(count ?? 0, isFrozen(pairing));
    if (!can.ok) throw new HttpError(429, can.reason!);

    let sessionId: string | null = null;
    if (kind === 'proposal') {
      if (!pairing.agreement) throw new HttpError(409, 'agreement_pending');
      const at = proposalTime(cardId, new Date());
      if (!at) throw new HttpError(409, 'too_late_today');
      const { data: sess } = await ctx.admin.from('sessions')
        .upsert({ pairing_id: pairingId, scheduled_at: at.toISOString(), origin: 'proposal' }, { onConflict: 'pairing_id,scheduled_at', ignoreDuplicates: true })
        .select('session_id').maybeSingle();
      sessionId = sess?.session_id ?? null;
    }
    await ctx.admin.from('pairing_messages').insert({ pairing_id: pairingId, sender_id: ctx.userId, kind, payload: { cardId, sessionId } });
    return json({ ok: true, sessionId });
  }),
);
