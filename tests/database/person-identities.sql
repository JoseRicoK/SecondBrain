begin;
insert into auth.users(id) values ('11111111-1111-4111-8111-111111111111'),('22222222-2222-4222-8222-222222222222');
insert into profiles(uid,email) select id,id::text||'@test.invalid' from auth.users;
insert into people(id,user_id,name,details) values
 ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','11111111-1111-4111-8111-111111111111','Teresa','{"relacion":"madre"}'),
 ('bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb','11111111-1111-4111-8111-111111111111','Teresa','{"relacion":"hermana"}'),
 ('cccccccc-cccc-4ccc-8ccc-cccccccccccc','22222222-2222-4222-8222-222222222222','Teresa','{"relacion":"madre"}');
set local role authenticated;
select set_config('request.jwt.claim.sub','11111111-1111-4111-8111-111111111111',true);
insert into diary_entries(user_id,date,content,mentioned_people,mentioned_person_ids) values
 (auth.uid(),'2026-01-01','Ficticio',array['Teresa'],array['aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'::uuid]),
 (auth.uid(),'2026-01-02','Ficticio',array['Teresa'],array['bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb'::uuid]),
 (auth.uid(),'2026-01-03','Ficticio',array['Teresa'],array['aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'::uuid,'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb'::uuid]);
select test.ok((select count(*)=2 from people where name='Teresa' and mention_count=2),'homonyms count their own distinct diary dates');
select test.raises($$update diary_entries set mentioned_person_ids=array['cccccccc-cccc-4ccc-8ccc-cccccccccccc'::uuid] where date='2026-01-01'$$,'23514','foreign identity cannot be linked by browser');
select test.raises($$update diary_entries set mentioned_person_ids=array['dddddddd-dddd-4ddd-8ddd-dddddddddddd'::uuid] where date='2026-01-01'$$,'23514','nonexistent identity cannot be linked');
select test.raises('select public.validate_diary_person_identities()','42501','identity trigger is not an exposed RPC');
insert into diary_entries(user_id,date,content,mentioned_people) values(auth.uid(),'2026-01-04','Legacy ambiguity',array['Teresa']);
select test.ok((select count(*)=2 from people where mention_count=2),'ambiguous legacy name is not attributed to both homonyms');
select test.ok((select mentioned_person_ids is null from diary_entries where date='2026-01-04'),'legacy uncertainty is preserved');
update people set name='Teresa nueva' where id='aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
select test.ok((select mentioned_people=array['Teresa nueva'] from diary_entries where date='2026-01-01'),'identity rename updates its own entry');
select test.ok((select mentioned_people=array['Teresa'] from diary_entries where date='2026-01-02'),'identity rename does not rename its homonym');
reset role;
select test.ok((select mention_count=0 from people where user_id='22222222-2222-4222-8222-222222222222'),'other owner statistics remain isolated');
rollback;
