// אכיפת ההפרדה בין השכבות. נכשל (exit 1) על כל הפרה.
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';

const root = new URL('..', import.meta.url).pathname;

function files(dir) {
  const out = [];
  for (const name of readdirSync(dir)) {
    if (name === 'node_modules' || name === 'dist' || name.startsWith('.')) continue;
    const p = join(dir, name);
    if (statSync(p).isDirectory()) out.push(...files(p));
    else if (/\.(ts|tsx|js|mjs)$/.test(name)) out.push(p);
  }
  return out;
}

const rules = [
  {
    layer: 'apps/mobile (ממשק)',
    dir: 'apps/mobile',
    forbid: [
      [/from ['"]@supabase\//, 'הממשק לא מדבר עם Supabase ישירות – רק דרך @pulse/db'],
      [/service_role|SERVICE_ROLE/, 'מפתח שירות אסור בקוד לקוח'],
      [/\bfrom ['"]@pulse\/core['"]/, 'הממשק לא מריץ כללי עסק – רק השרת. מותר רק `import type`'],
    ],
    allowTypeImports: true,
  },
  {
    layer: 'packages/core (לוגיקה)',
    dir: 'packages/core/src',
    forbid: [
      [/from ['"](?!\.)/, 'שכבת הלוגיקה בלי תלויות חיצוניות'],
      [/\bfetch\(|XMLHttpRequest|Deno\.|process\.env/, 'שכבת הלוגיקה בלי רשת ובלי סביבה'],
      [/react/i, 'שכבת הלוגיקה בלי React'],
    ],
  },
  {
    layer: 'packages/db/src (לקוח נתונים)',
    dir: 'packages/db/src',
    forbid: [
      [/react-native|from ['"]react['"]/, 'שכבת הנתונים בלי UI'],
      [/service_role|SERVICE_ROLE/, 'מפתח שירות רק ב-Edge Functions'],
    ],
  },
];

let failed = 0;
for (const r of rules) {
  for (const f of files(join(root, r.dir))) {
    const lines = readFileSync(f, 'utf8').split('\n');
    lines.forEach((line, i) => {
      if (line.trim().startsWith('//')) return;
      if (r.allowTypeImports && /^\s*import type /.test(line)) return;
      for (const [re, why] of r.forbid) {
        if (re.test(line)) {
          console.error(`✗ ${relative(root, f)}:${i + 1} [${r.layer}] ${why}\n    ${line.trim()}`);
          failed++;
        }
      }
    });
  }
}

if (failed) {
  console.error(`\n${failed} הפרות גבולות.`);
  process.exit(1);
}
console.log('✓ גבולות השכבות תקינים');
