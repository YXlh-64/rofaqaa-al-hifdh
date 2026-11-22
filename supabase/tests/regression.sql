\set ON_ERROR_STOP on
-- Run after bootstrap.sql + migration in an isolated, disposable database.
begin;
create temp table checks(label text primary key);
create temp table fixture(key text primary key,value jsonb);
grant all on checks,fixture to authenticated;
create function pg_temp.ok(p_condition boolean,p_label text) returns void language plpgsql as $$
begin
 if p_condition is distinct from true then raise exception 'FAILED: %',p_label; end if;
 insert into checks values(p_label);
end $$;
create function pg_temp.must_fail(p_sql text,p_label text,p_message text default null) returns void language plpgsql as $$
declare failed boolean:=false;
begin
 begin execute p_sql;
 exception when others then
  if p_message is not null and position(p_message in sqlerrm)=0 then raise exception 'Wrong error for %: %',p_label,sqlerrm; end if;
  failed:=true;
 end;
 if not failed then raise exception 'Unexpected success: %',p_label; end if;
 insert into checks values(p_label);
end $$;
create function pg_temp.invite_fails(p_token text,p_label text) returns void language plpgsql as $$
declare result jsonb;
begin
 result:=public.accept_invitation(p_token);
 if result->>'error' is null then raise exception 'Unexpected invitation success: %',p_label; end if;
 insert into checks values(p_label);
end $$;

insert into auth.users(id,email,email_confirmed_at,raw_user_meta_data) values
 ('00000000-0000-0000-0000-000000000001','supervisor@example.test',now(),'{"display_name":"المشرفة مريم","is_supervisor":true,"is_admin":true}'),
 ('00000000-0000-0000-0000-000000000002','aya@example.test',now(),'{"display_name":"آية بن علي خوجة"}'),
 ('00000000-0000-0000-0000-000000000003','sara@example.test',now(),'{"display_name":"سارة"}'),
 ('00000000-0000-0000-0000-000000000004','other@example.test',now(),'{"display_name":"مشرف آخر","is_supervisor":true}'),
 ('00000000-0000-0000-0000-000000000005','admin@example.test',now(),'{"display_name":"مسؤول النظام"}'),
 ('00000000-0000-0000-0000-000000000006','other-member@example.test',now(),'{"display_name":"عضوة أخرى"}'),
 ('00000000-0000-0000-0000-000000000007','unverified@example.test',null,'{"display_name":"حساب غير مؤكد"}');
select pg_temp.ok(not (select is_admin from profiles where id='00000000-0000-0000-0000-000000000001'),'metadata cannot self-grant admin');
update profiles set is_admin=true where id='00000000-0000-0000-0000-000000000005';

set local role authenticated;
select set_config('storage.operation','object.get_authenticated',true);
select set_config('request.jwt.claim.sub','00000000-0000-0000-0000-000000000001',true);
select pg_temp.ok((select is_supervisor from complete_profile('المشرفة مريم',true)),'supervisor immediate onboarding');
select pg_temp.ok((select count(*) from pairs)=0,'new supervisor sees empty dashboard');
select pg_temp.must_fail($q$update profiles set is_admin=true$q$,'direct self admin update denied','permission denied');
select pg_temp.must_fail($q$select create_pair('غير صالح','aya@example.test','aya@example.test')$q$,'duplicate invitee emails rejected');
select pg_temp.must_fail($q$select create_pair('غير صالح','supervisor@example.test','aya@example.test')$q$,'supervisor cannot occupy seat');
insert into fixture values('pair',create_pair('رفقة آية وسارة','aya@example.test','sara@example.test'));
select pg_temp.ok((select value->'pair'->>'status' from fixture where key='pair')='pending','pair initially pending');
select pg_temp.must_fail($q$select token_hash from invitations$q$,'invite token hashes not selectable','permission denied');
select pg_temp.ok((select count(*) from invitations)=2,'supervisor sees own invite state');

