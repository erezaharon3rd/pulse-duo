// סינון רפואי: נשמר מוצפן בלבד. רק השרת יכול לקרוא אותו, ורק כדי לבנות מפגש בטוח.
import type { ScreeningFlag } from '../_shared/core/index.ts';
import { body, context, handle, HttpError, json } from '../_shared/context.ts';
import { seal } from '../_shared/crypto.ts';

const KNOWN: ScreeningFlag[] = [
  'cardiac', 'recent_cardiac_event', 'nitrates', 'uncontrolled_bp_diabetes', 'genital_pelvic_pain', 'erectile',
  'pelvic_floor', 'pregnancy', 'postpartum', 'surgery', 'hip_replacement', 'knee_replacement', 'osteoporosis',
  'hernia', 'eye', 'back_red_flag',
];

Deno.serve(
  handle(async (req) => {
    const ctx = await context(req);
    const { flags } = await body<{ flags: string[] }>(req);
    if (!Array.isArray(flags) || flags.some((f) => !KNOWN.includes(f as ScreeningFlag))) throw new HttpError(400, 'bad flags');
    const recheck = new Date(Date.now() + 180 * 24 * 3600 * 1000).toISOString(); // בדיקה חוזרת כל חצי שנה
    // דגל חדש מבטל אישור קודם: cleared_flags מתאפס בכל מילוי מחדש
    const { error } = await ctx.admin.from('screening').upsert({
      user_id: ctx.userId,
      completed_at: new Date().toISOString(),
      flags_enc: await seal([...new Set(flags)]),
      cleared_flags_enc: await seal([]),
      next_recheck_at: recheck,
    });
    if (error) throw error;
    return json({ ok: true, nextRecheckAt: recheck });
  }),
);
