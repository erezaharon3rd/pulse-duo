-- PULSE DUO – סכמה ראשונית (אפיון חלק 6).
-- עיקרון: כל מידע של אדם אחד בטבלה עם user_id ומדיניות user_id = auth.uid() בלבד.
-- טבלאות זוגיות: קריאה לחברי הצימוד; כתיבה רק דרך Edge Functions (service role).

create extension if not exists pgcrypto;

-- ---------- enums ----------
create type intensity as enum ('recovery', 'balanced', 'high');
create type joint as enum ('lowerBack', 'hips', 'knees', 'wrists', 'shoulders', 'neck');
create type severity as enum ('mild', 'severe');
create type back_type as enum ('flexion', 'extension', 'unknown');
create type agreement as enum ('exclusive', 'non_exclusive');
create type session_status as enum ('proposed', 'confirmed', 'postponed', 'done', 'stopped');
create type feeling as enum ('rose', 'there_from_start', 'calm', 'did_not_arise', 'uncomfortable', 'did_not_want');
create type willingness_answer as enum ('yes', 'not_today');
create type joint_status as enum ('green', 'yellow', 'red');

-- ---------- פרטי ----------
create table profiles (
  user_id uuid primary key references auth.users on delete cascade,
  nickname text not null check (char_length(nickname) between 2 and 20),
  birth_year int not null check (birth_year <= extract(year from now())::int - 18),
  height_cm int, weight_kg int,
  fitness_level int not null default 3 check (fitness_level between 1 and 5),
  address_form text not null default 'plural' check (address_form in ('m', 'f', 'plural')),
  intensity_cap_self intensity not null default 'high',
  kids_at_home boolean not null default false,
  sounds boolean not null default false,
  show_calories boolean not null default false,
  gentle_mode boolean not null default false,
  pending_questions text[] not null default '{}',
  created_at timestamptz not null default now()
);

create table screening (
  user_id uuid primary key references auth.users on delete cascade,
  completed_at timestamptz not null default now(),
  flags_enc bytea,          -- מוצפן בשרת (KMS)
  cleared_flags_enc bytea,
  next_recheck_at timestamptz
);

create table limitations (
  user_id uuid references auth.users on delete cascade,
  joint joint not null,
  severity severity not null,
  back_type back_type,
  hip_approach text check (hip_approach in ('posterior', 'anterior', 'unknown')),
  primary key (user_id, joint)
);

create table joint_status_t (
  user_id uuid references auth.users on delete cascade,
  joint joint not null,
  status joint_status not null default 'green',
  rest_until timestamptz,
  return_sessions_left int not null default 0,
  mild_pain_count int not null default 0,
  primary key (user_id, joint)
);

-- ---------- צימוד ----------
create table pairings (
  pairing_id uuid primary key default gen_random_uuid(),
  couple_name text check (char_length(couple_name) between 2 and 24),
  agreement agreement,                -- נקבע רק כשהבחירות תואמות
  level int not null default 1 check (level between 1 and 5),
  level_since timestamptz not null default now(),
  streak_weeks int not null default 0,
  frozen_until timestamptz,
  pending_delete_at timestamptz,
  gamification_paused_until timestamptz,
  created_at timestamptz not null default now()
);

create table pairing_members (
  pairing_id uuid references pairings on delete cascade,
  user_id uuid references auth.users on delete cascade,
  joined_at timestamptz not null default now(),
  primary key (pairing_id, user_id)
);

-- בדיוק 2 חברים לצימוד
create function enforce_two_members() returns trigger language plpgsql set search_path = public as $$
begin
  if (select count(*) from pairing_members where pairing_id = new.pairing_id) >= 2 then
    raise exception 'pairing already has two members';
  end if;
  return new;
end $$;
create trigger trg_two_members before insert on pairing_members
  for each row execute function enforce_two_members();

create function is_member(p uuid) returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from pairing_members where pairing_id = p and user_id = auth.uid());
$$;

-- פרטי לכל חבר בצימוד
create table my_pairing_settings (
  user_id uuid references auth.users on delete cascade,
  pairing_id uuid references pairings on delete cascade,
  agreement_vote agreement,
  spice_level int not null default 2 check (spice_level between 1 and 5),
  hard_limits_enc bytea,
  warmup_week_of date,
  warmup_did_not_want int not null default 0,
  spark_weekly_quota int not null default 4,
  max_weekly int not null default 3,
  wants_preview boolean not null default false,
  streak_opt_in boolean not null default false,
  primary key (user_id, pairing_id)
);

create table pairing_invites (
  code_hash text primary key,
  inviter_id uuid references auth.users on delete cascade,
  pairing_id uuid references pairings on delete cascade,
  confirm_pin_hash text not null,
  expires_at timestamptz not null default now() + interval '48 hours',
  used boolean not null default false
);

create table schedule_slots (
  pairing_id uuid references pairings on delete cascade,
  weekday int check (weekday between 0 and 6),
  at_time time not null,
  tz text not null default 'Asia/Jerusalem',
  length_min int not null check (length_min in (15, 30))
);

create table sessions (
  session_id uuid primary key default gen_random_uuid(),
  pairing_id uuid references pairings on delete cascade,
  scheduled_at timestamptz not null,
  origin text not null check (origin in ('schedule', 'proposal', 'spark')),
  status session_status not null default 'proposed',
  intensity intensity,
  plan_enc bytea,              -- נשלח ללקוח רק ברגע החשיפה
  revealed_at timestamptz
);

