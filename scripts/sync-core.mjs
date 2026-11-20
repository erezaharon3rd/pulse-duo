// מעתיק את שכבת הלוגיקה לתוך פונקציות השרת, כדי שכל פונקציה תיפרס עם אותם כללים בדיוק.
// `--check` נכשל אם העותק לא מעודכן (רץ ב-CI).
import { mkdirSync, readdirSync, readFileSync, rmSync, writeFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';

const root = new URL('..', import.meta.url).pathname;
const src = join(root, 'packages/core/src');
const dst = join(root, 'packages/db/supabase/functions/_shared/core');
const header = '// נוצר אוטומטית מ-packages/core/src על ידי scripts/sync-core.mjs. לא לערוך כאן.\n';
const check = process.argv.includes('--check');

let stale = 0;
const names = readdirSync(src).filter((n) => n.endsWith('.ts'));
if (!check) {
  rmSync(dst, { recursive: true, force: true });
  mkdirSync(dst, { recursive: true });
}
for (const n of names) {
  const want = header + readFileSync(join(src, n), 'utf8');
  const p = join(dst, n);
  if (check) {
    if (!existsSync(p) || readFileSync(p, 'utf8') !== want) {
      console.error(`✗ ${n} לא מסונכרן. הריצו: npm run sync:core`);
      stale++;
    }
  } else writeFileSync(p, want);
}
if (check && existsSync(dst) && readdirSync(dst).length !== names.length) stale++;
if (stale) process.exit(1);
console.log(check ? '✓ הלוגיקה בשרת מסונכרנת' : `✓ הועתקו ${names.length} קבצים`);
