begin;
-- Supabase default table grants can include writes/TRUNCATE; retain only catalogue reads.
revoke all on public.subscription_plans from public, anon, authenticated;
grant select on public.subscription_plans to authenticated;
grant all on public.subscription_plans to service_role;
create index subscriptions_plan_idx on public.subscriptions(plan);
create index billing_email_outbox_user_idx on public.billing_email_outbox(user_id);
commit;
