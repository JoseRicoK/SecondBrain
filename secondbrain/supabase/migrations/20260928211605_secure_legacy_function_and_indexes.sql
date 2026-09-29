-- Legacy one-off transformer must not remain callable through the Data API.
alter function public.migrate_people_details_with_dates()
  set search_path = pg_catalog, public, pg_temp;
revoke all on function public.migrate_people_details_with_dates()
  from public, anon, authenticated;

create index if not exists audio_transcriptions_entry_id_idx
  on public.audio_transcriptions(entry_id);
create index if not exists firebase_user_map_supabase_uid_idx
  on migration.firebase_user_map(supabase_uid);
