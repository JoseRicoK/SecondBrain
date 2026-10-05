-- Historical bootstrap. Apply the complete supabase/migrations chain for the current schema.
-- The final schema has no profiles.subscription column; do not use this snapshot alone.
create extension if not exists "pgcrypto";

create table public.profiles (
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

create table public.diary_entries (
  id uuid primary key default gen_random_uuid(),
  date date not null,
  content text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  user_id uuid not null references auth.users(id) on delete cascade,
  mentioned_people text[] not null default '{}',
  happiness numeric,
  stress numeric,
  tranquility numeric,
  sadness numeric,
  mood_analyzed_at timestamptz,
  unique (user_id, date)
);

create table public.people (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  user_id uuid not null references auth.users(id) on delete cascade,
  relationship text,
  category text,
  description text,
  mention_count integer not null default 0,
  details jsonb not null default '{}'::jsonb,
  unique (user_id, name)
);

create table public.audio_transcriptions (
  id uuid primary key default gen_random_uuid(),
  entry_id uuid not null references public.diary_entries(id) on delete cascade,
  audio_url text not null,
  transcription text not null,
  created_at timestamptz not null default now()
);

create table public.mood_data (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  date date not null,
  stress_level numeric not null default 0,
  happiness_level numeric not null default 0,
  neutral_level numeric not null default 0,
  analysis_summary text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, date)
);

create index diary_entries_user_date_idx on public.diary_entries (user_id, date desc);
create index people_user_name_idx on public.people (user_id, name);
create index mood_data_user_date_idx on public.mood_data (user_id, date desc);
create index profiles_stripe_customer_idx on public.profiles ((subscription->>'stripeCustomerId'));

alter table public.profiles enable row level security;
alter table public.diary_entries enable row level security;
alter table public.people enable row level security;
alter table public.audio_transcriptions enable row level security;
alter table public.mood_data enable row level security;

create policy "Users manage their profile" on public.profiles for all using (uid = auth.uid()) with check (uid = auth.uid());
create policy "Users manage their diary entries" on public.diary_entries for all using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy "Users manage their people" on public.people for all using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy "Users manage their transcriptions" on public.audio_transcriptions for all using (
  exists (select 1 from public.diary_entries where diary_entries.id = audio_transcriptions.entry_id and diary_entries.user_id = auth.uid())
) with check (
  exists (select 1 from public.diary_entries where diary_entries.id = audio_transcriptions.entry_id and diary_entries.user_id = auth.uid())
);
create policy "Users manage their mood data" on public.mood_data for all using (user_id = auth.uid()) with check (user_id = auth.uid());
