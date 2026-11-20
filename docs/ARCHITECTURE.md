# ארכיטקטורה – PULSE DUO

המערכת בנויה משלוש שכבות נפרדות לגמרי. כל שכבה יושבת בתיקייה משלה, ויש בדיקה אוטומטית (`scripts/check-boundaries.mjs`) שנכשלת אם שכבה עוקפת את הגבולות.

```
apps/mobile      ← ממשק בלבד (מסכים, אנימציות, מחוות, סאונד)
     │  קורא רק ל:
     ▼
packages/core    ← לוגיקה טהורה (כללי הסכמה, בניית מפגש, עומס, דרגות, שובבות)
packages/db      ← נתונים (סכמה, RLS, פונקציות שרת, לקוח גישה לנתונים)
     │
     ▼
Supabase (Postgres + Auth + Edge Functions)
```

## 1. השכבות

| שכבה | תיקייה | מה מותר | מה אסור |
| --- | --- | --- | --- |
| ממשק | `apps/mobile` | Expo / React Native, קומפוננטות, טקסטים, אנימציות, ייבוא מ-`@pulse/core` ומ-`@pulse/db` | ייבוא ישיר של `@supabase/*`, SQL, כללי עסק (חישוב עצימות, סינון תנוחות וכו') |
| לוגיקה | `packages/core` | TypeScript טהור, פונקציות בלי תופעות לוואי, בדיקות | שום תלות חיצונית, שום רשת, שום React |
| נתונים | `packages/db` | מיגרציות SQL, מדיניות RLS, Edge Functions, לקוח Supabase, שכבת repository | קומפוננטות UI |

**למה ככה:** אפשר להחליף עיצוב בלי לגעת בכללי הבטיחות; אפשר לבדוק את כל כללי הבטיחות בלי מכשיר; ואפשר להחליף ספק מסד נתונים בלי לגעת במסכים.

## 2. זרימת נתונים במפגש

1. המסך שולח "מתאים לי" → `db.willingness.answer()`.
2. השרת (Edge Function `generate-session`) קורא את הפרופילים בהרשאת שרת, מריץ את `core.buildSession()`, ושומר את התוכנית מוצפנת.
3. רגע החשיפה: הלקוח מבקש `db.session.reveal()` ומקבל את התוכנית רק כששני האישורים קיימים.
4. בסיום: `db.session.debrief()` שומר תחקור פרטי בטבלה של המשתמש.

כללי הבטיחות רצים **בשרת**. הלקוח מציג בלבד, ולכן אי אפשר לעקוף אותם מהמכשיר.

## 3. פריסה

| מה | איפה | איך |
| --- | --- | --- |
| קוד | GitHub (ריפו פרטי) | כל שינוי עובר CI: בדיקות core + בדיקת גבולות |
| תצוגה מקדימה בדפדפן הטלפון | Netlify | `expo export -p web` מתוך `netlify.toml`, פריסה אוטומטית מכל push |
| אפליקציה אמיתית | EAS Build (Expo) | APK לאנדרואיד לבדיקות פנימיות; חנויות בהמשך |
| מסד נתונים | Supabase | מיגרציות מ-`packages/db/supabase/migrations` |

התצוגה ב-Netlify היא לבדיקת מסכים וזרימה מהטלפון. רטט, ביומטריה והתראות עובדים רק באפליקציה המותקנת.

## 4. סודות

- בלקוח רק `EXPO_PUBLIC_SUPABASE_URL` ו-`EXPO_PUBLIC_SUPABASE_ANON_KEY`.
- `SUPABASE_SERVICE_ROLE_KEY` ומפתח ההצפנה רק כסודות של Edge Functions. אסור בקוד ואסור ב-Netlify.
- `scripts/check-boundaries.mjs` נכשל אם המחרוזת `service_role` מופיעה בתוך `apps/`.

## 5. איפה כל דבר מהאפיון

| סעיף באפיון | קובץ |
| --- | --- |
| 1.2 עקרונות, 4 הסכמה | `packages/core/src/consent.ts` |
| 1.4 הסכם צימוד | `packages/core/src/pairing.ts` |
| 1.6 ניצוץ | `packages/core/src/spark.ts` |
| 1.8 שובבות | `packages/core/src/spice.ts` |
| 1.13 משחקיות אחראית, 9.2 דרגות | `packages/core/src/progress.ts` |
| 2.2 מבנה מפגש, 9.1 בניית מפגש | `packages/core/src/sessionBuilder.ts` |
| 2.3 קלוריות | `packages/core/src/calories.ts` |
| 3, 9.1 עומס ומפרקים | `packages/core/src/load.ts` |
| 6 מודל נתונים, 5.3 RLS | `packages/db/supabase/migrations/` |
| 8 מסכים | `apps/mobile/app/` |
| 11 בדיקות קבלה | `packages/core/test/`, `packages/db/supabase/tests/` |
