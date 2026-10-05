begin;
set local lock_timeout = '5s';
-- Every profile must already have its authoritative normalized subscription.
do $$ begin
  if exists(select 1 from public.profiles p left join public.subscriptions s on s.user_id=p.uid where s.user_id is null) then
    raise exception 'Cannot remove legacy JSON: a profile has no normalized subscription';
  end if;
end; $$;
drop trigger subscriptions_profile_projection on public.subscriptions;
drop function public.project_subscription();
drop index public.profiles_stripe_customer_idx;
alter table public.profiles drop column subscription;
notify pgrst, 'reload schema';
commit;
