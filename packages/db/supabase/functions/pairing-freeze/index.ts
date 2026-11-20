// הקפאה: כל צד יכול לבד, בלי לנמק. 0 ימים = הפשרה.
import { assertMember, body, context, handle, HttpError, json } from '../_shared/context.ts';

Deno.serve(
  handle(async (req) => {
    const ctx = await context(req);
    const { pairingId, days } = await body<{ pairingId: string; days: 0 | 7 | 14 | 30 }>(req);
    if (![0, 7, 14, 30].includes(days)) throw new HttpError(400, 'bad days');
    await assertMember(ctx, pairingId);
    const until = days === 0 ? null : new Date(Date.now() + days * 24 * 3600 * 1000).toISOString();
    await ctx.admin.from('pairings').update({ frozen_until: until }).eq('pairing_id', pairingId);
    // מפגשים פתוחים בצימוד מוזזים – אותה הודעה לשניהם
    if (until) {
      await ctx.admin.from('sessions').update({ status: 'postponed' })
        .eq('pairing_id', pairingId).in('status', ['proposed', 'confirmed']);
    }
    return json({ frozenUntil: until });
  }),
);
