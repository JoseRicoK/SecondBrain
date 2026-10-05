begin;
create table public.diary_reanalysis_jobs (
 id uuid primary key default gen_random_uuid(),
 user_id uuid not null references public.profiles(uid) on delete cascade,
 created_by uuid references public.profiles(uid) on delete set null,
 request_id uuid not null unique,
 status text not null default 'running' check(status in ('running','completed','canceled')),
 total integer not null default 0 check(total>=0),
 done integer not null default 0 check(done>=0),
 failed integer not null default 0 check(failed>=0),
 skipped integer not null default 0 check(skipped>=0),
 people_pending integer not null default 0 check(people_pending>=0),
 check(done+failed+skipped<=total),
 created_at timestamptz not null default now(),
 updated_at timestamptz not null default now()
);
create unique index diary_reanalysis_one_active_user on public.diary_reanalysis_jobs(user_id) where status='running';
create index diary_reanalysis_owner_history on public.diary_reanalysis_jobs(user_id,created_at desc);
create index diary_reanalysis_actor on public.diary_reanalysis_jobs(created_by);
create table public.diary_reanalysis_items (
 job_id uuid not null references public.diary_reanalysis_jobs(id) on delete cascade,
 entry_id uuid not null,
 entry_date date not null,
 source_version text not null,
 include_people boolean not null,
 status text not null default 'queued' check(status in ('queued','processing','done','failed','skipped')),
 lease_token uuid,
 lease_until timestamptz,
 error_code text check(error_code in ('provider','invalid','changed','deleted','too_long','canceled')),
 primary key(job_id,entry_id)
);
create index diary_reanalysis_pending on public.diary_reanalysis_items(job_id,status,entry_date,entry_id);
create index diary_reanalysis_issues on public.diary_reanalysis_items(job_id,entry_date desc) where error_code is not null;
alter table public.diary_reanalysis_jobs enable row level security;
alter table public.diary_reanalysis_items enable row level security;
revoke all on public.diary_reanalysis_jobs,public.diary_reanalysis_items from public,anon,authenticated,service_role;
grant select,insert,update,delete on public.diary_reanalysis_jobs,public.diary_reanalysis_items to service_role;

-- No diary text is stored in jobs or returned in the administrative progress API.
create function public.diary_analysis_source(p_entry public.diary_entries) returns text language sql stable set search_path='' as $$
 select md5(jsonb_build_array(p_entry.content,p_entry.date,p_entry.updated_at,p_entry.mentioned_people,p_entry.mood_analyzed_at)::text);
$$;
create function public.admin_reanalysis_summary(p_actor uuid,p_job_id uuid) returns jsonb language plpgsql security invoker set search_path='' as $$
declare result jsonb;
begin
 perform public.assert_dashboard_admin(p_actor);
 select jsonb_build_object('id',j.id,'userId',j.user_id,'status',j.status,'createdAt',j.created_at,
   'total',j.total,'done',j.done,'failed',j.failed,'skipped',j.skipped,
   'pending',j.total-j.done-j.failed-j.skipped,'peoplePending',j.people_pending,
   'inFlight',exists(select 1 from public.diary_reanalysis_items where job_id=j.id and status='processing' and lease_until>now()),
   'issues',coalesce((select jsonb_agg(x) from (select entry_date as date,error_code as code from public.diary_reanalysis_items where job_id=j.id and error_code is not null order by entry_date desc limit 12)x),'[]'::jsonb))
 into result from public.diary_reanalysis_jobs j where j.id=p_job_id;
 return result;
end;
$$;
create function public.admin_reanalysis_status(p_actor uuid,p_user_id uuid) returns jsonb language plpgsql security invoker set search_path='' as $$
declare latest uuid; result jsonb;
begin
 perform public.assert_dashboard_admin(p_actor);
 if not exists(select 1 from public.profiles where uid=p_user_id) then return null; end if;
 select id into latest from public.diary_reanalysis_jobs where user_id=p_user_id order by created_at desc limit 1;
 select jsonb_build_object('eligible',count(*),'peoplePending',count(*) filter(where mood_analyzed_at is null),'job',public.admin_reanalysis_summary(p_actor,latest)) into result
 from public.diary_entries where user_id=p_user_id and btrim(content)<>'' and date<=(now() at time zone 'Europe/Madrid')::date;
 return result;
