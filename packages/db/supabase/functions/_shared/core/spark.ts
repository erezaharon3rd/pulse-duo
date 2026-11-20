// נוצר אוטומטית מ-packages/core/src על ידי scripts/sync-core.mjs. לא לערוך כאן.
// ניצוץ ✨ – "יש לי חשק" (אפיון 1.6).

export const SPARK_TTL_MS = 2 * 3600 * 1000;
export const SPARK_COOLDOWN_MS = 24 * 3600 * 1000;

export type SparkReply = 'yes_now' | 'yes_hour' | 'yes_tonight' | 'hug' | 'talk' | 'touch_only' | 'not_now';

export interface SparkContext {
  now: Date;
  /** ניצוץ פתוח כרגע בצימוד? */
  openSpark: boolean;
  /** כמה ניצוצות קיבל הצד השני השבוע. */
  receiverWeekCount: number;
  receiverWeeklyQuota: number;
  /** תשובות אחרונות לניצוצות של השולח בצימוד, מהחדשה לישנה. */
  recentReplies: { reply: SparkReply | 'expired'; at: string }[];
  frozen: boolean;
}

export type SparkDecision =
  | { send: true; expiresAt: Date }
  | { send: false; reason: 'open' | 'resting' | 'frozen'; senderSees: string }
  | { send: false; reason: 'quota'; senderSees: string };

export function canSendSpark(c: SparkContext): SparkDecision {
  if (c.frozen) return { send: false, reason: 'frozen', senderSees: 'הצימוד במנוחה' };
  if (c.openSpark) return { send: false, reason: 'open', senderSees: 'הניצוץ שלך עוד דולק' };
  const lastThree = c.recentReplies.slice(0, 3);
  if (
    lastThree.length === 3 &&
    lastThree.every((r) => r.reply === 'not_now') &&
    c.now.getTime() - new Date(lastThree[0].at).getTime() < SPARK_COOLDOWN_MS
  ) {
    return { send: false, reason: 'resting', senderSees: 'הניצוץ נח עד מחר' };
  }
  if (c.receiverWeekCount >= c.receiverWeeklyQuota) {
    // המכסה של המקבל פרטית: השולח לא יודע שזו מכסה.
    return { send: false, reason: 'quota', senderSees: 'שמרנו את הניצוץ להמשך השבוע' };
  }
  return { send: true, expiresAt: new Date(c.now.getTime() + SPARK_TTL_MS) };
}

/** מה רואה מי שהדליק. "לא הפעם" ופקיעה נראים בדיוק אותו דבר. */
export function senderViewOfOutcome(reply: SparkReply | 'expired'): string {
  switch (reply) {
    case 'yes_now':
    case 'yes_hour':
    case 'yes_tonight':
      return 'יש! קבענו ✨';
    case 'hug':
      return 'מגיע לך חיבוק 🤗';
    case 'talk':
      return 'בוא/י נדבר';
    case 'touch_only':
      return 'מגע, בלי המשך 💛';
    case 'not_now':
    case 'expired':
      return 'הניצוץ כבה. נדליק שוב?';
  }
}
