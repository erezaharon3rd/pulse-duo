// לקוחות Supabase בצד שרת: אחד בהרשאות המשתמש (לזיהוי), אחד בהרשאות שירות (לכתיבה מבוקרת).
import { createClient, type SupabaseClient } from 'npm:@supabase/supabase-js@2';

export interface Ctx {
  userId: string;
  admin: SupabaseClient;
}

export async function context(req: Request): Promise<Ctx> {
  const url = Deno.env.get('SUPABASE_URL')!;
  const auth = req.headers.get('Authorization') ?? '';
  const asUser = createClient(url, Deno.env.get('SUPABASE_ANON_KEY')!, { global: { headers: { Authorization: auth } } });
  const { data, error } = await asUser.auth.getUser();
  if (error || !data.user) throw new HttpError(401, 'unauthorized');
  const admin = createClient(url, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);
  return { userId: data.user.id, admin };
}

export class HttpError extends Error {
  constructor(public status: number, message: string) {
    super(message);
  }
}

export async function assertMember(ctx: Ctx, pairingId: string): Promise<string> {
  const { data } = await ctx.admin.from('pairing_members').select('user_id').eq('pairing_id', pairingId);
  const ids = (data ?? []).map((r: { user_id: string }) => r.user_id);
  if (!ids.includes(ctx.userId)) throw new HttpError(403, 'not a member');
  return ids.find((id) => id !== ctx.userId)!;
}

export function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } });
}

export function handle(fn: (req: Request) => Promise<Response>) {
  return async (req: Request) => {
    try {
      return await fn(req);
    } catch (e) {
      // לא מחזירים פרטים פנימיים, ולא רושמים גוף בקשה ללוג
      const status = e instanceof HttpError ? e.status : 500;
      return json({ error: status === 500 ? 'server_error' : (e as Error).message }, status);
    }
  };
}

/** הצימודים הפעילים של המשתמש, בפורמט של כללי הלוגיקה. */
export async function myPairings(ctx: Ctx, excludeId?: string) {
  const { data } = await ctx.admin
    .from('pairing_members')
    .select('pairing_id, pairings!inner(agreement, pending_delete_at)')
    .eq('user_id', ctx.userId);
  return (data ?? [])
    .filter((r: any) => r.pairing_id !== excludeId)
    .map((r: any) => ({
      pairingId: r.pairing_id as string,
      agreement: (r.pairings.agreement ?? 'non_exclusive') as 'exclusive' | 'non_exclusive',
      active: !r.pairings.pending_delete_at,
    }));
}

export async function loadPairing(ctx: Ctx, pairingId: string) {
  const { data } = await ctx.admin.from('pairings').select('*').eq('pairing_id', pairingId).maybeSingle();
  if (!data) throw new HttpError(404, 'not found');
  return data;
}

export const isFrozen = (p: { frozen_until: string | null; pending_delete_at: string | null }) =>
  !!p.pending_delete_at || (!!p.frozen_until && new Date(p.frozen_until) > new Date());

export async function body<T>(req: Request): Promise<T> {
  try {
    return (await req.json()) as T;
  } catch {
    throw new HttpError(400, 'bad json');
  }
}