select set_config('request.jwt.claim.sub','00000000-0000-0000-0000-000000000006',true);
select pg_temp.invite_fails((select value->'invites'->0->>'token' from fixture where key='pair'),'wrong recipient rejected');
select pg_temp.ok((select count(*) from pairs)=0,'unrelated user cannot read pending pair');
select set_config('request.jwt.claim.sub','00000000-0000-0000-0000-000000000002',true);
insert into fixture values('first_accept',accept_invitation((select value->'invites'->0->>'token' from fixture where key='pair')));
select pg_temp.ok((select value->>'status' from fixture where key='first_accept')='pending','first acceptance keeps pending');
select pg_temp.ok((select count(*) from pairs)=0,'first invitee has no usable workspace');
select pg_temp.ok(accept_invitation((select value->'invites'->0->>'token' from fixture where key='pair'))->>'status'='pending','acceptance retries are idempotent');
select set_config('request.jwt.claim.sub','00000000-0000-0000-0000-000000000003',true);
insert into fixture values('second_accept',accept_invitation((select value->'invites'->1->>'token' from fixture where key='pair')));
select pg_temp.ok((select value->>'status' from fixture where key='second_accept')='active','second acceptance activates once');
select pg_temp.ok((select count(*) from pair_members)=2,'exactly two members');
select pg_temp.ok((select count(*) from profiles)=3,'profiles scoped to own pair plus supervisor');
select pg_temp.ok((select count(*) from surahs)=114 and (select sum(ayahs) from surahs)=6236,'all 114 surahs and 6236 ayahs');

-- Both plan activities required; reversed/out-of-range ayahs rejected server-side.
select pg_temp.must_fail(format('select save_daily_entry(%L,''2026-11-22'',''plan'',null,''{"state":"none","ranges":[]}'')',
 (select value->'pair'->>'id' from fixture where key='pair')),'missing activity rejected');
select pg_temp.must_fail(format('select save_weekly_target(%L,''2026-11-22'',''[{"surah":24,"from":10,"to":1}]'',''[]'')',
 (select value->'pair'->>'id' from fixture where key='pair')),'reversed range rejected');
select pg_temp.must_fail(format('select save_weekly_target(%L,''2026-11-22'',''[{"surah":24,"from":1,"to":65}]'',''[]'')',
 (select value->'pair'->>'id' from fixture where key='pair')),'out of range ayah rejected');
select pg_temp.must_fail(format('select save_weekly_target(%L,''2026-11-22'',''[{"surah":24,"from":null,"to":10}]'',''[]'')',
 (select value->'pair'->>'id' from fixture where key='pair')),'null ayah rejected');
select pg_temp.must_fail(format('select save_weekly_target(%L,''2026-11-23'',''[]'',''[]'')',
 (select value->'pair'->>'id' from fixture where key='pair')),'Sunday week boundary enforced');
insert into fixture values('proposal',to_jsonb(save_weekly_target((select (value->'pair'->>'id')::uuid from fixture where key='pair'),
 '2026-11-22','[{"surah":24,"from":1,"to":10}]','[{"surah":1,"from":1,"to":7}]',true)));
select pg_temp.must_fail(format('select respond_shared_target(%L,true,1)',(select value->>'id' from fixture where key='proposal')),'cannot confirm own proposal');
select set_config('request.jwt.claim.sub','00000000-0000-0000-0000-000000000002',true);
select pg_temp.ok((respond_shared_target((select (value->>'id')::uuid from fixture where key='proposal'),true,1)).status='confirmed','partner confirms shared target');
insert into fixture values('aya_plan',to_jsonb(save_daily_entry((select (value->'pair'->>'id')::uuid from fixture where key='pair'),'2026-11-22','plan',
 '{"state":"planned","ranges":[{"surah":24,"from":1,"to":10}]}','{"state":"none","ranges":[]}')));
select pg_temp.ok((select value->'plan_revision'->>'state' from fixture where key='aya_plan')='none','explicit no target distinguished');
select pg_temp.ok((select value->'actual_hifdh'->>'state' from fixture where key='aya_plan')='unlogged','missing actual never implies not done');
insert into fixture values('aya_actual',to_jsonb(save_daily_entry((select (value->'pair'->>'id')::uuid from fixture where key='pair'),'2026-11-22','actual',
 '{"state":"partial","ranges":[{"surah":24,"from":1,"to":7}]}','{"state":"not_done","ranges":[]}', '',
 (select (value->>'version')::integer from fixture where key='aya_plan'))));