end;
$$;
create function public.admin_start_reanalysis(p_actor uuid,p_user_id uuid,p_request_id uuid) returns jsonb language plpgsql security invoker set search_path='' as $$
declare job uuid; previous public.diary_reanalysis_jobs;
begin
 perform public.assert_dashboard_admin(p_actor);
 perform 1 from public.profiles where uid=p_user_id for update;
 if not found then return null; end if;
 select * into previous from public.diary_reanalysis_jobs where request_id=p_request_id;
 if found then
  if previous.user_id<>p_user_id or previous.created_by is distinct from p_actor then raise insufficient_privilege; end if;
  return public.admin_reanalysis_summary(p_actor,previous.id);
 end if;
 select id into job from public.diary_reanalysis_jobs where user_id=p_user_id and status='running';
 if job is not null then return public.admin_reanalysis_summary(p_actor,job); end if;
 insert into public.diary_reanalysis_jobs(user_id,created_by,request_id) values(p_user_id,p_actor,p_request_id) returning id into job;
 insert into public.diary_reanalysis_items(job_id,entry_id,entry_date,source_version,include_people)
 select job,id,date,public.diary_analysis_source(d),mood_analyzed_at is null from public.diary_entries d
 where user_id=p_user_id and btrim(content)<>'' and date<=(now() at time zone 'Europe/Madrid')::date;
 update public.diary_reanalysis_jobs set total=(select count(*) from public.diary_reanalysis_items where job_id=job),people_pending=(select count(*) from public.diary_reanalysis_items where job_id=job and include_people) where id=job;
 update public.diary_reanalysis_jobs set status='completed' where id=job and total=0;
 return public.admin_reanalysis_summary(p_actor,job);
end;
$$;
create function public.admin_claim_reanalysis(p_actor uuid,p_job_id uuid) returns jsonb language plpgsql security invoker set search_path='' as $$
declare job public.diary_reanalysis_jobs; item public.diary_reanalysis_items; entry public.diary_entries; token uuid;
begin
 perform public.assert_dashboard_admin(p_actor);
 select * into job from public.diary_reanalysis_jobs where id=p_job_id for update;
 if not found then return null; end if;
 if job.status<>'running' then return jsonb_build_object('job',public.admin_reanalysis_summary(p_actor,p_job_id)); end if;
 if exists(select 1 from public.diary_reanalysis_items where job_id=p_job_id and status='processing' and lease_until>now()) then
  return jsonb_build_object('busy',true,'job',public.admin_reanalysis_summary(p_actor,p_job_id));
 end if;
 -- Interrupted calls require explicit retry, rather than automatically charging the provider again.
 update public.diary_reanalysis_jobs set failed=failed+(select count(*) from public.diary_reanalysis_items where job_id=p_job_id and status='processing'),people_pending=people_pending-(select count(*) from public.diary_reanalysis_items where job_id=p_job_id and status='processing' and include_people) where id=p_job_id;
 update public.diary_reanalysis_items set status='failed',error_code='provider',lease_token=null,lease_until=null where job_id=p_job_id and status='processing';
 select * into item from public.diary_reanalysis_items where job_id=p_job_id and status='queued' order by entry_date,entry_id limit 1 for update;
 if not found then
  update public.diary_reanalysis_jobs set status='completed',updated_at=now() where id=p_job_id;
  return jsonb_build_object('job',public.admin_reanalysis_summary(p_actor,p_job_id));
 end if;
 select * into entry from public.diary_entries where id=item.entry_id and user_id=job.user_id;
 if not found or public.diary_analysis_source(entry)<>item.source_version or length(entry.content)>50000 then
  update public.diary_reanalysis_items set status='skipped',error_code=case when entry.id is null then 'deleted' when length(entry.content)>50000 then 'too_long' else 'changed' end where job_id=p_job_id and entry_id=item.entry_id;
  update public.diary_reanalysis_jobs set skipped=skipped+1,people_pending=people_pending-case when item.include_people then 1 else 0 end,updated_at=now() where id=p_job_id;
  return jsonb_build_object('job',public.admin_reanalysis_summary(p_actor,p_job_id));
 end if;
 token:=gen_random_uuid();
 update public.diary_reanalysis_items set status='processing',lease_token=token,lease_until=now()+interval '5 minutes',error_code=null where job_id=p_job_id and entry_id=item.entry_id;
 return jsonb_build_object('job',public.admin_reanalysis_summary(p_actor,p_job_id),'claim',jsonb_build_object('entryId',entry.id,'userId',job.user_id,'date',entry.date,'text',entry.content,'includePeople',item.include_people,'token',token));
