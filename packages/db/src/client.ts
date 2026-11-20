// שכבת הגישה לנתונים. הממשק מדבר רק עם הפונקציות כאן – אף פעם לא עם Supabase ישירות.
import { createClient, type SupabaseClient } from '@supabase/supabase-js';

export interface DbConfig {
  url: string;
  anonKey: string;
  storage?: {
    getItem(k: string): Promise<string | null>;
    setItem(k: string, v: string): Promise<void>;
    removeItem(k: string): Promise<void>;
  };
  /** בדפדפן: לקלוט את הכניסה מהקישור שבמייל. */
  detectSessionInUrl?: boolean;
}

let sb: SupabaseClient | null = null;

export function initDb(cfg: DbConfig): void {
  if (sb) return;
  sb = createClient(cfg.url, cfg.anonKey, {
    auth: { storage: cfg.storage, persistSession: true, autoRefreshToken: true, detectSessionInUrl: cfg.detectSessionInUrl ?? false, flowType: 'implicit' },
  });
}

function db(): SupabaseClient {
  if (!sb) throw new Error('initDb() was not called');
  return sb;
}

async function call<T>(fn: string, body: unknown): Promise<T> {
  const { data, error } = await db().functions.invoke(`api/${fn}`, { body });
  if (error) throw error;
  return data as T;
}

// ---------- כניסה ----------
export const auth = {
  /** קישור כניסה למייל (הרשמה וכניסה באותו מסך). redirectTo = כתובת האתר שאליה הקישור מחזיר. */
  async sendLink(email: string, redirectTo?: string) {
    const { error } = await db().auth.signInWithOtp({ email, options: { shouldCreateUser: true, emailRedirectTo: redirectTo } });
    if (error) throw error;
  },
  /** קוד מהמייל (כשיהיה SMTP משלנו עם תבנית קוד). */
  async verifyCode(email: string, token: string) {
    const { error } = await db().auth.verifyOtp({ email, token, type: 'email' });
    if (error) throw error;
  },
  /** מחכה שהכניסה מהקישור תיקלט, ומחזיר את מזהה המשתמש או null. */
  async ready(): Promise<string | null> {
    const { data } = await db().auth.getSession();
    return data.session?.user.id ?? null;
  },
  onSignedIn(cb: (userId: string) => void) {
    const { data } = db().auth.onAuthStateChange((_e, session) => {
      if (session?.user) cb(session.user.id);
    });
    return () => data.subscription.unsubscribe();
  },
  signOut: () => db().auth.signOut(),
  currentUserId: async () => (await db().auth.getUser()).data.user?.id ?? null,
};

// ---------- פרופיל ----------
export interface ProfileInput {
  nickname: string;
  birthYear: number;
  heightCm?: number;
  weightKg?: number;
  addressForm: 'm' | 'f' | 'plural';
}

export const profile = {
  async save(p: ProfileInput) {
    const user_id = await auth.currentUserId();
    const { error } = await db().from('profiles').upsert({
      user_id,
      nickname: p.nickname,
      birth_year: p.birthYear,
      height_cm: p.heightCm,
      weight_kg: p.weightKg,
      address_form: p.addressForm,
    });
    if (error) throw error;
  },
  get: async () => (await db().from('profiles').select('*').maybeSingle()).data,
  /** הסינון נשמר מוצפן דרך פונקציית שרת. */
  saveScreening: (flags: string[]) => call<{ ok: true; nextRecheckAt: string }>('save-screening', { flags }),
};

// ---------- צימודים ----------
export interface PairingCard {
  pairingId: string;
  coupleName: string | null;
  level: number;
  frozenUntil: string | null;
}

export const pairings = {
  async list(): Promise<PairingCard[]> {
    const { data } = await db().from('pairings').select('pairing_id, couple_name, level, frozen_until');
    return (data ?? []).map((r) => ({ pairingId: r.pairing_id, coupleName: r.couple_name, level: r.level, frozenUntil: r.frozen_until }));
  },
  createInvite: () => call<{ link: string; pin: string; pairingId: string }>('pairing-invite', {}),
  join: (code: string, pin: string) => call<{ pairingId: string }>('pairing-join', { code, pin }),
  voteAgreement: (pairingId: string, agreement: 'exclusive' | 'non_exclusive') =>
    call<{ matched: boolean | null; message?: string }>('pairing-agreement', { pairingId, agreement }),
  /** 0 = הפשרה */
  freeze: (pairingId: string, days: 0 | 7 | 14 | 30) => call<{ frozenUntil: string | null }>('pairing-freeze', { pairingId, days }),
  unpair: (pairingId: string, fromReport = false) => call<{ deleteAt?: string; deleted?: boolean }>('pairing-unpair', { pairingId, fromReport }),
  /** ביטול פירוק בתוך 24 השעות (רק מי שפירק) */
  cancelUnpair: (pairingId: string) => call<{ cancelled: boolean }>('pairing-unpair', { pairingId, cancel: true }),
};

// ---------- מפגש ----------
export interface RevealedPlan {
  steps: { title: string; subtitle: string; seconds: number }[];
}

export const session = {
  answer: (sessionId: string, answer: 'yes' | 'not_today', energy: 'recovery' | 'balanced' | 'high') =>
    call<{ status: string; message: string | null }>('answer-willingness', { sessionId, answer, energy }),
  /** התוכנית כבר מוכנה לתצוגה: כותרת, תת-כותרת ושניות לכל שלב. */
  reveal: (sessionId: string) => call<{ plan: RevealedPlan }>('reveal-session', { sessionId }),
  debrief: (sessionId: string, d: { effort: number; pain: number; painPoseId?: string; feeling: string }) =>
    call<{ minutes: number; kcal: { low: number; high: number }; checkIn: boolean }>('save-debrief', { sessionId, ...d }),
};

// ---------- ניצוץ וערוץ ----------
export const spark = {
  send: (pairingId: string, when: 'now' | 'tonight' | 'kids_asleep') => call<{ sent: boolean; senderSees?: string; sparkId?: string; expiresAt?: string }>('spark-send', { pairingId, when }),
  reply: (sparkId: string, reply: 'yes_now' | 'yes_hour' | 'yes_tonight' | 'hug' | 'talk' | 'touch_only' | 'not_now') =>
    call<{ ok: true; sessionId: string | null; senderWillSee: string }>('spark-reply', { sparkId, reply }),
};

export const channel = {
  send: (pairingId: string, kind: 'proposal' | 'reminder' | 'hype' | 'thinking_of_you' | 'talk', cardId: string) =>
    call<{ ok: true; sessionId: string | null }>('channel-send', { pairingId, kind, cardId }),
};
