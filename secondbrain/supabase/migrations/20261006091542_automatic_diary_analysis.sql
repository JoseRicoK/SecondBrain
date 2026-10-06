begin;
-- One durable outbox row per diary entry; never duplicate diary text in the queue.
create table public.diary_analysis_jobs (
 id uuid primary key default gen_random_uuid(),
 entry_id uuid not null unique references public.diary_entries(id) on delete cascade,
 user_id uuid not null references auth.users(id) on delete cascade,
 generation uuid not null default gen_random_uuid(),
 status text not null default 'queued' check(status in ('queued','processing','done','failed','skipped')),
 attempts integer not null default 0 check(attempts between 0 and 3),
 lease_token uuid, lease_until timestamptz,
 published_generation uuid, published_at timestamptz,
 error_code text check(error_code in ('provider','ambiguous','conflict','too_long')),
 updated_at timestamptz not null default now()
);
create index diary_analysis_pending on public.diary_analysis_jobs(updated_at) where status in ('queued','processing');
alter table public.diary_analysis_jobs enable row level security;
revoke all on public.diary_analysis_jobs from public,anon,authenticated;
grant all on public.diary_analysis_jobs to service_role;

create function public.enqueue_diary_analysis() returns trigger
language plpgsql security definer set search_path='' as $$
begin
 if tg_op='UPDATE' and new.content is not distinct from old.content and new.date is not distinct from old.date then return new; end if;
 insert into public.diary_analysis_jobs(entry_id,user_id,status,error_code)
 values(new.id,new.user_id,case when btrim(new.content)='' then 'skipped' when length(new.content)>50000 then 'failed' else 'queued' end,case when length(new.content)>50000 then 'too_long' else null end)
 on conflict(entry_id) do update set generation=gen_random_uuid(),status=excluded.status,error_code=excluded.error_code,attempts=0,lease_token=null,lease_until=null,published_generation=null,published_at=null,updated_at=clock_timestamp();
 return new;
end; $$;
create trigger diary_analysis_enqueue after insert or update of content,date on public.diary_entries for each row execute function public.enqueue_diary_analysis();
revoke all on function public.enqueue_diary_analysis() from public,anon,authenticated,service_role;

-- All workers lock entry -> job -> people, matching the save trigger's lock order.
create function public.claim_diary_analysis(p_job_id uuid,p_generation uuid) returns jsonb
language plpgsql security invoker set search_path='' as $$
declare job public.diary_analysis_jobs; entry public.diary_entries; token uuid:=gen_random_uuid();
begin
 select * into job from public.diary_analysis_jobs where id=p_job_id;
 if not found then return null; end if;
 perform pg_advisory_xact_lock(hashtextextended(job.user_id::text,61006));
 select * into entry from public.diary_entries where id=job.entry_id and user_id=job.user_id for update;
 if not found then return null; end if;
 select * into job from public.diary_analysis_jobs where id=p_job_id for update;
 if job.generation<>p_generation or job.status not in ('queued','processing') then return null; end if;
 if (job.status='processing' and job.lease_until>now()) or exists(select 1 from public.diary_analysis_jobs other where other.user_id=job.user_id and other.id<>job.id and other.status='processing' and other.lease_until>now()) then return jsonb_build_object('busy',true); end if;
 if job.attempts>=3 then
  update public.diary_analysis_jobs set status='failed',error_code='provider',lease_token=null,lease_until=null where id=p_job_id;
  return null;
 end if;
 update public.diary_analysis_jobs set status='processing',attempts=attempts+1,lease_token=token,lease_until=now()+interval '5 minutes',updated_at=clock_timestamp() where id=p_job_id;
 return jsonb_build_object('entryId',entry.id,'userId',entry.user_id,'date',entry.date,'text',entry.content,'token',token);
end; $$;

create function public.retry_diary_analysis(p_owner uuid,p_entry_id uuid) returns uuid
language plpgsql security invoker set search_path='' as $$
declare job public.diary_analysis_jobs; entry public.diary_entries;
begin
 select * into entry from public.diary_entries where id=p_entry_id and user_id=p_owner for update;
 if not found or btrim(entry.content)='' or length(entry.content)>50000 then return null; end if;
 select * into job from public.diary_analysis_jobs where entry_id=p_entry_id for update;
 if found and job.status in ('queued','processing') then return job.id; end if;
 if found and job.updated_at>now()-interval '30 seconds' and job.status='done' then return job.id; end if;
 insert into public.diary_analysis_jobs(entry_id,user_id) values(p_entry_id,p_owner)
 on conflict(entry_id) do update set generation=gen_random_uuid(),status='queued',attempts=0,lease_token=null,lease_until=null,published_generation=null,published_at=null,error_code=null,updated_at=clock_timestamp()
 returning id into job.id;
 return job.id;
end; $$;

create function public.finish_diary_analysis(p_job_id uuid,p_generation uuid,p_token uuid,p_mood jsonb,p_people jsonb,p_error text default null) returns jsonb
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
  update public.diary_analysis_jobs set status=case when p_error='provider' and attempts<3 then 'queued' else 'failed' end,error_code=p_error,lease_token=null,lease_until=null,updated_at=clock_timestamp() where id=p_job_id;
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
 update public.diary_analysis_jobs set status='done',error_code=null,lease_token=null,lease_until=null,updated_at=clock_timestamp() where id=p_job_id;
 return jsonb_build_object('done',true);
end; $$;
revoke all on function public.claim_diary_analysis(uuid,uuid),public.retry_diary_analysis(uuid,uuid),public.finish_diary_analysis(uuid,uuid,uuid,jsonb,jsonb,text) from public,anon,authenticated,service_role;
grant execute on function public.claim_diary_analysis(uuid,uuid),public.retry_diary_analysis(uuid,uuid),public.finish_diary_analysis(uuid,uuid,uuid,jsonb,jsonb,text) to service_role;
notify pgrst,'reload schema';
commit;
