begin;

-- A person's UUID is its identity. Names and relationships are editable attributes.
alter table public.diary_entries add column mentioned_person_ids uuid[];
alter table public.people drop constraint if exists people_user_id_name_key;
drop index if exists public.people_owner_normalized_name_key;
create index people_owner_name_lookup on public.people(user_id,lower(regexp_replace(btrim(name),'\s+',' ','g')));
create index diary_person_identity_lookup on public.diary_entries using gin(mentioned_person_ids);

-- Null IDs mean legacy, unresolved membership. [] means an explicit analysis with no people.
-- No historical text/facts are reassigned by this migration.
create function public.validate_diary_person_identities() returns trigger
language plpgsql security definer set search_path='' as $$
begin
 if current_setting('role',true) in ('anon','authenticated') and auth.uid() is distinct from new.user_id then raise insufficient_privilege; end if;
 if new.mentioned_person_ids is not null then
  if cardinality(new.mentioned_person_ids)>100 or exists (
   select 1 from unnest(new.mentioned_person_ids) as membership(person_id) where membership.person_id is null or not exists(select 1 from public.people p where p.id=membership.person_id and p.user_id=new.user_id)
  ) then raise exception 'Invalid person membership' using errcode='23514'; end if;
  new.mentioned_person_ids:=array(select distinct id from unnest(new.mentioned_person_ids) id);
 end if;
 return new;
end;
$$;
create trigger diary_person_identity_validation before insert or update of mentioned_person_ids,user_id on public.diary_entries for each row execute function public.validate_diary_person_identities();

create or replace function public.enforce_person_information() returns trigger
language plpgsql security definer set search_path='' as $$
begin
 if current_setting('role',true) in ('anon','authenticated') and auth.uid() is distinct from new.user_id then raise insufficient_privilege; end if;
 new.name:=regexp_replace(btrim(normalize(new.name,NFC)),'\s+',' ','g');
 if new.name='' then raise exception 'A person name is required' using errcode='23514'; end if;
 new.details:=public.normalize_person_details(new.details);
 select count(*) into new.mention_count from public.diary_entries d where d.user_id=new.user_id and (
  new.id=any(d.mentioned_person_ids) or (d.mentioned_person_ids is null and not exists (
   select 1 from public.people other where other.user_id=new.user_id and other.id<>new.id and lower(other.name)=lower(new.name)
  ) and exists(select 1 from unnest(d.mentioned_people) n where lower(regexp_replace(btrim(n),'\s+',' ','g'))=lower(new.name)))
 );
 new.updated_at:=clock_timestamp();
 return new;
end;
$$;
create or replace function public.refresh_diary_person_mentions() returns trigger
language plpgsql security definer set search_path='' as $$
declare owner_id uuid;
begin
 owner_id:=case when tg_op='DELETE' then old.user_id else new.user_id end;
 if current_setting('role',true) in ('anon','authenticated') and auth.uid() is distinct from owner_id then raise insufficient_privilege; end if;
 if tg_op='UPDATE' and new.mentioned_people is not distinct from old.mentioned_people and new.mentioned_person_ids is not distinct from old.mentioned_person_ids then return new; end if;
 update public.people p set mention_count=p.mention_count where p.user_id=owner_id and (
  (tg_op<>'INSERT' and (p.id=any(old.mentioned_person_ids) or p.name=any(old.mentioned_people))) or
  (tg_op<>'DELETE' and (p.id=any(new.mentioned_person_ids) or p.name=any(new.mentioned_people)))
 );
 return coalesce(new,old);
end;
$$;
drop trigger diary_person_mentions on public.diary_entries;
create trigger diary_person_mentions after insert or update of mentioned_people,mentioned_person_ids or delete on public.diary_entries for each row execute function public.refresh_diary_person_mentions();

create or replace function public.rename_diary_person_mentions() returns trigger
language plpgsql security definer set search_path='' as $$
begin
 if current_setting('role',true) in ('anon','authenticated') and auth.uid() is distinct from new.user_id then raise insufficient_privilege; end if;
 update public.diary_entries d set mentioned_people=case when d.mentioned_person_ids is not null then
  array(select p.name from public.people p where p.user_id=new.user_id and p.id=any(d.mentioned_person_ids))
 else array(select case when lower(n)=lower(old.name) then new.name else n end from unnest(d.mentioned_people) n) end
 where d.user_id=new.user_id and (new.id=any(d.mentioned_person_ids) or (d.mentioned_person_ids is null and not exists(select 1 from public.people p where p.user_id=new.user_id and p.id<>new.id and lower(p.name)=lower(old.name)) and old.name=any(d.mentioned_people)));
 return new;
