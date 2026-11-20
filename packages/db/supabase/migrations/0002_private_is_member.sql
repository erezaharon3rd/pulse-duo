-- סורק האבטחה של Supabase: פונקציית SECURITY DEFINER לא תהיה חשופה דרך ה-API.
-- מעבירים את is_member לסכמה פרטית שלא נחשפת ב-REST.
create schema if not exists private;
grant usage on schema private to authenticated;

create function private.is_member(p uuid) returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.pairing_members where pairing_id = p and user_id = auth.uid());
$$;
revoke all on function private.is_member(uuid) from public, anon;
grant execute on function private.is_member(uuid) to authenticated;

alter policy member_pairings on pairings using (private.is_member(pairing_id));
alter policy member_members on pairing_members using (private.is_member(pairing_id));
alter policy member_slots on schedule_slots using (private.is_member(pairing_id));
alter policy member_history on pose_history using (private.is_member(pairing_id));
alter policy member_sparks on sparks using (private.is_member(pairing_id));
alter policy member_messages on pairing_messages using (private.is_member(pairing_id) and expires_at > now());
alter policy member_sessions on sessions using (private.is_member(pairing_id));

drop function public.is_member(uuid);
