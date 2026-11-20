// אורז את פונקציית השרת api לקובץ אחד לפריסה (bun build). הפלט ב-packages/db/supabase/.build (לא נשמר בגיט).
import { execSync } from 'node:child_process';
const root = new URL('..', import.meta.url).pathname;
execSync('node scripts/sync-core.mjs', { cwd: root, stdio: 'inherit' });
execSync(
  "bun build packages/db/supabase/functions/api/index.ts --target=browser --format=esm --external 'npm:*' --outfile packages/db/supabase/.build/api.js",
  { cwd: root, stdio: 'inherit' },
);
