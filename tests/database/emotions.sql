begin;
insert into auth.users(id) values ('11111111-1111-4111-8111-111111111111'), ('22222222-2222-4222-8222-222222222222');
insert into profiles(uid,email) select id,id::text||'@test.invalid' from auth.users;
insert into diary_entries(id,user_id,date,content,happiness,sadness) values
 ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','11111111-1111-4111-8111-111111111111','2026-09-29','Ficticio A',80,75),
 ('bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb','22222222-2222-4222-8222-222222222222','2026-09-29','Ficticio B',0,0);
select test.ok((select count(*)=2 from diary_entries where neutral is null),'historic and unanalysed neutral remains NULL');
set local role authenticated;
select set_config('request.jwt.claim.sub','11111111-1111-4111-8111-111111111111',true);
update diary_entries set neutral=0 where id='aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
select test.ok((select neutral=0 and happiness=80 and sadness=75 from diary_entries where id='aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'),'real neutral zero preserves coexisting emotions without normalisation');
update diary_entries set neutral=100 where id='aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
select test.ok((select neutral=100 from diary_entries where id='aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'),'neutral upper bound allowed');
select test.raises($$update diary_entries set neutral=101$$,'23514','neutral above 100 rejected');
select test.raises($$update diary_entries set neutral=-1$$,'23514','negative neutral rejected');
select test.raises($$update diary_entries set neutral='NaN'::numeric$$,'23514','nonfinite neutral rejected');
select test.ok((select count(*)=0 from diary_entries where user_id='22222222-2222-4222-8222-222222222222'),'neutral does not expose foreign diary data');
update diary_entries set neutral=77 where id='bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
update diary_entries set neutral=null where id='aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
select test.ok((select neutral is null from diary_entries where id='aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'),'unknown can be persisted without becoming zero');
reset role;
select test.ok((select neutral is null from diary_entries where id='bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb'),'foreign neutral update has no effect');
set local role anon;
select test.raises('select neutral from diary_entries','42501','anonymous neutral read denied');
reset role;
select count(*) as passed_emotion_checks from test.results;
rollback;
