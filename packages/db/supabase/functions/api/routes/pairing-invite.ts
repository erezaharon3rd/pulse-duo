// הזמנה לצימוד: קישור חד-פעמי + PIN של 4 ספרות שנמסר בעל-פה. תקף 48 שעות.
// נשמרים רק גיבובים. הקוד עצמו מוחזר פעם אחת בלבד, למזמין.
import { canCreateAnotherPairing } from '../../_shared/core/index.ts';
import { context, handle, HttpError, json, myPairings } from '../../_shared/context.ts';
import { randomCode, randomPin, sha256 } from '../../_shared/crypto.ts';

export default handle(async (req) => {
  const ctx = await context(req);
  const { data: prof } = await ctx.admin.from('profiles').select('user_id').eq('user_id', ctx.userId).maybeSingle();
  if (!prof) throw new HttpError(409, 'profile_required');
  const can = canCreateAnotherPairing(await myPairings(ctx));
  if (!can.ok) throw new HttpError(409, can.reason);

  const { data: pairing, error } = await ctx.admin.from('pairings').insert({}).select('pairing_id').single();
  if (error) throw error;
  const pairingId = pairing.pairing_id;
  await ctx.admin.from('pairing_members').insert({ pairing_id: pairingId, user_id: ctx.userId });
  await ctx.admin.from('my_pairing_settings').insert({ pairing_id: pairingId, user_id: ctx.userId });

  const code = randomCode();
  const pin = randomPin();
  await ctx.admin.from('pairing_invites').insert({
    code_hash: await sha256(code),
    confirm_pin_hash: await sha256(`${code}:${pin}`),
    inviter_id: ctx.userId,
    pairing_id: pairingId,
  });
  const base = Deno.env.get('APP_URL') ?? 'https://poetic-blini-7c13a2.netlify.app';
  return json({ link: `${base}/join?c=${code}`, pin, pairingId });
});