select pg_temp.must_fail(format('select save_daily_entry(%L,''2026-11-22'',''actual'',''{"state":"not_done","ranges":[]}'',''{"state":"not_done","ranges":[]}'','''',1)',
 (select value->'pair'->>'id' from fixture where key='pair')),'stale daily edit rejected');
select pg_temp.must_fail(format('update daily_entries set owner_id=''00000000-0000-0000-0000-000000000003'' where id=%L',
 (select value->>'id' from fixture where key='aya_actual')),'daily owner immutable via direct API','permission denied');
select pg_temp.must_fail(format('select save_weekly_target(%L,''2026-11-22'',''[]'',''[]'')',
 (select value->'pair'->>'id' from fixture where key='pair')),'target replacement after actuals rejected');
select set_config('request.jwt.claim.sub','00000000-0000-0000-0000-000000000003',true);
select save_daily_entry((select (value->'pair'->>'id')::uuid from fixture where key='pair'),'2026-11-22','actual',
 '{"state":"partial","ranges":[{"surah":24,"from":1,"to":4}]}','{"state":"completed","ranges":[{"surah":1,"from":1,"to":7}]}');
select pg_temp.ok((select actual_hifdh->'ranges'->0->>'to' from daily_entries where owner_id='00000000-0000-0000-0000-000000000002')='7'
 and (select actual_hifdh->'ranges'->0->>'to' from daily_entries where owner_id='00000000-0000-0000-0000-000000000003')='4','1-7 and 1-4 actuals independently attributed');
insert into fixture values('daily_meeting',to_jsonb(save_meeting((select (value->'pair'->>'id')::uuid from fixture where key='pair'),
 'daily','2026-11-22','2026-11-22T18:00:00+01:00','https://meet.example.test/pair','held','تم اللقاء')));
select pg_temp.ok((select actual_hifdh->'ranges'->0->>'to' from daily_entries where owner_id='00000000-0000-0000-0000-000000000003')='4','meeting held does not complete progress');
select pg_temp.must_fail(format('select save_meeting(%L,''weekly'',''2026-11-22'',''2026-11-22T19:00:00+01:00'')',
 (select value->'pair'->>'id' from fixture where key='pair')),'member cannot schedule weekly supervision');
select pg_temp.must_fail(format('select save_meeting(%L,''daily'',''2026-11-23'',''2026-11-23T18:00:00+01:00'',''javascript:alert(1)'')',
 (select value->'pair'->>'id' from fixture where key='pair')),'unsafe meeting URL rejected');
select pg_temp.must_fail(format('select save_meeting(%L,''daily'',''2026-11-22'',''2026-11-22T18:00:00+01:00'')',
 (select value->'pair'->>'id' from fixture where key='pair')),'duplicate daily meeting rejected');

select set_config('request.jwt.claim.sub','00000000-0000-0000-0000-000000000001',true);
select pg_temp.must_fail(format('select save_daily_entry(%L,''2026-11-22'',''actual'',''{"state":"not_done","ranges":[]}'',''{"state":"not_done","ranges":[]}'')',
 (select value->'pair'->>'id' from fixture where key='pair')),'supervisor cannot write member actuals');
select pg_temp.ok((save_meeting((select (value->'pair'->>'id')::uuid from fixture where key='pair'),
 'weekly','2026-11-27','2026-11-27T19:00:00+01:00','https://meet.example.test/supervision')).status='planned','supervisor weekly meeting roundtrip');
insert into fixture values('link',to_jsonb(publish_resource((select (value->'pair'->>'id')::uuid from fixture where key='pair'),
 'تفسير سورة النور','مورد الأسبوع','https://quran.example.test/24')));
select pg_temp.must_fail(format('select publish_resource(%L,''غير آمن'','''',''http://example.test'')',
 (select value->'pair'->>'id' from fixture where key='pair')),'unsafe resource URL rejected');
insert into storage.objects(bucket_id,name,metadata) select 'pair-resources',value->'pair'->>'id'||'/fixture.pdf',
 '{"size":5242880,"mimetype":"application/pdf"}' from fixture where key='pair';
insert into fixture values('file',to_jsonb(publish_resource((select (value->'pair'->>'id')::uuid from fixture where key='pair'),
 'ملف خاص','',null,(select value->'pair'->>'id'||'/fixture.pdf' from fixture where key='pair'))));
select pg_temp.must_fail(format('insert into storage.objects(bucket_id,name,metadata) values(''pair-resources'',%L,''{"size":100,"mimetype":"text/html"}'')',
 (select value->'pair'->>'id'||'/unsafe.html' from fixture where key='pair')),'unsupported MIME rejected server side');
