-- Apply after importing and reconciling the Firestore snapshot.
alter table public.diary_entries
  add constraint diary_entries_user_id_fkey foreign key (user_id) references auth.users(id) on delete cascade;
alter table public.people
  add constraint people_user_id_fkey foreign key (user_id) references auth.users(id) on delete cascade;
alter table public.audio_transcriptions
  add constraint audio_transcriptions_entry_id_fkey foreign key (entry_id) references public.diary_entries(id) on delete cascade;
alter table public.mood_data
  add constraint mood_data_user_id_fkey foreign key (user_id) references auth.users(id) on delete cascade;
alter table public.people
  add constraint people_user_id_name_key unique (user_id, name);
alter table public.mood_data
  add constraint mood_data_user_id_date_key unique (user_id, date);

drop policy if exists "Users manage their profile" on public.profiles;
drop policy if exists "Users manage their diary entries" on public.diary_entries;
drop policy if exists "Users manage their people" on public.people;
drop policy if exists "Users manage their transcriptions" on public.audio_transcriptions;
drop policy if exists "Users manage their mood data" on public.mood_data;

create policy "Read own profile" on public.profiles for select to authenticated
  using (uid = (select auth.uid()));
create policy "Insert own profile" on public.profiles for insert to authenticated
  with check (uid = (select auth.uid()));
create policy "Update own profile" on public.profiles for update to authenticated
  using (uid = (select auth.uid())) with check (uid = (select auth.uid()));
create policy "Manage own diary entries" on public.diary_entries for all to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
create policy "Manage own people" on public.people for all to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
create policy "Manage own transcriptions" on public.audio_transcriptions for all to authenticated
  using (exists (select 1 from public.diary_entries e where e.id = entry_id and e.user_id = (select auth.uid())))
  with check (exists (select 1 from public.diary_entries e where e.id = entry_id and e.user_id = (select auth.uid())));
create policy "Manage own mood data" on public.mood_data for all to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));

revoke all on public.profiles, public.diary_entries, public.people,
  public.audio_transcriptions, public.mood_data from public, anon, authenticated;
grant select on public.profiles to authenticated;
grant insert (uid, email, display_name, is_google_user) on public.profiles to authenticated;
grant update (email, display_name, is_google_user, last_login_at,
  is_first_login, show_welcome_modal) on public.profiles to authenticated;
grant select, insert, update, delete on public.diary_entries, public.people,
  public.audio_transcriptions, public.mood_data to authenticated;
grant all on public.profiles, public.diary_entries, public.people,
  public.audio_transcriptions, public.mood_data to service_role;
