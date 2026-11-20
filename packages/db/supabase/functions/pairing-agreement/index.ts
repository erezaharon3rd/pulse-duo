// הסכם צימוד: כל צד מצביע בנפרד. ההסכם נקבע רק כשהבחירות תואמות.
// אם לא תואמות – שניהם רואים אותה הודעה, בלי לדעת מה השני בחר.
import { agreementMatches, canCreateAnotherPairing, type Agreement } from '../_shared/core/index.ts';
import { assertMember, body, context, handle, HttpError, json, loadPairing, myPairings } from '../_shared/context.ts';

Deno.serve(
  handle(async (req) => {
    const ctx = await context(req);
    const { pairingId, agreement } = await body<{ pairingId: string; agreement: Agreement }>(req);
    if (!['exclusive', 'non_exclusive'].includes(agreement)) throw new HttpError(400, 'bad agreement');
    const otherId = await assertMember(ctx, pairingId);
    const pairing = await loadPairing(ctx, pairingId);
    if (pairing.agreement) throw new HttpError(409, 'already_set');

    // בלעדי אפשרי רק אם אין לי צימודים פעילים אחרים
    if (agreement === 'exclusive' && (await myPairings(ctx, pairingId)).some((p) => p.active)) {
      throw new HttpError(409, 'has_other_pairings');
    }
    // ואם כבר יש לי צימוד בלעדי אחר – אי אפשר בכלל
    const others = canCreateAnotherPairing(await myPairings(ctx, pairingId));
    if (!others.ok && others.reason === 'in_exclusive_pairing') throw new HttpError(409, others.reason);

    await ctx.admin.from('my_pairing_settings').update({ agreement_vote: agreement }).eq('pairing_id', pairingId).eq('user_id', ctx.userId);
    if (!otherId) return json({ matched: null });
    const { data: theirs } = await ctx.admin
      .from('my_pairing_settings').select('agreement_vote').eq('pairing_id', pairingId).eq('user_id', otherId).single();
    if (!theirs?.agreement_vote) return json({ matched: null });

    if (agreementMatches(agreement, theirs.agreement_vote)) {
      await ctx.admin.from('pairings').update({ agreement }).eq('pairing_id', pairingId);
      return json({ matched: true });
    }
    // אי-התאמה: מאפסים את שתי ההצבעות, ושניהם מתבקשים לדבר ולבחור שוב
    await ctx.admin.from('my_pairing_settings').update({ agreement_vote: null }).eq('pairing_id', pairingId);
    return json({ matched: false, message: 'הבחירות לא תאמו. כדאי לדבר ולבחור שוב.' });
  }),
);