select pg_temp.must_fail(format('insert into storage.objects(bucket_id,name,metadata) values(''pair-resources'',%L,''{"size":5242881,"mimetype":"application/pdf"}'')',
 (select value->'pair'->>'id'||'/oversized.pdf' from fixture where key='pair')),'oversized file rejected server side');
insert into storage.objects(bucket_id,name,metadata) select 'pair-resources',value->'pair'->>'id'||'/quota-'||n||'.pdf',
 '{"size":5242880,"mimetype":"application/pdf"}' from fixture cross join generate_series(1,9) n where key='pair';
select pg_temp.must_fail(format('insert into storage.objects(bucket_id,name,metadata) values(''pair-resources'',%L,''{"size":1,"mimetype":"application/pdf"}'')',
 (select value->'pair'->>'id'||'/overquota.pdf' from fixture where key='pair')),'50 MiB pair quota rejects next byte');
select pg_temp.ok((publish_resource((select (value->'pair'->>'id')::uuid from fixture where key='pair'),
 'رابط بعد امتلاء المساحة','','https://quran.example.test/')).type='link','link publication works at full file quota');
select pg_temp.ok(resource_storage_usage((select (value->'pair'->>'id')::uuid from fixture where key='pair'))=52428800,'usage includes abandoned stored objects');

select set_config('request.jwt.claim.sub','00000000-0000-0000-0000-000000000002',true);
select pg_temp.ok((select count(*) from storage.objects)=1,'member sees only published file objects');
select set_config('storage.operation','object.sign',true);
select pg_temp.ok((select count(*) from storage.objects)=0,'authorized member cannot mint signed download URL');
select set_config('storage.operation','object.list',true);
select pg_temp.ok((select count(*) from storage.objects)=0,'storage object listing forbidden');
select set_config('storage.operation','object.get_authenticated',true);
select pg_temp.ok((select count(*) from resources)=3,'member sees published file and links');
select pg_temp.must_fail(format('select publish_resource(%L,''مورد'','''',''https://example.test'')',
 (select value->'pair'->>'id' from fixture where key='pair')),'member cannot publish resources');
select set_config('request.jwt.claim.sub','00000000-0000-0000-0000-000000000004',true);
select pg_temp.ok((select count(*) from daily_entries)=0 and (select count(*) from meetings)=0 and (select count(*) from resources)=0
 and (select count(*) from storage.objects)=0,'unrelated supervisor cannot read pair notes links metadata or file');
insert into fixture values('pair_b',create_pair('رفقة أخرى','other-member@example.test','unverified@example.test'));
insert into fixture values('pair_c',create_pair('رفقة متزامنة','aya@example.test','other-member@example.test'));
select pg_temp.must_fail(format('select rotate_invitation(%L,1)',(select value->'pair'->>'id' from fixture where key='pair')),'unrelated supervisor cannot rotate invites');
select pg_temp.invite_fails((select value->'invites'->0->>'token' from fixture where key='pair'),'already used invite denied to unrelated user');
insert into fixture values('rotation',rotate_invitation((select (value->'pair'->>'id')::uuid from fixture where key='pair_b'),1));
select pg_temp.ok(inspect_invitation((select value->'invites'->0->>'token' from fixture where key='pair_b'))->>'state'='invalid','rotation invalidates previous token');
select revoke_invitation((select (value->'pair'->>'id')::uuid from fixture where key='pair_b'),1);
select pg_temp.ok(inspect_invitation((select value->>'token' from fixture where key='rotation'))->>'state'='invalid','revocation invalidates new token');
select set_config('request.jwt.claim.sub','00000000-0000-0000-0000-000000000002',true);
select pg_temp.invite_fails((select value->'invites'->0->>'token' from fixture where key='pair_c'),'member cannot join second active pair');
select set_config('request.jwt.claim.sub','00000000-0000-0000-0000-000000000007',true);
select pg_temp.invite_fails((select value->'invites'->1->>'token' from fixture where key='pair_b'),'unverified email cannot accept');

select set_config('request.jwt.claim.sub','00000000-0000-0000-0000-000000000005',true);
select pg_temp.ok((select count(*) from admin_accounts() where id between
 '00000000-0000-0000-0000-000000000001'::uuid and '00000000-0000-0000-0000-000000000007'::uuid)=7,
 'admin sees account metadata');
select pg_temp.ok((select count(*) from daily_entries)=0 and (select count(*) from meetings)=0 and (select count(*) from resources)=0
 and (select count(*) from storage.objects)=0,'admin alone cannot read private pair data or file');
select pg_temp.must_fail($q$select admin_set_enabled('00000000-0000-0000-0000-000000000005',false)$q$,'last active admin protected');
select admin_set_enabled('00000000-0000-0000-0000-000000000003',false,'اختبار التعطيل');
select pg_temp.ok((select count(*) from admin_audit)=1,'disable audit recorded without content');
select set_config('request.jwt.claim.sub','00000000-0000-0000-0000-000000000003',true);
select pg_temp.ok((select count(*) from profiles)=0 and (select count(*) from pairs)=0 and (select count(*) from daily_entries)=0
 and (select count(*) from storage.objects)=0,'disabled existing session loses all private reads');
select pg_temp.must_fail($q$select complete_profile('اسم جديد',true)$q$,'disabled existing session loses profile mutation');
select set_config('request.jwt.claim.sub','00000000-0000-0000-0000-000000000002',true);
select pg_temp.ok((select count(*) from daily_entries)=2,'enabled partner can read frozen history');
select pg_temp.must_fail(format('select save_daily_entry(%L,''2026-11-23'',''plan'',''{"state":"none","ranges":[]}'',''{"state":"none","ranges":[]}'')',
 (select value->'pair'->>'id' from fixture where key='pair')),'disabled participant freezes partner writes');
select set_config('request.jwt.claim.sub','00000000-0000-0000-0000-000000000005',true);
select admin_set_enabled('00000000-0000-0000-0000-000000000003',true);
select set_config('request.jwt.claim.sub','00000000-0000-0000-0000-000000000001',true);
select update_resource((select (value->>'id')::uuid from fixture where key='file'),'ملف خاص','',true,1);
select set_config('storage.operation','object.get_authenticated',true);
select pg_temp.ok((select count(*) from storage.objects)=0,'supervisor cannot download withdrawn or abandoned files');
select set_config('storage.operation','object.delete_many',true);
delete from storage.objects where name=(select value->'pair'->>'id'||'/fixture.pdf' from fixture where key='pair');
select pg_temp.ok(resource_storage_usage((select (value->'pair'->>'id')::uuid from fixture where key='pair'))=47185920,'supervisor cleanup frees withdrawn file quota');
select set_config('storage.operation','object.get_authenticated',true);
select set_config('request.jwt.claim.sub','00000000-0000-0000-0000-000000000002',true);
select pg_temp.ok((select count(*) from storage.objects)=0,'withdrawn file no longer issues download access');
select set_config('request.jwt.claim.sub','00000000-0000-0000-0000-000000000001',true);
select archive_pair((select (value->'pair'->>'id')::uuid from fixture where key='pair'));
select pg_temp.ok((select status from pairs where id=(select (value->'pair'->>'id')::uuid from fixture where key='pair'))='archived','supervisor archives pair');
select pg_temp.must_fail(format('select publish_resource(%L,''مورد'','''',''https://example.test'')',
 (select value->'pair'->>'id' from fixture where key='pair')),'archived pair rejects uploads and resources');
