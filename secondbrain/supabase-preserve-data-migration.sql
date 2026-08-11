create extension if not exists "pgcrypto";

-- Sustituye este valor por el UUID de tu usuario en Authentication > Users.
do $$
declare
  target_user_id uuid := '05fe76cd-cf7b-46fd-83ad-1fdf5ec1880e';
  entry_date date;
  canonical_entry_id uuid;
  merged_content text;
begin
  if not exists (select 1 from auth.users where id = target_user_id) then
    raise exception 'El usuario % no existe en auth.users', target_user_id;
  end if;

  if to_regclass('public.diary_entries') is not null then
    for entry_date in select distinct date from public.diary_entries loop
      select id into canonical_entry_id
      from public.diary_entries
      where date = entry_date
      order by (user_id::text = target_user_id::text) desc, created_at asc
      limit 1;

      select string_agg(content, E'\n\n--- Entrada fusionada ---\n\n' order by created_at)
      into merged_content
      from public.diary_entries
      where date = entry_date and coalesce(content, '') <> '';

      update public.diary_entries
      set user_id = target_user_id::text,
          content = coalesce(merged_content, '')
      where id = canonical_entry_id;

      delete from public.diary_entries
      where date = entry_date and id <> canonical_entry_id;
    end loop;
  end if;

  if to_regclass('public.people') is not null then
    if exists (
      select 1 from information_schema.columns
      where table_schema = 'public' and table_name = 'people' and column_name = 'user_id' and data_type = 'uuid'
    ) then
      update public.people set user_id = target_user_id;
    else
      update public.people set user_id = target_user_id::text;
    end if;
  end if;

  if to_regclass('public.mood_data') is not null then
    if exists (
      select 1 from information_schema.columns
      where table_schema = 'public' and table_name = 'mood_data' and column_name = 'user_id' and data_type = 'uuid'
    ) then
      update public.mood_data set user_id = target_user_id;
    else
      update public.mood_data set user_id = target_user_id::text;
    end if;
  end if;
end $$;

create table if not exists public.profiles (
  uid uuid primary key references auth.users(id) on delete cascade,
  email text not null default '',
  display_name text not null default '',
  is_google_user boolean not null default false,
  subscription jsonb not null default '{"plan":"free","status":"inactive"}'::jsonb,
  is_first_login boolean not null default true,
  has_completed_first_payment boolean not null default false,
  show_welcome_modal boolean not null default false,
  created_at timestamptz not null default now(),
  last_login_at timestamptz not null default now()
);

create table if not exists public.people (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  user_id uuid not null,
  relationship text,
  category text,
  description text,
  mention_count integer not null default 0,
  details jsonb not null default '{}'::jsonb
);

create table if not exists public.audio_transcriptions (
  id uuid primary key default gen_random_uuid(),
  entry_id uuid not null,
  audio_url text not null,
  transcription text not null,
  created_at timestamptz not null default now()
);

create table if not exists public.mood_data (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null,
  date date not null,
  stress_level numeric not null default 0,
  happiness_level numeric not null default 0,
  neutral_level numeric not null default 0,
  analysis_summary text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.diary_entries add column if not exists mentioned_people text[] not null default '{}';
alter table public.diary_entries add column if not exists happiness numeric;
alter table public.diary_entries add column if not exists stress numeric;
alter table public.diary_entries add column if not exists tranquility numeric;
alter table public.diary_entries add column if not exists sadness numeric;
alter table public.diary_entries add column if not exists mood_analyzed_at timestamptz;
alter table public.people add column if not exists relationship text;
alter table public.people add column if not exists category text;
alter table public.people add column if not exists description text;
alter table public.people add column if not exists mention_count integer not null default 0;
alter table public.people add column if not exists details jsonb not null default '{}'::jsonb;

do $$
declare
  existing_policy record;
begin
  for existing_policy in
    select tablename, policyname
    from pg_policies
    where schemaname = 'public' and tablename in ('diary_entries', 'people', 'audio_transcriptions', 'mood_data', 'profiles')
  loop
    execute format('drop policy if exists %I on public.%I', existing_policy.policyname, existing_policy.tablename);
  end loop;

  if (select data_type from information_schema.columns where table_schema = 'public' and table_name = 'diary_entries' and column_name = 'user_id') <> 'uuid' then
    alter table public.diary_entries alter column user_id type uuid using user_id::uuid;
  end if;

  if (select data_type from information_schema.columns where table_schema = 'public' and table_name = 'people' and column_name = 'user_id') <> 'uuid' then
    alter table public.people alter column user_id type uuid using user_id::uuid;
  end if;

  if (select data_type from information_schema.columns where table_schema = 'public' and table_name = 'mood_data' and column_name = 'user_id') <> 'uuid' then
    alter table public.mood_data alter column user_id type uuid using user_id::uuid;
  end if;
end $$;

create index if not exists diary_entries_user_date_idx on public.diary_entries (user_id, date desc);
create index if not exists people_user_name_idx on public.people (user_id, name);
create index if not exists mood_data_user_date_idx on public.mood_data (user_id, date desc);
create index if not exists profiles_stripe_customer_idx on public.profiles ((subscription->>'stripeCustomerId'));

alter table public.profiles enable row level security;
alter table public.diary_entries enable row level security;
alter table public.people enable row level security;
alter table public.audio_transcriptions enable row level security;
alter table public.mood_data enable row level security;

drop policy if exists "Users manage their profile" on public.profiles;
drop policy if exists "Users manage their diary entries" on public.diary_entries;
drop policy if exists "Users manage their people" on public.people;
drop policy if exists "Users manage their transcriptions" on public.audio_transcriptions;
drop policy if exists "Users manage their mood data" on public.mood_data;

create policy "Users manage their profile" on public.profiles for all using (uid = auth.uid()) with check (uid = auth.uid());
create policy "Users manage their diary entries" on public.diary_entries for all using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy "Users manage their people" on public.people for all using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy "Users manage their transcriptions" on public.audio_transcriptions for all using (
  exists (select 1 from public.diary_entries where diary_entries.id = audio_transcriptions.entry_id and diary_entries.user_id = auth.uid())
) with check (
  exists (select 1 from public.diary_entries where diary_entries.id = audio_transcriptions.entry_id and diary_entries.user_id = auth.uid())
);
create policy "Users manage their mood data" on public.mood_data for all using (user_id = auth.uid()) with check (user_id = auth.uid());
