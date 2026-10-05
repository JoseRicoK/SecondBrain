-- Required before enabling paid checkout. No existing subscriptions or counters are rewritten.
begin;
create or replace function public.apply_billing_event(p_id text,p_user_id uuid,p_type text,p_occurred_at timestamptz,p_subscription jsonb) returns boolean language plpgsql security invoker set search_path='' as $$
declare s public.subscriptions; inserted integer;
begin
  select * into strict s from public.subscriptions where user_id=p_user_id for update;
  insert into public.billing_events(id,user_id,type,occurred_at) values(p_id,p_user_id,p_type,p_occurred_at) on conflict do nothing;
  get diagnostics inserted=row_count;
  if inserted=0 or (s.provider_event_at is not null and s.provider_event_at>p_occurred_at) then return false; end if;
  -- A late cancellation/update of a previous subscription must never replace the current one.
  if s.stripe_customer_id is not null and s.stripe_customer_id is distinct from p_subscription->>'stripeCustomerId' then
    raise exception 'Billing customer mismatch';
  end if;
  if s.stripe_subscription_id is not null and s.stripe_subscription_id is distinct from p_subscription->>'stripeSubscriptionId' then
    if s.status not in ('inactive','canceled')
      or p_type not in ('checkout.session.completed','checkout.session.async_payment_succeeded','customer.subscription.created','invoice.paid','invoice.payment_succeeded')
      or p_subscription->>'status' not in ('active','inactive') then return false; end if;
  end if;
  update public.subscriptions set plan=p_subscription->>'plan',status=p_subscription->>'status',stripe_customer_id=p_subscription->>'stripeCustomerId',stripe_subscription_id=p_subscription->>'stripeSubscriptionId',current_period_end=(p_subscription->>'currentPeriodEnd')::timestamptz,cancel_at_period_end=coalesce((p_subscription->>'cancelAtPeriodEnd')::boolean,false),provider_event_at=p_occurred_at,updated_at=now() where user_id=p_user_id;
  if s.plan is distinct from p_subscription->>'plan' or s.status is distinct from p_subscription->>'status' or s.cancel_at_period_end is distinct from coalesce((p_subscription->>'cancelAtPeriodEnd')::boolean,false) or s.current_period_end is distinct from (p_subscription->>'currentPeriodEnd')::timestamptz then
    insert into public.billing_email_outbox(event_id,user_id,payload) values(p_id,p_user_id,p_subscription) on conflict do nothing;
  end if;
  return true;
end; $$;

create table public.billing_checkout_attempts (
  user_id uuid primary key references public.profiles(uid) on delete cascade,
  request_id uuid not null,
  plan text not null check (plan in ('pro','elite')),
  session_id text,
  expires_at timestamptz not null
);
alter table public.billing_checkout_attempts enable row level security;
revoke all on public.billing_checkout_attempts from public,anon,authenticated;
grant all on public.billing_checkout_attempts to service_role;
create function public.claim_checkout_attempt(p_user_id uuid,p_request_id uuid,p_plan text) returns jsonb language plpgsql security invoker set search_path='' as $$
declare a public.billing_checkout_attempts;
begin
  if p_plan not in ('pro','elite') then raise exception 'Invalid checkout plan'; end if;
  -- Serialize only the reservation; Stripe requests run outside the SQL transaction.
  perform 1 from public.subscriptions where user_id=p_user_id for update;
  if not found then raise exception 'Subscription owner missing'; end if;
  delete from public.billing_checkout_attempts where user_id=p_user_id and (expires_at<=now() or (session_id is null and expires_at<=now()+interval '30 minutes'));
  insert into public.billing_checkout_attempts(user_id,request_id,plan,expires_at)
    values(p_user_id,p_request_id,p_plan,now()+interval '36 minutes') on conflict(user_id) do nothing;
  select * into strict a from public.billing_checkout_attempts where user_id=p_user_id;
  return jsonb_build_object('requestId',a.request_id,'plan',a.plan,'sessionId',a.session_id,'expiresAt',a.expires_at);
end; $$;
create function public.register_checkout_session(p_user_id uuid,p_request_id uuid,p_session_id text) returns void language plpgsql security invoker set search_path='' as $$
begin
  update public.billing_checkout_attempts set session_id=p_session_id
    where user_id=p_user_id and request_id=p_request_id and expires_at>now() and (session_id is null or session_id=p_session_id);
  if not found then raise exception 'Checkout attempt expired or superseded'; end if;
end; $$;
revoke execute on function public.claim_checkout_attempt(uuid,uuid,text),public.register_checkout_session(uuid,uuid,text) from public,anon,authenticated,service_role;
grant execute on function public.claim_checkout_attempt(uuid,uuid,text),public.register_checkout_session(uuid,uuid,text) to service_role;

create or replace function public.billing_schema_version() returns integer language sql stable security invoker set search_path='' as $$ select 2; $$;
revoke execute on function public.billing_schema_version() from public,anon,authenticated,service_role;
grant execute on function public.billing_schema_version() to service_role;
revoke execute on function public.apply_billing_event(text,uuid,text,timestamptz,jsonb) from public,anon,authenticated,service_role;
grant execute on function public.apply_billing_event(text,uuid,text,timestamptz,jsonb) to service_role;
-- Internal jobs/events are consumed exclusively by the server; owner data remains readable via its public tables.
revoke all on public.billing_events,public.billing_email_outbox,public.feedback_requests,public.usage_reservations from anon,authenticated;
commit;
