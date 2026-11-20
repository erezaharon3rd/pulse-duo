// הסכם צימוד, שמות וכינויים (אפיון 1.3–1.4).

export type Agreement = 'exclusive' | 'non_exclusive';

export const MAX_PAIRINGS = 3;

/** הצימוד נפתח רק אם שני הצדדים בחרו את אותו הסכם. */
export function agreementMatches(a: Agreement | null, b: Agreement | null): boolean {
  return a !== null && a === b;
}

export interface MyPairing {
  pairingId: string;
  agreement: Agreement;
  active: boolean;
}

export type CreatePairingResult =
  | { ok: true }
  | { ok: false; reason: 'in_exclusive_pairing' | 'max_reached' };

export function canCreateAnotherPairing(mine: MyPairing[]): CreatePairingResult {
  const active = mine.filter((p) => p.active);
  if (active.some((p) => p.agreement === 'exclusive')) return { ok: false, reason: 'in_exclusive_pairing' };
  if (active.length >= MAX_PAIRINGS) return { ok: false, reason: 'max_reached' };
  return { ok: true };
}

const PHONE = /\+?\d[\d\s-]{6,}\d/;
const EMAIL = /[^\s@]+@[^\s@]+\.[^\s@]+/;

/** כינוי אנונימי: 2–20 תווים, בלי טלפון ובלי מייל. */
export function validateNickname(nick: string): { ok: boolean; error?: string } {
  const t = nick.trim();
  if (t.length < 2 || t.length > 20) return { ok: false, error: 'כינוי צריך להיות בין 2 ל-20 תווים' };
  if (PHONE.test(t) || EMAIL.test(t)) return { ok: false, error: 'בלי טלפון ובלי מייל – זה כינוי אנונימי' };
  return { ok: true };
}

/** שם זוגי: אותם כללים, עד 24 תווים. */
export function validateCoupleName(name: string): { ok: boolean; error?: string } {
  const t = name.trim();
  if (t.length < 2 || t.length > 24) return { ok: false, error: 'שם זוגי צריך להיות בין 2 ל-24 תווים' };
  if (PHONE.test(t) || EMAIL.test(t)) return { ok: false, error: 'בלי טלפון ובלי מייל בשם הזוגי' };
  return { ok: true };
}

const NICK_A = ['קוקוס', 'ניצוץ', 'צל', 'ענן', 'פלפל', 'ירח', 'קקטוס', 'גחלת'];
const NICK_B = ['מסתורי', 'שובב', 'שקט', 'לוהט', 'חמקמק', 'נועז', 'רך', 'חשמלי'];

/** שלוש הצעות לכינוי. rand מוזרק כדי שהבדיקות יהיו דטרמיניסטיות. */
export function suggestNicknames(rand: () => number = Math.random): string[] {
  const out = new Set<string>();
  while (out.size < 3) {
    out.add(`${NICK_A[Math.floor(rand() * NICK_A.length)]} ${NICK_B[Math.floor(rand() * NICK_B.length)]}`);
  }
  return [...out];
}
