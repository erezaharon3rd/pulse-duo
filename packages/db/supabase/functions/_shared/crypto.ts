// הצפנת שדות רגישים בשרת בלבד. המפתח מגיע מסוד של Edge Functions (DATA_KEY, base64 של 32 בתים).
const enc = new TextEncoder();
const dec = new TextDecoder();

async function key(): Promise<CryptoKey> {
  const raw = Deno.env.get('DATA_KEY');
  if (!raw) throw new Error('DATA_KEY missing');
  const bytes = Uint8Array.from(atob(raw), (c) => c.charCodeAt(0));
  return crypto.subtle.importKey('raw', bytes, 'AES-GCM', false, ['encrypt', 'decrypt']);
}

export async function seal(value: unknown): Promise<Uint8Array> {
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const ct = new Uint8Array(await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, await key(), enc.encode(JSON.stringify(value))));
  const out = new Uint8Array(12 + ct.length);
  out.set(iv);
  out.set(ct, 12);
  return out;
}

export async function open<T>(blob: Uint8Array | null): Promise<T | null> {
  if (!blob) return null;
  const pt = await crypto.subtle.decrypt({ name: 'AES-GCM', iv: blob.slice(0, 12) }, await key(), blob.slice(12));
  return JSON.parse(dec.decode(pt)) as T;
}