end;
$$;
revoke all on function public.validate_diary_person_identities() from public,anon,authenticated,service_role;
create or replace function public.admin_finish_reanalysis(p_actor uuid,p_job_id uuid,p_entry_id uuid,p_token uuid,p_mood jsonb,p_people jsonb,p_error text default null) returns jsonb language plpgsql security invoker set search_path='' as $$
declare job public.diary_reanalysis_jobs; item public.diary_reanalysis_items; entry public.diary_entries; update_person jsonb; current_person public.people; score text; names text[]; person_ids uuid[]; outcome text:='done'; issue text;
begin
 perform public.assert_dashboard_admin(p_actor);
 select * into job from public.diary_reanalysis_jobs where id=p_job_id for update;
 if not found then return null; end if;
 select * into item from public.diary_reanalysis_items where job_id=p_job_id and entry_id=p_entry_id for update;
 if not found or job.status<>'running' or item.status<>'processing' or item.lease_token is distinct from p_token or item.lease_until<=now() then
  return jsonb_build_object('stale',true,'job',public.admin_reanalysis_summary(p_actor,p_job_id));
 end if;
 select * into entry from public.diary_entries where id=p_entry_id and user_id=job.user_id for update;
 if not found or public.diary_analysis_source(entry)<>item.source_version then
  outcome:='skipped'; issue:=case when entry.id is null then 'deleted' else 'changed' end;
 elsif p_error is not null then
  if p_error not in ('provider','invalid') then raise exception 'Invalid failure' using errcode='22023'; end if;
  outcome:='failed'; issue:=p_error;
 else
  if p_mood is null or jsonb_typeof(p_mood)<>'object' or (select count(*) from jsonb_object_keys(p_mood))<>5 then raise exception 'Invalid mood' using errcode='22023'; end if;
  foreach score in array array['happiness','tranquility','stress','sadness','neutral'] loop
   if not(p_mood ? score) or (jsonb_typeof(p_mood->score)<>'null' and (jsonb_typeof(p_mood->score)<>'number' or not((p_mood->>score)::numeric between 0 and 100))) then raise exception 'Invalid mood score' using errcode='22023'; end if;
  end loop;
  if item.include_people then
   if p_people is null or jsonb_typeof(p_people)<>'array' or jsonb_array_length(p_people)>100 then raise exception 'Invalid people' using errcode='22023'; end if;
   select coalesce(jsonb_agg(value || jsonb_build_object('id',coalesce(value->>'id',gen_random_uuid()::text))),'[]'::jsonb) into p_people from jsonb_array_elements(p_people);
   -- Lock/recheck every optimistic version before any write. Rebase against current facts without another AI call.
   for update_person in select value from jsonb_array_elements(p_people) order by value->>'name' loop
    if jsonb_typeof(update_person->'name')<>'string' or length(btrim(update_person->>'name')) not between 1 and 120 or jsonb_typeof(update_person->'details')<>'object' then raise exception 'Invalid person' using errcode='22023'; end if;
    select * into current_person from public.people where user_id=job.user_id and id=(update_person->>'id')::uuid for update;
    if (current_person.id is not null and (current_person.id::text is distinct from update_person->>'id' or current_person.updated_at is distinct from (update_person->>'version')::timestamptz)) or (current_person.id is null and update_person->>'version' is not null) then
     return jsonb_build_object('conflict',true,'job',public.admin_reanalysis_summary(p_actor,p_job_id));
    end if;
   end loop;
   begin
   for update_person in select value from jsonb_array_elements(p_people) loop
    if update_person->>'version' is null then
     insert into public.people(id,user_id,name,details) values((update_person->>'id')::uuid,job.user_id,update_person->>'name',update_person->'details');
    else
     update public.people set details=update_person->'details' where id=(update_person->>'id')::uuid and user_id=job.user_id;
    end if;
   end loop;
   exception when unique_violation then
    return jsonb_build_object('conflict',true,'job',public.admin_reanalysis_summary(p_actor,p_job_id));
   end;
   select coalesce(array_agg(distinct (value->>'id')::uuid),'{}') into person_ids from jsonb_array_elements(p_people);
   select coalesce(array_agg(distinct value->>'name'),'{}') into names from jsonb_array_elements(p_people);
  end if;
  update public.diary_entries set happiness=(p_mood->>'happiness')::numeric,tranquility=(p_mood->>'tranquility')::numeric,stress=(p_mood->>'stress')::numeric,sadness=(p_mood->>'sadness')::numeric,neutral=(p_mood->>'neutral')::numeric,
   mentioned_person_ids=case when item.include_people then person_ids else mentioned_person_ids end,mentioned_people=case when item.include_people then names else mentioned_people end,mood_analyzed_at=clock_timestamp(),updated_at=clock_timestamp()
  where id=p_entry_id and user_id=job.user_id;
 end if;
 update public.diary_reanalysis_items set status=outcome,error_code=issue,lease_token=null,lease_until=null where job_id=p_job_id and entry_id=p_entry_id;
 update public.diary_reanalysis_jobs set done=done+case when outcome='done' then 1 else 0 end,failed=failed+case when outcome='failed' then 1 else 0 end,skipped=skipped+case when outcome='skipped' then 1 else 0 end,people_pending=people_pending-case when item.include_people then 1 else 0 end,updated_at=now(),status=case when exists(select 1 from public.diary_reanalysis_items where job_id=p_job_id and status in ('queued','processing')) then 'running' else 'completed' end where id=p_job_id;
 return jsonb_build_object('job',public.admin_reanalysis_summary(p_actor,p_job_id));
end;
$$;

notify pgrst,'reload schema';
commit;