create table willingness (
  session_id uuid references sessions on delete cascade,
  user_id uuid references auth.users on delete cascade,
  answer willingness_answer not null,
  energy intensity not null default 'balanced',
  answered_on date not null default current_date,
  primary key (session_id, user_id)
);

create table debriefs (
  session_id uuid references sessions on delete cascade,
  user_id uuid references auth.users on delete cascade,
  effort int check (effort between 1 and 5),
  pain int check (pain between 0 and 10),
  pain_pose_id text,
  feeling feeling,
  created_at timestamptz not null default now(),
  primary key (session_id, user_id)
);

create table thanks (
  session_id uuid references sessions on delete cascade,
  user_id uuid references auth.users on delete cascade,
  text_enc bytea not null,
  primary key (session_id, user_id)
);

create table my_session_stats (
  session_id uuid references sessions on delete cascade,
  user_id uuid references auth.users on delete cascade,
  minutes numeric, kcal_low int, kcal_high int, load int, new_poses int,
  primary key (session_id, user_id)
);

create table sparks (
  spark_id uuid primary key default gen_random_uuid(),
  pairing_id uuid references pairings on delete cascade,
  sender_id uuid references auth.users on delete cascade,
  created_at timestamptz not null default now(),
  expires_at timestamptz not null,
  reply text check (reply in ('yes_now','yes_hour','yes_tonight','hug','talk','touch_only','not_now'))
);

create table pairing_messages (
  msg_id uuid primary key default gen_random_uuid(),
  pairing_id uuid references pairings on delete cascade,
  sender_id uuid references auth.users on delete cascade,
  kind text not null check (kind in ('proposal','reminder','hype','thinking_of_you','talk')),
  payload jsonb not null default '{}',   -- רק מזהי כרטיסים מוכנים, אין טקסט חופשי ב-MVP
  created_at timestamptz not null default now(),
  expires_at timestamptz not null default now() + interval '7 days'
);

create table favorites (
  user_id uuid references auth.users on delete cascade,
  pairing_id uuid references pairings on delete cascade,
  pose_id text not null,
  primary key (user_id, pairing_id, pose_id)
);

create table pose_history (
  pairing_id uuid references pairings on delete cascade,
  pose_id text not null,
  last_used_at timestamptz not null,
  primary key (pairing_id, pose_id)
);

create table growth_invites (
  code_hash text primary key,
  inviter_id uuid references auth.users on delete cascade,
  created_at timestamptz not null default now(),
  redeemed_by uuid references auth.users on delete set null,
  reward_pairing_id uuid references pairings on delete set null
);

-- ---------- RLS ----------
do $$
declare t text;
begin
  foreach t in array array[
    'profiles','screening','limitations','joint_status_t','pairings','pairing_members','my_pairing_settings',
    'pairing_invites','schedule_slots','sessions','willingness','debriefs','thanks','my_session_stats',
    'sparks','pairing_messages','favorites','pose_history','growth_invites'
  ] loop
    execute format('alter table %I enable row level security', t);
    execute format('alter table %I force row level security', t);
  end loop;
end $$;

-- פרטי: רק הבעלים, קריאה וכתיבה
create policy own_profiles on profiles for all using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy own_limitations on limitations for all using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy own_settings on my_pairing_settings for all using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy own_favorites on favorites for all using (user_id = auth.uid()) with check (user_id = auth.uid());
-- פרטי: רק קריאה מהלקוח; כתיבה דרך פונקציות שרת (הצפנה / כללים)
create policy own_screening_r on screening for select using (user_id = auth.uid());
create policy own_joints_r on joint_status_t for select using (user_id = auth.uid());
create policy own_willingness_r on willingness for select using (user_id = auth.uid());
create policy own_debriefs_r on debriefs for select using (user_id = auth.uid());
create policy own_stats_r on my_session_stats for select using (user_id = auth.uid());
create policy own_growth_r on growth_invites for select using (inviter_id = auth.uid());

-- זוגי: קריאה לחברי הצימוד בלבד; אין מדיניות כתיבה (רק service role)
create policy member_pairings on pairings for select using (is_member(pairing_id));
create policy member_members on pairing_members for select using (is_member(pairing_id));
create policy member_slots on schedule_slots for select using (is_member(pairing_id));
create policy member_history on pose_history for select using (is_member(pairing_id));
create policy member_sparks on sparks for select using (is_member(pairing_id));
create policy member_messages on pairing_messages for select using (is_member(pairing_id) and expires_at > now());
-- מפגשים: בלי plan_enc (עמודה זו לא נחשפת – ראו view למטה)
revoke select on sessions from anon, authenticated;
grant select (session_id, pairing_id, scheduled_at, origin, status, intensity, revealed_at) on sessions to authenticated;
create view sessions_public with (security_invoker = true) as
  select session_id, pairing_id, scheduled_at, origin, status, intensity, revealed_at from sessions;
create policy member_sessions on sessions for select using (is_member(pairing_id));
grant select on sessions_public to authenticated;
-- thanks: כל אחד רואה את שלו; את של הצד השני רק אחרי ששניהם כתבו (דרך פונקציית שרת)
create policy own_thanks_r on thanks for select using (user_id = auth.uid());
-- pairing_invites: אין גישה ישירה מהלקוח
