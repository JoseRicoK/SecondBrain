-- Apply before releasing the application that consumes this schema. No external payments.
begin;
create table public.subscription_plans (
  id text primary key check (id in ('free','pro','elite')),
  personal_chat_messages integer not null check(personal_chat_messages >= -1),
  person_chat_messages integer not null check(person_chat_messages >= -1),
  statistics_access integer not null check(statistics_access >= -1)
);
insert into public.subscription_plans values ('free',5,10,0),('pro',30,100,10),('elite',100,500,-1);
create table public.subscriptions (
  user_id uuid primary key references public.profiles(uid) on delete cascade,
  plan text not null default 'free' references public.subscription_plans(id),
  status text not null default 'inactive' check(status in ('active','inactive','canceled','past_due')),
  stripe_customer_id text unique,
  stripe_subscription_id text unique,
  current_period_end timestamptz,
  cancel_at_period_end boolean not null default false,
  provider_event_at timestamptz,
  created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create index subscriptions_expiry_idx on public.subscriptions(current_period_end) where cancel_at_period_end and status='active';
create table public.usage_counters (
  user_id uuid not null references public.profiles(uid) on delete cascade,
  month date not null check(extract(day from month)=1),
  feature text not null check(feature in ('personalChatMessages','personChatMessages','statisticsAccess')),
  used integer not null default 0 check(used>=0),
  reserved integer not null default 0 check(reserved>=0),
  updated_at timestamptz not null default now(), primary key(user_id,month,feature)
);
create table public.usage_reservations (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null, month date not null, feature text not null,
  status text not null default 'reserved' check(status in ('reserved','completed','released')),
  expires_at timestamptz not null default now()+interval '20 minutes',
  created_at timestamptz not null default now(),
  foreign key(user_id,month,feature) references public.usage_counters on delete cascade
);
create index usage_reservations_pending_idx on public.usage_reservations(user_id,month,feature,expires_at) where status='reserved';
create table public.billing_events (
  id text primary key, user_id uuid not null references public.profiles(uid) on delete cascade,
  type text not null, occurred_at timestamptz not null, processed_at timestamptz not null default now()
);
create index billing_events_user_idx on public.billing_events(user_id,processed_at desc);
create table public.billing_email_outbox (
  event_id text primary key references public.billing_events(id) on delete cascade,
  user_id uuid not null references public.profiles(uid) on delete cascade,
  payload jsonb not null,
  status text not null default 'pending' check(status in ('pending','sending','sent','failed')),
  attempts integer not null default 0, lease_until timestamptz,
  created_at timestamptz not null default now(), sent_at timestamptz
);
create index billing_email_outbox_pending_idx on public.billing_email_outbox(created_at) where status in ('pending','sending');
create table public.statistics_reports (
  user_id uuid primary key references public.profiles(uid) on delete cascade,
  report jsonb not null, generated_at timestamptz not null default now()
);
-- Typed backfill; preserve provider references and historical usage, including older months.
insert into public.subscriptions(user_id,plan,status,stripe_customer_id,stripe_subscription_id,current_period_end,cancel_at_period_end,created_at,updated_at)
select uid, coalesce(subscription->>'plan','free'),coalesce(subscription->>'status','inactive'),
nullif(subscription->>'stripeCustomerId',''),nullif(subscription->>'stripeSubscriptionId',''),
nullif(subscription->>'currentPeriodEnd','')::timestamptz,coalesce((subscription->>'cancelAtPeriodEnd')::boolean,false),
coalesce((subscription->>'createdAt')::timestamptz,created_at),coalesce((subscription->>'updatedAt')::timestamptz,created_at) from public.profiles;
insert into public.usage_counters(user_id,month,feature,used)
select p.uid, ((p.subscription->'monthlyUsage'->>'month')||'-01')::date, f,
greatest(coalesce((p.subscription->'monthlyUsage'->>f)::integer,0),0)
from public.profiles p cross join unnest(array['personalChatMessages','personChatMessages','statisticsAccess'])f
where p.subscription->'monthlyUsage'->>'month' ~ '^\d{4}-\d{2}$';
-- Legacy JSON stays as a billing projection for older clients during rollout; it is not a counter source.
create function public.project_subscription() returns trigger language plpgsql security definer set search_path='' as $$
begin
  update public.profiles set subscription=jsonb_strip_nulls(jsonb_build_object(
    'plan',new.plan,'status',new.status,'stripeCustomerId',new.stripe_customer_id,
    'stripeSubscriptionId',new.stripe_subscription_id,'currentPeriodEnd',new.current_period_end,
    'cancelAtPeriodEnd',new.cancel_at_period_end,'createdAt',new.created_at,'updatedAt',new.updated_at)) where uid=new.user_id;
  return new;
end; $$;
create trigger subscriptions_profile_projection after insert or update on public.subscriptions for each row execute function public.project_subscription();
create function public.create_profile_subscription() returns trigger language plpgsql security definer set search_path='' as $$
begin
  insert into public.subscriptions(user_id) values(new.uid) on conflict do nothing;
  return new;
end; $$;
create trigger profiles_subscription_default after insert on public.profiles for each row execute function public.create_profile_subscription();
create function public.reserve_usage(p_user_id uuid,p_feature text) returns jsonb language plpgsql security invoker set search_path='' as $$
declare s public.subscriptions; quota integer; m date:=date_trunc('month',now() at time zone 'UTC')::date; c public.usage_counters; r uuid; stale integer;
begin
  if p_feature not in ('personalChatMessages','personChatMessages','statisticsAccess') then raise exception 'Unknown feature'; end if;
  -- Consistent lock order: subscription -> reservations/counters. Never hold this transaction over an AI call.
  select * into strict s from public.subscriptions where user_id=p_user_id for update;
  select case p_feature when 'personalChatMessages' then personal_chat_messages when 'personChatMessages' then person_chat_messages else statistics_access end
    into quota from public.subscription_plans where id=case when s.status='active' and (s.current_period_end is null or s.current_period_end>now()) then s.plan else 'free' end;
  insert into public.usage_counters(user_id,month,feature) values(p_user_id,m,p_feature) on conflict do nothing;
  with expired as (update public.usage_reservations set status='released' where user_id=p_user_id and month=m and feature=p_feature and status='reserved' and expires_at<=now() returning id) select count(*) into stale from expired;
  update public.usage_counters set reserved=reserved-stale where user_id=p_user_id and month=m and feature=p_feature;
  select * into c from public.usage_counters where user_id=p_user_id and month=m and feature=p_feature;
  if quota<>-1 and c.used+c.reserved>=quota then return jsonb_build_object('allowed',false,'currentUsage',c.used+c.reserved,'limit',quota); end if;
  -- One report generation at a time per owner, including unlimited plans.
  if p_feature='statisticsAccess' and c.reserved>0 then return jsonb_build_object('allowed',false,'busy',true,'currentUsage',c.used,'limit',quota); end if;
  insert into public.usage_reservations(user_id,month,feature) values(p_user_id,m,p_feature) returning id into r;
  update public.usage_counters set reserved=reserved+1,updated_at=now() where user_id=p_user_id and month=m and feature=p_feature;
  return jsonb_build_object('allowed',true,'id',r,'currentUsage',c.used+c.reserved,'limit',quota);
end; $$;
create function public.finish_usage(p_user_id uuid,p_id uuid,p_success boolean) returns void language plpgsql security invoker set search_path='' as $$
declare r public.usage_reservations;
begin
  perform 1 from public.subscriptions where user_id=p_user_id for update;
  select * into strict r from public.usage_reservations where id=p_id and user_id=p_user_id for update;
  if r.status='completed' then return; end if;
  if r.status='released' then
    if p_success then raise exception 'Reservation expired or released'; end if;
    return;
  end if;
  update public.usage_counters set reserved=reserved-1,used=used+case when p_success then 1 else 0 end,updated_at=now() where user_id=r.user_id and month=r.month and feature=r.feature;
  update public.usage_reservations set status=case when p_success then 'completed' else 'released' end where id=r.id;
end; $$;
create function public.read_monthly_usage(p_user_id uuid) returns jsonb language plpgsql security invoker set search_path='' as $$
declare m date:=date_trunc('month',now() at time zone 'UTC')::date; result jsonb;
begin
  perform 1 from public.subscriptions where user_id=p_user_id for update;
  with expired as (update public.usage_reservations set status='released' where user_id=p_user_id and status='reserved' and expires_at<=now() returning month,feature), counts as (select month,feature,count(*) n from expired group by month,feature)
  update public.usage_counters c set reserved=reserved-counts.n,updated_at=now() from counts where c.user_id=p_user_id and c.month=counts.month and c.feature=counts.feature;
  select coalesce(jsonb_agg(jsonb_build_object('feature',feature,'used',used,'reserved',reserved)),'[]'::jsonb) into result from public.usage_counters where user_id=p_user_id and month=m;
  return result;
end; $$;
create table public.feedback_requests (
  id text primary key, user_id uuid not null references public.profiles(uid) on delete cascade, created_at timestamptz not null default now()
);
create index feedback_requests_user_created_idx on public.feedback_requests(user_id,created_at);
create function public.reserve_feedback(p_user_id uuid,p_id text) returns boolean language plpgsql security invoker set search_path='' as $$
begin
  perform 1 from public.subscriptions where user_id=p_user_id for update;
  if exists(select 1 from public.feedback_requests where id=p_id and user_id=p_user_id) then return true; end if;
  if (select count(*) from public.feedback_requests where user_id=p_user_id and created_at>now()-interval '1 hour')>=5 then return false; end if;
  insert into public.feedback_requests(id,user_id) values(p_id,p_user_id);
  return true;
end; $$;
-- Provider event and subscription change commit together: retries are harmless; stale events cannot regress state.
create function public.apply_billing_event(p_id text,p_user_id uuid,p_type text,p_occurred_at timestamptz,p_subscription jsonb) returns boolean language plpgsql security invoker set search_path='' as $$
declare s public.subscriptions; inserted integer;
begin
  select * into strict s from public.subscriptions where user_id=p_user_id for update;
  insert into public.billing_events(id,user_id,type,occurred_at) values(p_id,p_user_id,p_type,p_occurred_at) on conflict do nothing;
  get diagnostics inserted=row_count;
  if inserted=0 or (s.provider_event_at is not null and s.provider_event_at>p_occurred_at) then return false; end if;
  update public.subscriptions set plan=p_subscription->>'plan',status=p_subscription->>'status',stripe_customer_id=p_subscription->>'stripeCustomerId',stripe_subscription_id=p_subscription->>'stripeSubscriptionId',current_period_end=(p_subscription->>'currentPeriodEnd')::timestamptz,cancel_at_period_end=coalesce((p_subscription->>'cancelAtPeriodEnd')::boolean,false),provider_event_at=p_occurred_at,updated_at=now() where user_id=p_user_id;
  if s.plan is distinct from p_subscription->>'plan' or s.status is distinct from p_subscription->>'status' or s.cancel_at_period_end is distinct from coalesce((p_subscription->>'cancelAtPeriodEnd')::boolean,false) or s.current_period_end is distinct from (p_subscription->>'currentPeriodEnd')::timestamptz then
    insert into public.billing_email_outbox(event_id,user_id,payload) values(p_id,p_user_id,p_subscription) on conflict do nothing;
  end if;
  return true;
end; $$;
create function public.complete_statistics_report(p_user_id uuid,p_id uuid,p_report jsonb) returns void language plpgsql security invoker set search_path='' as $$
begin
  if not exists(select 1 from public.usage_reservations where id=p_id and user_id=p_user_id and feature='statisticsAccess' and status='reserved') then raise exception 'Invalid report reservation'; end if;
  perform public.finish_usage(p_user_id,p_id,true);
  insert into public.statistics_reports(user_id,report) values(p_user_id,p_report) on conflict(user_id) do update set report=excluded.report,generated_at=now();
end; $$;
create function public.claim_billing_emails() returns setof public.billing_email_outbox language plpgsql security invoker set search_path='' as $$
begin
  -- Provider idempotency lasts 24h. Beyond this window require manual review rather than risk duplicate mail.
  update public.billing_email_outbox set status='failed' where status in ('pending','sending') and (created_at<=now()-interval '23 hours' or attempts>=5) and (lease_until is null or lease_until<now());
  return query with jobs as (select event_id from public.billing_email_outbox where (status='pending' or (status='sending' and lease_until<now())) and attempts<5 and created_at>now()-interval '23 hours' order by created_at for update skip locked limit 20)
  update public.billing_email_outbox o set status='sending',attempts=attempts+1,lease_until=now()+interval '10 minutes' from jobs where o.event_id=jobs.event_id returning o.*;
end; $$;
-- RLS AND privileges: browser can read its billing/usage, never write entitlements or call quota/provider RPCs.
alter table public.subscription_plans enable row level security;
create policy plans_read on public.subscription_plans for select to authenticated using(true);
grant select on public.subscription_plans to authenticated;
do $$ declare t text; begin
  foreach t in array array['subscriptions','usage_counters','usage_reservations','billing_events','statistics_reports','feedback_requests','billing_email_outbox'] loop
    execute format('alter table public.%I enable row level security',t);
    execute format('create policy owner_read on public.%I for select to authenticated using(user_id=(select auth.uid()))',t);
    execute format('revoke all on public.%I from public,anon,authenticated',t);
    execute format('grant select on public.%I to authenticated',t);
    execute format('grant all on public.%I to service_role',t);
  end loop;
end; $$;
grant all on public.subscription_plans to service_role;
revoke all on public.subscription_plans from public,anon;
revoke execute on function public.project_subscription(),public.create_profile_subscription(),public.reserve_usage(uuid,text),public.finish_usage(uuid,uuid,boolean),public.apply_billing_event(text,uuid,text,timestamptz,jsonb),public.complete_statistics_report(uuid,uuid,jsonb),public.read_monthly_usage(uuid),public.reserve_feedback(uuid,text),public.claim_billing_emails() from public,anon,authenticated,service_role;
grant execute on function public.reserve_usage(uuid,text),public.finish_usage(uuid,uuid,boolean),public.apply_billing_event(text,uuid,text,timestamptz,jsonb),public.complete_statistics_report(uuid,uuid,jsonb),public.read_monthly_usage(uuid),public.reserve_feedback(uuid,text),public.claim_billing_emails() to service_role;
commit;