select set_config('request.jwt.claim.sub','00000000-0000-0000-0000-000000000002',true);
select pg_temp.ok((select count(*) from daily_entries)=2,'archived history remains readable to prior member');
select pg_temp.must_fail(format('select save_daily_entry(%L,''2026-11-23'',''plan'',''{"state":"none","ranges":[]}'',''{"state":"none","ranges":[]}'')',
 (select value->'pair'->>'id' from fixture where key='pair')),'archived pair rejects member writes');
select set_config('request.jwt.claim.sub','00000000-0000-0000-0000-000000000006',true);
do $$ declare i integer; result jsonb;
begin
 for i in 1..39 loop
  result:=public.accept_invitation(repeat('f',64));
  if result->>'error' is null then raise exception 'Invalid token unexpectedly accepted'; end if;
 end loop;
end $$;
select pg_temp.must_fail($q$select accept_invitation(repeat('f',64))$q$,'failed invitation attempts reach durable rate limit','محاولات كثيرة');
reset role;
select pg_temp.ok((select hits from app_private.rate_limits where actor_id='00000000-0000-0000-0000-000000000006'
 and operation='accept_invitation')=40,'failed-attempt counter survives inner validation rollback');
select count(*) as passed_checks from checks;
select label from checks order by label;
rollback;
