// כללי הסכמה (אפיון: 1.2, 1.5, 4.1, 9.3). אלה הכללים שאסור לשבור.

export type WillingnessAnswer = 'yes' | 'not_today' | null; // null = לא ענה

export interface DayWillingness {
  /** תשובה פעילה מהיום. שתיקה = null = לא היום. */
  answer: WillingnessAnswer;
  answeredOn: string | null; // YYYY-MM-DD
}

export interface PairingState {
  frozenUntil: string | null; // ISO
  pendingDeleteAt: string | null;
  agreementMatched: boolean;
}

export interface ConsentResult {
  canStart: boolean;
  /** הודעה זהה לשני הצדדים. אף פעם לא מגלה מי סירב. */
  neutralMessage: string | null;
}

const POSTPONED = 'המפגש הוזז';

/**
 * מפגש נפתח רק אם לשני האנשים יש "כן" פעיל מהיום עצמו.
 * מצב "פתוח/ה להתחמם" לא משנה את הכלל הזה: הוא משנה רק את נוסח הכפתור.
 */
export function canStartSession(
  a: DayWillingness,
  b: DayWillingness,
  pairing: PairingState,
  today: string,
  now: Date,
): ConsentResult {
  if (!pairing.agreementMatched) return { canStart: false, neutralMessage: null };
  if (pairing.pendingDeleteAt) return { canStart: false, neutralMessage: null };
  if (pairing.frozenUntil && new Date(pairing.frozenUntil) > now) {
    return { canStart: false, neutralMessage: 'הצימוד במנוחה' };
  }
  const activeYes = (w: DayWillingness) => w.answer === 'yes' && w.answeredOn === today;
  if (activeYes(a) && activeYes(b)) return { canStart: true, neutralMessage: null };
  return { canStart: false, neutralMessage: POSTPONED };
}

/** מצב "פתוח/ה להתחמם" (1.5): לכל צימוד, פוקע בסוף השבוע. */
export interface WarmupMode {
  weekOf: string | null; // תאריך יום ראשון של השבוע שבו הופעל
  didNotWantCount: number; // בתוך המצב
}

export function isWarmupActive(mode: WarmupMode, currentWeekOf: string): boolean {
  return mode.weekOf === currentWeekOf && mode.didNotWantCount < 2;
}

/** תשובת "לא באמת רציתי" במצב התחממות: אחרי שתיים המצב כבה. */
export function registerDidNotWant(mode: WarmupMode): WarmupMode {
  const count = mode.didNotWantCount + 1;
  return count >= 2 ? { weekOf: null, didNotWantCount: 0 } : { ...mode, didNotWantCount: count };
}

/** עצירת משחקיות (1.13): 2 תשובות "לא באמת רציתי" ב-30 יום. */
export function shouldPauseGamification(didNotWantDates: string[], now: Date): boolean {
  const cutoff = now.getTime() - 30 * 24 * 3600 * 1000;
  return didNotWantDates.filter((d) => new Date(d).getTime() >= cutoff).length >= 2;
}

/** פירוק (1.11): 24 שעות להתחרטות, מיידי אם הגיע מדיווח. */
export function unpairDeleteAt(now: Date, fromReport: boolean): Date {
  return fromReport ? now : new Date(now.getTime() + 24 * 3600 * 1000);
}
