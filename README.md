# PULSE DUO

אפליקציית מובייל לזוגות (18+) שמתייחסת למין כספורט. האפיון המלא: [Claude Doc](https://claude.ai/artifact/4KRwzvrvJ44xkqwdfu7yNK).

## מבנה

| תיקייה | שכבה | תפקיד |
| --- | --- | --- |
| `apps/mobile` | ממשק | Expo / React Native: 5 מסכים, אנימציות, רטט, מחוות |
| `packages/core` | לוגיקה | כללי הסכמה, בניית מפגש, עומס, דרגות, שובבות. TypeScript טהור + בדיקות |
| `packages/db` | נתונים | סכמת Postgres, RLS, Edge Functions, לקוח גישה לנתונים |

פירוט מלא: [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md).

## פקודות

```bash
npm test                 # בדיקות הלוגיקה + בדיקת גבולות השכבות
npm run build:web        # בניית תצוגה מקדימה לדפדפן (Netlify)
npm --workspace apps/mobile start   # הרצה על הטלפון עם Expo Go
```

## סטטוס

- [x] שכבת לוגיקה עם 26 בדיקות קבלה מחלק 11 באפיון – כולן עוברות
- [x] סכמת מסד נתונים + RLS + בדיקות RLS בין חשבונות (רצות ב-CI)
- [x] Edge Functions: תשובת רצון ובניית מפגש, חשיפה
- [x] 5 מסכים במצב הדגמה
- [ ] Edge Functions נוספות: צימוד, הסכם, ניצוץ, ערוץ, תחקור, הקפאה
- [ ] מאגר תנוחות (`packages/db/supabase/functions/_shared/poses.json`) – ממתין לסקירת פיזיותרפיה
- [ ] חיבור לפרויקט Supabase אמיתי
