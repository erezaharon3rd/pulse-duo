// ערוץ הזוג (אפיון 1.7): רק כרטיסים מוכנים, בלי טקסט חופשי. פג אחרי 7 ימים.

export type ChannelKind = 'proposal' | 'reminder' | 'hype' | 'thinking_of_you' | 'talk';

export const CHANNEL_CARDS: Record<ChannelKind, Record<string, string>> = {
  proposal: {
    tonight: 'אימון הערב? 🌙',
    tomorrow_morning: 'מחר בבוקר? ☀️',
    weekend: 'בסופ"ש? 🔥',
  },
  reminder: {
    see_you: 'מחכה לאימון שלנו',
    hydrate: 'לשתות מים לפני 💧',
  },
  hype: {
    cant_wait: 'לא יכול/ה לחכות 🔥',
    ready: 'מוכן/ה לגמרי 💪',
    mystery: 'מה מחכה לנו הפעם? 🎁',
  },
  thinking_of_you: {
    thinking: 'חושב/ת עלייך 💛',
    smile: 'חייכתי בגללך',
  },
  talk: {
    lets_talk: 'בוא/י נדבר היום',
    all_good: 'הכול טוב בינינו? 🤍',
  },
};

export const CHANNEL_DAILY_LIMIT = 10;

export function cardText(kind: ChannelKind, cardId: string): string | null {
  return CHANNEL_CARDS[kind]?.[cardId] ?? null;
}

export function canSendChannel(sentToday: number, frozen: boolean): { ok: boolean; reason?: 'frozen' | 'limit' } {
  if (frozen) return { ok: false, reason: 'frozen' };
  if (sentToday >= CHANNEL_DAILY_LIMIT) return { ok: false, reason: 'limit' };
  return { ok: true };
}
