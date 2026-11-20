// הצפנת שדות רגישים בשרת בלבד. המפתח מגיע מסוד של Edge Functions (DATA_KEY, base64 של 32 בתים).
// עמודות bytea עוברות ב-PostgREST כמחרוזת hex בפורמט '\x…', ולכן seal מחזיר מחרוזת כזו.
const enc = new TextEncoder();
const dec = new TextDecoder();

async function key(): Promise<CryptoKey> {
  const raw = Deno.env.get('DATA_KEY');
  if (!raw) throw new Error('DATA_KEY missing');
  const bytes = Uint8Array.from(atob(raw), (c) => c.charCodeAt(0));
  if (bytes.length !== 32) throw new Error('DATA_KEY must be 32 bytes');
  return crypto.subtle.importKey('raw', bytes, 'AES-GCM', false, ['encrypt', 'decrypt']);
}

const toHex = (b: Uint8Array) => '\\x' + Array.from(b, (x) => x.toString(16).padStart(2, '0')).join('');
const fromHex = (s: string) => {
  const h = s.startsWith('\\x') ? s.slice(2) : s;
  return Uint8Array.from(h.match(/../g) ?? [], (x) => parseInt(x, 16));
};

export async function seal(value: unknown): Promise<string> {
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const ct = new Uint8Array(await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, await key(), enc.encode(JSON.stringify(value))));
  const out = new Uint8Array(12 + ct.length);
  out.set(iv);
  out.set(ct, 12);
  return toHex(out);
}

export async function open<T>(blob: string | null | undefined): Promise<T | null> {
  if (!blob) return null;
  const b = fromHex(blob);
  const pt = await crypto.subtle.decrypt({ name: 'AES-GCM', iv: b.slice(0, 12) }, await key(), b.slice(12));
  return JSON.parse(dec.decode(pt)) as T;
}

/** גיבוב לקודי הזמנה ו-PIN: נשמר רק הגיבוב, לא הקוד. */
export async function sha256(s: string): Promise<string> {
  const d = new Uint8Array(await crypto.subtle.digest('SHA-256', enc.encode(s)));
  return Array.from(d, (x) => x.toString(16).padStart(2, '0')).join('');
}

export function randomCode(bytes = 16): string {
  const b = crypto.getRandomValues(new Uint8Array(bytes));
  return btoa(String.fromCharCode(...b)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

export function randomPin(): string {
  const n = crypto.getRandomValues(new Uint32Array(1))[0] % 10000;
  return n.toString().padStart(4, '0');
}
