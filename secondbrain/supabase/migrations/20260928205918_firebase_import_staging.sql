-- Private, recoverable snapshot taken before importing Firebase data.
create schema if not exists migration;
revoke all on schema migration from public, anon, authenticated;

create table migration.before_firebase_diary_entries_20260928 as
select * from public.diary_entries;
create table migration.before_firebase_people_20260928 as
select * from public.people;
create table migration.before_firebase_profiles_20260928 as
select * from public.profiles;
create table migration.before_firebase_audio_transcriptions_20260928 as
select * from public.audio_transcriptions;
create table migration.before_firebase_mood_data_20260928 as
select * from public.mood_data;

create table migration.firebase_user_map (
  firebase_uid text primary key,
  supabase_uid uuid not null references auth.users(id) on delete restrict,
  source_email_hash text not null,
  mapped_at timestamptz not null default now()
);

create table migration.unmapped_firestore_documents (
  source_path text primary key,
  collection_name text not null,
  source_owner text,
  reason text not null,
  document jsonb not null,
  archived_at timestamptz not null default now()
);

alter table migration.before_firebase_diary_entries_20260928 enable row level security;
alter table migration.before_firebase_people_20260928 enable row level security;
alter table migration.before_firebase_profiles_20260928 enable row level security;
alter table migration.before_firebase_audio_transcriptions_20260928 enable row level security;
alter table migration.before_firebase_mood_data_20260928 enable row level security;
alter table migration.firebase_user_map enable row level security;
alter table migration.unmapped_firestore_documents enable row level security;

revoke all on all tables in schema migration from public, anon, authenticated;
