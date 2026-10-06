begin;
-- Private diagnostic name, written only after the worker generation/lease checks.
alter table public.diary_analysis_jobs add column error_person_name text check (length(error_person_name) between 1 and 120);

create or replace function public.enqueue_diary_analysis() returns trigger
language plpgsql security definer set search_path='' as $$
begin
 if tg_op='UPDATE' and new.content is not distinct from old.content and new.date is not distinct from old.date then return new; end if;
 insert into public.diary_analysis_jobs(entry_id,user_id,status,error_code)
 values(new.id,new.user_id,case when btrim(new.content)='' then 'skipped' when length(new.content)>50000 then 'failed' else 'queued' end,case when length(new.content)>50000 then 'too_long' else null end)
 on conflict(entry_id) do update set generation=gen_random_uuid(),status=excluded.status,error_code=excluded.error_code,error_person_name=null,attempts=0,lease_token=null,lease_until=null,published_generation=null,published_at=null,updated_at=clock_timestamp();
 return new;
end; $$;

create or replace function public.retry_diary_analysis(p_owner uuid,p_entry_id uuid) returns uuid
language plpgsql security invoker set search_path='' as $$
declare job public.diary_analysis_jobs; entry public.diary_entries;
begin
 select * into entry from public.diary_entries where id=p_entry_id and user_id=p_owner for update;
 if not found or btrim(entry.content)='' or length(entry.content)>50000 then return null; end if;
 select * into job from public.diary_analysis_jobs where entry_id=p_entry_id for update;
 if found and job.status in ('queued','processing') then return job.id; end if;
 if found and job.updated_at>now()-interval '30 seconds' and job.status='done' then return job.id; end if;
 insert into public.diary_analysis_jobs(entry_id,user_id) values(p_entry_id,p_owner)
 on conflict(entry_id) do update set generation=gen_random_uuid(),status='queued',attempts=0,lease_token=null,lease_until=null,published_generation=null,published_at=null,error_code=null,error_person_name=null,updated_at=clock_timestamp()
 returning id into job.id;
 return job.id;
end; $$;

create or replace function public.finish_diary_analysis(p_job_id uuid,p_generation uuid,p_token uuid,p_mood jsonb,p_people jsonb,p_error text default null) returns jsonb
language plpgsql security invoker set search_path='' as $$
declare job public.diary_analysis_jobs; entry public.diary_entries; item jsonb; person public.people; score text; ids uuid[]; names text[];
begin
 select * into job from public.diary_analysis_jobs where id=p_job_id;
 if not found then return jsonb_build_object('stale',true); end if;
 select * into entry from public.diary_entries where id=job.entry_id and user_id=job.user_id for update;
 if not found then return jsonb_build_object('stale',true); end if;
 select * into job from public.diary_analysis_jobs where id=p_job_id for update;
 if job.generation<>p_generation or job.status<>'processing' or job.lease_token is distinct from p_token or job.lease_until<=now() then return jsonb_build_object('stale',true); end if;
 if p_error is not null then
  if p_error not in ('provider','ambiguous','conflict') then raise exception 'Invalid failure' using errcode='22023'; end if;
  update public.diary_analysis_jobs set status=case when p_error='provider' and attempts<3 then 'queued' else 'failed' end,error_code=p_error,error_person_name=case when p_error='ambiguous' and jsonb_typeof(p_people->'ambiguousPersonName')='string' then nullif(left(btrim(regexp_replace(p_people->>'ambiguousPersonName','[[:cntrl:]]',' ','g')),120),'') else null end,lease_token=null,lease_until=null,updated_at=clock_timestamp() where id=p_job_id;
  return jsonb_build_object('retry',p_error='provider' and job.attempts<3);
 end if;
 if p_mood is null or jsonb_typeof(p_mood)<>'object' or (select count(*) from jsonb_object_keys(p_mood))<>5 then raise exception 'Invalid mood' using errcode='22023'; end if;
 foreach score in array array['happiness','tranquility','stress','sadness','neutral'] loop
  if not(p_mood ? score) or (jsonb_typeof(p_mood->score)<>'null' and (jsonb_typeof(p_mood->score)<>'number' or not((p_mood->>score)::numeric between 0 and 100))) then raise exception 'Invalid score' using errcode='22023'; end if;
 end loop;
 if p_people is null or jsonb_typeof(p_people)<>'array' or jsonb_array_length(p_people)>100 then raise exception 'Invalid people' using errcode='22023'; end if;
 if (select count(distinct value->>'id') from jsonb_array_elements(p_people))<>jsonb_array_length(p_people) then raise exception 'Duplicate person identity' using errcode='22023'; end if;
 for item in select value from jsonb_array_elements(p_people) order by value->>'id' loop
  if jsonb_typeof(item->'name')<>'string' or length(btrim(item->>'name')) not between 1 and 120 or jsonb_typeof(item->'details')<>'object' then raise exception 'Invalid person' using errcode='22023'; end if;
  select * into person from public.people where id=(item->>'id')::uuid for update;
  if found then
   if person.user_id<>job.user_id then raise insufficient_privilege; end if;
   if person.updated_at is distinct from (item->>'version')::timestamptz then return jsonb_build_object('conflict',true); end if;
  elsif item->>'version' is not null then return jsonb_build_object('conflict',true);
  end if;
 end loop;
 begin
 for item in select value from jsonb_array_elements(p_people) loop
  if item->>'version' is null then
   insert into public.people(id,user_id,name,details) values((item->>'id')::uuid,job.user_id,item->>'name',item->'details');
  else
   update public.people set details=item->'details' where id=(item->>'id')::uuid and user_id=job.user_id;
  end if;
 end loop;
 exception when unique_violation then return jsonb_build_object('conflict',true);
 end;
 select coalesce(array_agg(distinct (value->>'id')::uuid),'{}'),coalesce(array_agg(distinct value->>'name'),'{}') into ids,names from jsonb_array_elements(p_people);
 update public.diary_entries set happiness=(p_mood->>'happiness')::numeric,tranquility=(p_mood->>'tranquility')::numeric,stress=(p_mood->>'stress')::numeric,sadness=(p_mood->>'sadness')::numeric,neutral=(p_mood->>'neutral')::numeric,mentioned_person_ids=ids,mentioned_people=names,mood_analyzed_at=clock_timestamp(),updated_at=clock_timestamp() where id=entry.id and user_id=job.user_id;
 update public.diary_analysis_jobs set status='done',error_code=null,error_person_name=null,lease_token=null,lease_until=null,updated_at=clock_timestamp() where id=p_job_id;
 return jsonb_build_object('done',true);
end; $$;

revoke all on function public.enqueue_diary_analysis() from public,anon,authenticated,service_role;
revoke all on function public.retry_diary_analysis(uuid,uuid),public.finish_diary_analysis(uuid,uuid,uuid,jsonb,jsonb,text) from public,anon,authenticated,service_role;
grant execute on function public.retry_diary_analysis(uuid,uuid),public.finish_diary_analysis(uuid,uuid,uuid,jsonb,jsonb,text) to service_role;
notify pgrst,'reload schema';
commit;
