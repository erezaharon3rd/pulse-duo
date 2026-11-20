-- תמיכה בפונקציות השרת: ניסיונות PIN, רמז זמן לניצוץ, ותחזוקה אוטומטית.

alter table pairing_invites add column pin_attempts int not null default 0;
alter table pairings add column unpaired_by uuid references auth.users on delete set null;
alter table sparks add column when_hint text check (when_hint in ('now', 'tonight', 'kids_asleep'));
alter table sparks add column receiver_id uuid references auth.users on delete cascade;
create unique index sessions_pairing_time on sessions (pairing_id, scheduled_at);
create index sparks_receiver_week on sparks (receiver_id, created_at);
create index messages_sender_day on pairing_messages (sender_id, created_at);

-- מפגשים מהלו"ז ל-24 השעות הקרובות (לא בצימוד מוקפא, בפירוק, או בלי הסכם)
create or replace function private.create_scheduled_sessions() returns int
language plpgsql security definer set search_path = public as $$
declare n int;
begin
  insert into sessions (pairing_id, scheduled_at, origin)
  select s.pairing_id, ((((now() at time zone s.tz)::date + d) + s.at_time) at time zone s.tz), 'schedule'
  from schedule_slots s
  join pairings p using (pairing_id)
  cross join generate_series(0, 1) d
  where extract(dow from ((now() at time zone s.tz)::date + d)) = s.weekday
    and ((((now() at time zone s.tz)::date + d) + s.at_time) at time zone s.tz) between now() and now() + interval '24 hours'
    and p.agreement is not null
    and p.pending_delete_at is null
    and (p.frozen_until is null or p.frozen_until < now())
  on conflict (pairing_id, scheduled_at) do nothing;
  get diagnostics n = row_count;
  return n;
end $$;

-- ניקוי: פירוקים שהגיע זמנם, הודעות והזמנות שפגו
create or replace function private.housekeeping() returns void
language plpgsql security definer set search_path = public as $$
begin
  delete from pairings where pending_delete_at is not null and pending_delete_at <= now();
  delete from pairing_messages where expires_at <= now();
  delete from pairing_invites where expires_at <= now() or used;
  delete from sparks where expires_at <= now() - interval '30 days';
  -- צימוד שנוצר אבל אף אחד לא הצטרף אליו תוך 48 שעות
  delete from pairings p where p.created_at <= now() - interval '48 hours'
    and (select count(*) from pairing_members m where m.pairing_id = p.pairing_id) < 2;
end $$;

revoke all on function private.create_scheduled_sessions() from public, anon, authenticated;
revoke all on function private.housekeeping() from public, anon, authenticated;

create extension if not exists pg_cron;
select cron.schedule('pulse-schedule', '*/15 * * * *', 'select private.create_scheduled_sessions()');
select cron.schedule('pulse-housekeeping', '7 * * * *', 'select private.housekeeping()');