end;
$$;
create function public.admin_finish_reanalysis(p_actor uuid,p_job_id uuid,p_entry_id uuid,p_token uuid,p_mood jsonb,p_people jsonb,p_error text default null) returns jsonb language plpgsql security invoker set search_path='' as $$
declare job public.diary_reanalysis_jobs; item public.diary_reanalysis_items; entry public.diary_entries; update_person jsonb; current_person public.people; score text; names text[]; outcome text:='done'; issue text;
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
   -- Lock/recheck every optimistic version before any write. Rebase against current facts without another AI call.
   for update_person in select value from jsonb_array_elements(p_people) order by value->>'name' loop
    if jsonb_typeof(update_person->'name')<>'string' or length(btrim(update_person->>'name')) not between 1 and 120 or jsonb_typeof(update_person->'details')<>'object' then raise exception 'Invalid person' using errcode='22023'; end if;
    select * into current_person from public.people where user_id=job.user_id and lower(regexp_replace(btrim(name),'\s+',' ','g'))=lower(regexp_replace(btrim(update_person->>'name'),'\s+',' ','g')) for update;
    if (current_person.id is not null and (current_person.id::text is distinct from update_person->>'id' or current_person.updated_at is distinct from (update_person->>'version')::timestamptz)) or (current_person.id is null and update_person->>'id' is not null) then
     return jsonb_build_object('conflict',true,'job',public.admin_reanalysis_summary(p_actor,p_job_id));
    end if;
   end loop;
   begin
   for update_person in select value from jsonb_array_elements(p_people) loop
    if update_person->>'id' is null then
     insert into public.people(user_id,name,details) values(job.user_id,update_person->>'name',update_person->'details');
    else
     update public.people set details=update_person->'details' where id=(update_person->>'id')::uuid and user_id=job.user_id;
    end if;
   end loop;
   exception when unique_violation then
    return jsonb_build_object('conflict',true,'job',public.admin_reanalysis_summary(p_actor,p_job_id));
   end;
   select coalesce(array_agg(distinct value->>'name'),'{}') into names from jsonb_array_elements(p_people);
  end if;
  update public.diary_entries set happiness=(p_mood->>'happiness')::numeric,tranquility=(p_mood->>'tranquility')::numeric,stress=(p_mood->>'stress')::numeric,sadness=(p_mood->>'sadness')::numeric,neutral=(p_mood->>'neutral')::numeric,
   mentioned_people=case when item.include_people then names else mentioned_people end,mood_analyzed_at=clock_timestamp(),updated_at=clock_timestamp()
  where id=p_entry_id and user_id=job.user_id;
 end if;
 update public.diary_reanalysis_items set status=outcome,error_code=issue,lease_token=null,lease_until=null where job_id=p_job_id and entry_id=p_entry_id;
 update public.diary_reanalysis_jobs set done=done+case when outcome='done' then 1 else 0 end,failed=failed+case when outcome='failed' then 1 else 0 end,skipped=skipped+case when outcome='skipped' then 1 else 0 end,people_pending=people_pending-case when item.include_people then 1 else 0 end,updated_at=now(),status=case when exists(select 1 from public.diary_reanalysis_items where job_id=p_job_id and status in ('queued','processing')) then 'running' else 'completed' end where id=p_job_id;
 return jsonb_build_object('job',public.admin_reanalysis_summary(p_actor,p_job_id));
end;
$$;
create function public.admin_control_reanalysis(p_actor uuid,p_job_id uuid,p_action text) returns jsonb language plpgsql security invoker set search_path='' as $$
declare job public.diary_reanalysis_jobs;
begin
 perform public.assert_dashboard_admin(p_actor);
 select * into job from public.diary_reanalysis_jobs where id=p_job_id;
 if not found then return null; end if;
 perform 1 from public.profiles where uid=job.user_id for update;
 select * into job from public.diary_reanalysis_jobs where id=p_job_id for update;
 if p_action='cancel' and job.status='running' then
  update public.diary_reanalysis_items set status='skipped',error_code='canceled',lease_token=null,lease_until=null where job_id=p_job_id and status in ('queued','processing');
  update public.diary_reanalysis_jobs set skipped=total-done-failed,people_pending=0,status='canceled',updated_at=now() where id=p_job_id;
 elsif p_action='retry' and job.status<>'canceled' then
  perform 1 from public.profiles where uid=job.user_id for update;
  if exists(select 1 from public.diary_reanalysis_jobs where user_id=job.user_id and status='running' and id<>p_job_id) then raise exception 'Another active job' using errcode='23505'; end if;
  update public.diary_reanalysis_jobs set people_pending=people_pending+(select count(*) from public.diary_reanalysis_items where job_id=p_job_id and status='failed' and include_people) where id=p_job_id;
  update public.diary_reanalysis_items set status='queued',error_code=null where job_id=p_job_id and status='failed';
  if found then update public.diary_reanalysis_jobs set failed=0,status='running',updated_at=now() where id=p_job_id; end if;
 elsif p_action not in ('cancel','retry') then raise exception 'Invalid action' using errcode='22023';
 end if;
 return public.admin_reanalysis_summary(p_actor,p_job_id);
end;
$$;
revoke all on function public.diary_analysis_source(public.diary_entries),public.admin_reanalysis_summary(uuid,uuid),public.admin_reanalysis_status(uuid,uuid),public.admin_start_reanalysis(uuid,uuid,uuid),public.admin_claim_reanalysis(uuid,uuid),public.admin_finish_reanalysis(uuid,uuid,uuid,uuid,jsonb,jsonb,text),public.admin_control_reanalysis(uuid,uuid,text) from public,anon,authenticated,service_role;
grant execute on function public.diary_analysis_source(public.diary_entries),public.admin_reanalysis_summary(uuid,uuid),public.admin_reanalysis_status(uuid,uuid),public.admin_start_reanalysis(uuid,uuid,uuid),public.admin_claim_reanalysis(uuid,uuid),public.admin_finish_reanalysis(uuid,uuid,uuid,uuid,jsonb,jsonb,text),public.admin_control_reanalysis(uuid,uuid,text) to service_role;
notify pgrst,'reload schema';
commit;
