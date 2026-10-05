-- Operational dashboard. No paid access is granted and no diary content is exposed.
begin;
alter table public.profiles add column admin boolean not null default false;
revoke insert,update on public.profiles from public,anon,authenticated;
revoke insert(admin),update(admin) on public.profiles from public,anon,authenticated;
grant insert(uid,email,display_name,is_google_user) on public.profiles to authenticated;
grant update(email,display_name,is_google_user,last_login_at,is_first_login,show_welcome_modal) on public.profiles to authenticated;
-- These records are now surfaced only through authorized operational aggregates.
revoke all on public.billing_events,public.billing_email_outbox,public.feedback_requests,public.usage_reservations from public,anon,authenticated;

create table public.feedback_reports (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(uid) on delete cascade,
  fingerprint text not null unique,
  type text not null check(type in ('suggestion','problem')),
  message text not null check(length(btrim(message)) between 1 and 5000),
  status text not null default 'open' check(status in ('open','in_progress','resolved','closed')),
  priority text not null default 'normal' check(priority in ('low','normal','high','urgent')),
  admin_notes text not null default '' check(length(admin_notes)<=5000),
  updated_by uuid references public.profiles(uid) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index feedback_reports_owner_date_idx on public.feedback_reports(user_id,created_at desc);
create index feedback_reports_status_date_idx on public.feedback_reports(status,created_at desc,id);
create index feedback_reports_date_idx on public.feedback_reports(created_at desc,id);
create index feedback_reports_updated_by_idx on public.feedback_reports(updated_by) where updated_by is not null;
alter table public.feedback_reports enable row level security;
-- API-only access prevents exposing internal notes, even to the submitter.
revoke all on public.feedback_reports from public,anon,authenticated;
grant select,insert,update,delete on public.feedback_reports to service_role;

create function public.submit_feedback(p_user_id uuid,p_fingerprint text,p_type text,p_message text)
returns jsonb language plpgsql security invoker set search_path='' as $$
declare existing uuid; result_id uuid;
begin
  if p_type not in ('suggestion','problem') or length(btrim(p_message)) not between 1 and 5000 or length(p_fingerprint)<>64 then
    raise exception 'Invalid feedback' using errcode='22023';
  end if;
  -- Serialize all submissions from the same owner: retries and the hourly limit are atomic.
  perform 1 from public.profiles where uid=p_user_id for update;
  if not found then raise exception 'Profile not found' using errcode='23503'; end if;
  select id into existing from public.feedback_reports where user_id=p_user_id and fingerprint=p_fingerprint;
  if found then return jsonb_build_object('allowed',true,'id',existing,'duplicate',true); end if;
  if (select count(*) from public.feedback_reports where user_id=p_user_id and created_at>now()-interval '1 hour')>=5 then
    return jsonb_build_object('allowed',false);
  end if;
  insert into public.feedback_reports(user_id,fingerprint,type,message) values(p_user_id,p_fingerprint,p_type,btrim(p_message)) returning id into result_id;
  return jsonb_build_object('allowed',true,'id',result_id,'duplicate',false);
end $$;

create function public.assert_dashboard_admin(p_actor uuid) returns void language plpgsql security invoker set search_path='' as $$
begin
  if not exists(select 1 from public.profiles where uid=p_actor and admin) then
    raise exception 'Administrator required' using errcode='42501';
  end if;
end $$;

-- Auth is not readable by service_role. A private, minimal definer returns only
-- operational fields after checking the actor; it never returns tokens or diary text.
create schema if not exists dashboard_private;
revoke all on schema dashboard_private from public,anon,authenticated;
grant usage on schema dashboard_private to service_role;
create function dashboard_private.accounts(p_actor uuid) returns table(
  uid uuid,email text,display_name text,admin boolean,has_profile boolean,
  created_at timestamptz,last_login_at timestamptz,email_confirmed boolean,
  is_google_user boolean,plan text,effective_plan text,status text,
  current_period_end timestamptz,cancel_at_period_end boolean,
  stripe_customer_id text,stripe_subscription_id text
) language plpgsql stable security definer set search_path='' as $$
begin
  perform public.assert_dashboard_admin(p_actor);
  return query select u.id,coalesce(u.email,'')::text,coalesce(nullif(p.display_name,''),u.raw_user_meta_data->>'display_name',u.raw_user_meta_data->>'full_name',''),
    coalesce(p.admin,false),p.uid is not null,u.created_at,u.last_sign_in_at,u.email_confirmed_at is not null,
    coalesce(p.is_google_user,false),coalesce(s.plan,'free'),
    case when s.status='active' and (s.current_period_end is null or s.current_period_end>now()) then s.plan else 'free' end,
    coalesce(s.status,'inactive'),s.current_period_end,coalesce(s.cancel_at_period_end,false),s.stripe_customer_id,s.stripe_subscription_id
  from auth.users u left join public.profiles p on p.uid=u.id left join public.subscriptions s on s.user_id=u.id;
end $$;

create function public.admin_overview(p_actor uuid) returns jsonb language plpgsql security invoker set search_path='' as $$
declare result jsonb;
begin
  perform public.assert_dashboard_admin(p_actor);
  with accounts as materialized(select * from dashboard_private.accounts(p_actor)),
  monthly as (select generate_series(date_trunc('month',now() at time zone 'UTC')-interval '5 months',date_trunc('month',now() at time zone 'UTC'),interval '1 month')::date as month),
  registrations as(select date_trunc('month',created_at at time zone 'UTC')::date as month,count(*) total from accounts where created_at>=date_trunc('month',now() at time zone 'UTC')-interval '5 months' group by 1),
  writing as(select date_trunc('month',created_at at time zone 'UTC')::date as month,count(*) total from public.diary_entries where content<>'' and created_at>=date_trunc('month',now() at time zone 'UTC')-interval '5 months' group by 1)
  select jsonb_build_object(
    'users',(select count(*) from accounts),
    'admins',(select count(*) from accounts where admin),
    'missingProfiles',(select count(*) from accounts where not has_profile),
    'newUsers30',(select count(*) from accounts where created_at>=now()-interval '30 days'),
    'activeUsers30',(select count(distinct user_id) from public.diary_entries where updated_at>=now()-interval '30 days' and content<>''),
    'entries',(select count(*) from public.diary_entries where content<>''),
    'people',(select count(*) from public.people),
    'transcriptions',(select count(*) from public.audio_transcriptions),
    'analysedEntries',(select count(*) from public.diary_entries where mood_analyzed_at is not null),
    'reports',(select count(*) from public.statistics_reports),
    'plans',(select coalesce(jsonb_object_agg(effective_plan,n),'{}') from (select effective_plan,count(*) n from accounts group by effective_plan)x),
    'subscriptionStates',(select coalesce(jsonb_object_agg(status,n),'{}') from (select status,count(*) n from accounts group by status)x),
    'providerSubscriptions',(select count(*) from accounts where stripe_subscription_id is not null),
    'cancellations',(select count(*) from accounts where cancel_at_period_end),
    'feedback',(select coalesce(jsonb_object_agg(status,n),'{}') from (select status,count(*) n from public.feedback_reports group by status)x),
    'feedbackTypes',(select coalesce(jsonb_object_agg(type,n),'{}') from (select type,count(*) n from public.feedback_reports group by type)x),
    'usage',(select coalesce(jsonb_object_agg(feature,n),'{}') from (select feature,sum(used) n from public.usage_counters where month=date_trunc('month',now() at time zone 'UTC')::date group by feature)x),
    'pendingBillingEmails',(select count(*) from public.billing_email_outbox where status in ('pending','sending')),
    'failedBillingEmails',(select count(*) from public.billing_email_outbox where status='failed'),
    'billingEvents30',(select count(*) from public.billing_events where processed_at>=now()-interval '30 days'),
    'catalog',(select jsonb_agg(to_jsonb(p) order by id) from public.subscription_plans p),
    'monthly',(select jsonb_agg(jsonb_build_object('month',m.month,'users',coalesce(r.total,0),'entries',coalesce(w.total,0)) order by m.month) from monthly m left join registrations r using(month) left join writing w using(month)),
    'generatedAt',now(),'usageMonth',date_trunc('month',now() at time zone 'UTC')::date
  ) into result;
  return result;
end $$;

create function public.admin_users(p_actor uuid,p_query text default '',p_plan text default 'all',p_page integer default 1)
returns jsonb language plpgsql security invoker set search_path='' as $$
declare result jsonb;
begin
  perform public.assert_dashboard_admin(p_actor);
  if p_page not between 1 and 100000 or length(p_query)>100 or p_plan not in ('all','free','pro','elite') then raise exception 'Invalid filters' using errcode='22023'; end if;
  with filtered as materialized(
    select * from dashboard_private.accounts(p_actor) a where (p_plan='all' or effective_plan=p_plan)
    and (p_query='' or strpos(lower(a.email||' '||a.display_name||' '||a.uid::text),lower(p_query))>0)
  ), paged as(select * from filtered order by created_at desc nulls last,uid limit 25 offset (p_page-1)*25), enriched as(
    select to_jsonb(a)||jsonb_build_object(
      'entries',(select count(*) from public.diary_entries where user_id=a.uid and content<>''),
      'people',(select count(*) from public.people where user_id=a.uid),
      'lastEntry',(select max(date) from public.diary_entries where user_id=a.uid and content<>''),
      'usage',(select coalesce(jsonb_object_agg(feature,used),'{}') from public.usage_counters where user_id=a.uid and month=date_trunc('month',now() at time zone 'UTC')::date)
    ) row,a.created_at,a.uid from paged a
  ) select jsonb_build_object('items',(select coalesce(jsonb_agg(row order by created_at desc nulls last,uid),'[]') from enriched),'total',(select count(*) from filtered),'page',p_page,'pageSize',25) into result;
  return result;
end $$;

create function public.admin_user_detail(p_actor uuid,p_user_id uuid) returns jsonb language plpgsql security invoker set search_path='' as $$
declare result jsonb;
begin
  perform public.assert_dashboard_admin(p_actor);
  select to_jsonb(a)||jsonb_build_object(
    'entries',(select count(*) from public.diary_entries where user_id=a.uid and content<>''),
    'people',(select count(*) from public.people where user_id=a.uid),
    'transcriptions',(select count(*) from public.audio_transcriptions t join public.diary_entries e on e.id=t.entry_id where e.user_id=a.uid),
    'analysedEntries',(select count(*) from public.diary_entries where user_id=a.uid and mood_analyzed_at is not null),
    'lastEntry',(select max(date) from public.diary_entries where user_id=a.uid and content<>''),
    'lastActivity',(select max(updated_at) from public.diary_entries where user_id=a.uid),
    'reportGeneratedAt',(select generated_at from public.statistics_reports where user_id=a.uid),
    'feedback',(select count(*) from public.feedback_reports where user_id=a.uid),
    'usageHistory',(select coalesce(jsonb_agg(to_jsonb(c) order by month desc,feature),'[]') from (select month,feature,used,reserved from public.usage_counters where user_id=a.uid and month>=(date_trunc('month',now() at time zone 'UTC')-interval '5 months')::date)c),
    'billingEvents',(select coalesce(jsonb_agg(to_jsonb(b) order by processed_at desc),'[]') from (select id,type,occurred_at,processed_at from public.billing_events where user_id=a.uid order by processed_at desc limit 10)b)
  ) into result from dashboard_private.accounts(p_actor) a where a.uid=p_user_id;
  return result;
end $$;

create function public.admin_feedback(p_actor uuid,p_query text default '',p_type text default 'all',p_status text default 'all',p_page integer default 1)
returns jsonb language plpgsql security invoker set search_path='' as $$
declare result jsonb;
begin
  perform public.assert_dashboard_admin(p_actor);
  if p_page not between 1 and 100000 or length(p_query)>100 or p_type not in ('all','suggestion','problem') or p_status not in ('all','open','in_progress','resolved','closed') then raise exception 'Invalid filters' using errcode='22023'; end if;
  with filtered as materialized(
    select f.id,f.user_id,f.type,f.message,f.status,f.priority,f.admin_notes,f.updated_by,f.created_at,f.updated_at,
      coalesce(u.email,'')::text email,coalesce(p.display_name,'') display_name
    from public.feedback_reports f join dashboard_private.accounts(p_actor) u on u.uid=f.user_id join public.profiles p on p.uid=f.user_id
    where (p_type='all' or f.type=p_type) and (p_status='all' or f.status=p_status)
    and (p_query='' or strpos(lower(f.message||' '||coalesce(u.email,'')::text||' '||p.display_name),lower(p_query))>0)
  ), paged as(select * from filtered order by created_at desc,id limit 20 offset (p_page-1)*20)
  select jsonb_build_object('items',(select coalesce(jsonb_agg(to_jsonb(p) order by created_at desc,id),'[]') from paged p),'total',(select count(*) from filtered),'page',p_page,'pageSize',20) into result;
  return result;
end $$;

create function public.admin_update_feedback(p_actor uuid,p_id uuid,p_status text,p_priority text,p_notes text,p_version timestamptz)
returns jsonb language plpgsql security invoker set search_path='' as $$
declare current_row public.feedback_reports;
begin
  perform public.assert_dashboard_admin(p_actor);
  if p_status not in ('open','in_progress','resolved','closed') or p_priority not in ('low','normal','high','urgent') or p_notes is null or length(p_notes)>5000 or p_version is null then raise exception 'Invalid feedback update' using errcode='22023'; end if;
  select * into current_row from public.feedback_reports where id=p_id for update;
  if not found then return jsonb_build_object('missing',true); end if;
  if current_row.updated_at<>p_version then return jsonb_build_object('conflict',true); end if;
  update public.feedback_reports set status=p_status,priority=p_priority,admin_notes=p_notes,updated_by=p_actor,updated_at=clock_timestamp() where id=p_id returning * into current_row;
  return jsonb_build_object('saved',true,'updatedAt',current_row.updated_at);
end $$;

revoke all on function public.submit_feedback(uuid,text,text,text),public.assert_dashboard_admin(uuid),dashboard_private.accounts(uuid),public.admin_overview(uuid),public.admin_users(uuid,text,text,integer),public.admin_user_detail(uuid,uuid),public.admin_feedback(uuid,text,text,text,integer),public.admin_update_feedback(uuid,uuid,text,text,text,timestamptz) from public,anon,authenticated,service_role;
grant execute on function public.submit_feedback(uuid,text,text,text),public.assert_dashboard_admin(uuid),dashboard_private.accounts(uuid),public.admin_overview(uuid),public.admin_users(uuid,text,text,integer),public.admin_user_detail(uuid,uuid),public.admin_feedback(uuid,text,text,text,integer),public.admin_update_feedback(uuid,uuid,text,text,text,timestamptz) to service_role;
commit;
