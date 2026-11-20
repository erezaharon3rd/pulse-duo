// תשובה לניצוץ. "לא הפעם" נשמר, אבל השולח רואה אותו בדיוק כמו פקיעה.
// "כן" יוצר מפגש – שעדיין דורש "מתאים לי" משניהם ביום עצמו.
import { senderViewOfOutcome, sparkSessionTime } from '../../_shared/core/index.ts';
import { body, context, handle, HttpError, json } from '../../_shared/context.ts';

const REPLIES = ['yes_now', 'yes_hour', 'yes_tonight', 'hug', 'talk', 'touch_only', 'not_now'] as const;
type Reply = (typeof REPLIES)[number];

export default handle(async (req) => {
  const ctx = await context(req);
  const { sparkId, reply } = await body<{ sparkId: string; reply: Reply }>(req);
  if (!REPLIES.includes(reply)) throw new HttpError(400, 'bad reply');
  const { data: s } = await ctx.admin.from('sparks').select('*').eq('spark_id', sparkId).maybeSingle();
  if (!s || s.receiver_id !== ctx.userId) throw new HttpError(404, 'not found');
  if (s.reply || new Date(s.expires_at) <= new Date()) throw new HttpError(410, 'expired');

  const { data: done } = await ctx.admin.from('sparks').update({ reply }).eq('spark_id', sparkId).is('reply', null).select('spark_id');
  if (!done?.length) throw new HttpError(410, 'expired');

  let sessionId: string | null = null;
  if (reply === 'yes_now' || reply === 'yes_hour' || reply === 'yes_tonight') {
    const { data: sess } = await ctx.admin.from('sessions').insert({
      pairing_id: s.pairing_id, scheduled_at: sparkSessionTime(reply, new Date()).toISOString(), origin: 'spark',
    }).select('session_id').single();
    sessionId = sess?.session_id ?? null;
  }
  return json({ ok: true, sessionId, senderWillSee: senderViewOfOutcome(reply) });
});
