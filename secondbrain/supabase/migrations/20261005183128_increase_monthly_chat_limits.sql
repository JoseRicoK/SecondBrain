-- Increase monthly chat quotas without resetting existing usage or changing Elite.
begin;
update public.subscription_plans
set personal_chat_messages = 10, person_chat_messages = 50
where id = 'free';
update public.subscription_plans
set personal_chat_messages = 50, person_chat_messages = 150
where id = 'pro';
commit;
