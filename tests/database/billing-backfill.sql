select test.ok((select plan='pro' and status='active' and stripe_customer_id='cus_synthetic' and stripe_subscription_id='sub_synthetic' and cancel_at_period_end from subscriptions where user_id='33333333-3333-4333-8333-333333333333'),'backfill preserves paid status and Stripe references');
select test.ok((select current_period_end='2027-01-01T00:00:00Z'::timestamptz from subscriptions where user_id='33333333-3333-4333-8333-333333333333'),'backfill preserves paid period');
select test.ok((select sum(used)=22 and count(*)=3 and min(month)='2026-08-01'::date from usage_counters),'backfill preserves historical usage and month');
select count(*) as passed_backfill_checks from test.results;
delete from auth.users where id='33333333-3333-4333-8333-333333333333';
truncate test.results;
