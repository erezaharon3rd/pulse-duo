// פירוק: כל צד לבד. 24 שעות להתחרטות (רק מי שפירק יכול לבטל). מדיווח – מיידי ומוחק הכול.
import { unpairDeleteAt } from '../_shared/core/index.ts';
import { assertMember, body, context, handle, json, loadPairing } from '../_shared/context.ts';

Deno.serve(
  handle(async (req) => {
    const ctx = await context(req);
    const { pairingId, fromReport = false, cancel = false } = await body<{ pairingId: string; fromReport?: boolean; cancel?: boolean }>(req);
    await assertMember(ctx, pairingId);

    if (cancel) {
      const p = await loadPairing(ctx, pairingId);
      if (p.pending_delete_at && new Date(p.pending_delete_at) > new Date() && p.unpaired_by === ctx.userId) {
        await ctx.admin.from('pairings').update({ pending_delete_at: null, unpaired_by: null }).eq('pairing_id', pairingId);
        return json({ cancelled: true });
      }
      return json({ cancelled: false });
    }

    if (fromReport) {
      await ctx.admin.from('pairings').delete().eq('pairing_id', pairingId);
      return json({ deleted: true });
    }
    const at = unpairDeleteAt(new Date(), false).toISOString();
    await ctx.admin.from('pairings').update({ pending_delete_at: at, unpaired_by: ctx.userId }).eq('pairing_id', pairingId);
    await ctx.admin.from('sessions').update({ status: 'postponed' }).eq('pairing_id', pairingId).in('status', ['proposed', 'confirmed']);
    return json({ deleteAt: at });
  }),
);
