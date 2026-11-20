// כל הטקסטים במקום אחד. שלוש צורות פנייה: זכר / נקבה / רבים.
export type Form = 'm' | 'f' | 'plural';
type T = Record<Form, string>;
const same = (s: string): T => ({ m: s, f: s, plural: s });

export const S = {
  promise: same('אפשר לעצור בכל רגע. מה שלך נשאר שלך.'),
  phoneTitle: same('מה המספר שלך?'),
  codeTitle: same('הקוד שקיבלת ב-SMS'),
  ageCheck: same('אני מעל גיל 18'),
  nickTitle: same('בחר/י כינוי. אף אחד לא יראה את השם האמיתי שלך.'),
  addPairing: same('+ צימוד'),
  sparkHint: same('לחיצה ארוכה = ניצוץ ✨'),
  imIn: { m: 'מתאים לי', f: 'מתאים לי', plural: 'מתאים לנו' } as T,
  notToday: same('לא היום'),
  warmupYes: same('יאללה, מתחממים'),
  postponed: same('המפגש הוזז'),
  resting: same('הצימוד במנוחה'),
  stopHint: same('כדי לעצור לא צריך את הטלפון. מספיק להגיד עצור.'),
  ready: same('מוכן/ה'),
  sparkOut: same('הניצוץ כבה. נדליק שוב?'),
  help: same('עזרה ותמיכה'),
  quickExit: same('יציאה מהירה'),
};

export const t = (k: keyof typeof S, form: Form = 'plural') => S[k][form];
