// הצטרפות לצימוד עם קישור + PIN. 5 ניסיונות PIN שגויים מבטלים את ההזמנה.
import { canCreateAnotherPairing } from '../_shared/core/index.ts';
import { body, context, handle, HttpError, json, myPairings } from '../_shared/context.ts';
import { sha256 } from '../_shared/crypto.ts';

const MAX_PIN_ATTEMPTS = 5;

Deno.serve(
  handle(async (req) => {
    const ctx = await context(req);
    const { code, pin } = await body<{ code: string; pin: string }>(req);
    if (typeof code !== 'string' || !/^\d{4}$/.test(pin ?? '')) throw new HttpError(400, 'bad input');

    const { data: inv } = await ctx.admin.from('pairing_invites').select('*').eq('code_hash', await sha256(code)).maybeSingle();
    // תשובה אחידה לכל כישלון של הקישור, כדי לא לחשוף אם קיים
    if (!inv || inv.used || new Date(inv.expires_at) < new Date() || inv.pin_attempts >= MAX_PIN_ATTEMPTS) {
      throw new HttpError(410, 'invite_invalid');
    }
    if (inv.inviter_id === ctx.userId) throw new HttpError(409, 'own_invite');

    if ((await sha256(`${code}:${pin}`)) !== inv.confirm_pin_hash) {
      await ctx.admin.from('pairing_invites').update({ pin_attempts: inv.pin_attempts + 1 }).eq('code_hash', inv.code_hash);
      throw new HttpError(403, 'wrong_pin');
    }

    const { data: prof } = await ctx.admin.from('profiles').select('user_id').eq('user_id', ctx.userId).maybeSingle();
    if (!prof) throw new HttpError(409, 'profile_required');
    const can = canCreateAnotherPairing(await myPairings(ctx));
    if (!can.ok) throw new HttpError(409, can.reason);

    // סימון "בשימוש" קודם, עם תנאי, כדי שרק הצטרפות אחת תצליח גם במקביל
    const { data: claimed } = await ctx.admin
      .from('pairing_invites').update({ used: true }).eq('code_hash', inv.code_hash).eq('used', false).select('code_hash');
    if (!claimed?.length) throw new HttpError(410, 'invite_invalid');

    const { error } = await ctx.admin.from('pairing_members').insert({ pairing_id: inv.pairing_id, user_id: ctx.userId });
    if (error) throw new HttpError(409, 'pairing_full');
    await ctx.admin.from('my_pairing_settings').insert({ pairing_id: inv.pairing_id, user_id: ctx.userId });
    return json({ pairingId: inv.pairing_id });
  }),
);
