\set ON_ERROR_STOP on
-- Run against the disposable local database after BOTH migrations.
begin;
create temp table inbox_checks(label text primary key);
create temp table inbox_fixture(key text primary key,value jsonb);
grant all on inbox_checks,inbox_fixture to authenticated,anon;
create function pg_temp.inbox_ok(condition boolean,label text) returns void language plpgsql as $$
begin
 if condition is distinct from true then raise exception 'FAILED: %',label; end if;
 insert into inbox_checks values(label);
end $$;
create function pg_temp.inbox_denied(command text,label text) returns void language plpgsql as $$
declare denied boolean:=false;
begin
 begin execute command; exception when others then denied:=true; end;
 if not denied then raise exception 'Unexpected success: %',label; end if;
 insert into inbox_checks values(label);
end $$;

insert into auth.users(id,email,email_confirmed_at,raw_user_meta_data) values
 ('24000000-0000-0000-0000-000000000001','inbox-supervisor@example.test',now(),'{"display_name":"المشرفة سمية","is_supervisor":true}'),
 ('24000000-0000-0000-0000-000000000002','inbox-aya@example.test',now(),'{"display_name":"آية بن علي خوجة"}'),
 ('24000000-0000-0000-0000-000000000003','inbox-sara@example.test',now(),'{"display_name":"سارة"}'),
 ('24000000-0000-0000-0000-000000000004','inbox-other@example.test',now(),'{"display_name":"عضوة أخرى"}'),
 ('24000000-0000-0000-0000-000000000005','inbox-admin@example.test',now(),'{"display_name":"مسؤولة النظام"}'),
 ('24000000-0000-0000-0000-000000000006','inbox-unverified@example.test',null,'{"display_name":"غير مؤكد"}');
update profiles set is_admin=true where id='24000000-0000-0000-0000-000000000005';

set local role authenticated;
select set_config('request.jwt.claim.sub','24000000-0000-0000-0000-000000000001',true);
insert into inbox_fixture values('pair',create_pair('رفقة خاصة','inbox-aya@example.test','inbox-sara@example.test'));
insert into inbox_fixture values('rotate',create_pair('تجديد','inbox-aya@example.test','rotate-other@example.test'));
insert into inbox_fixture values('expired',create_pair('انتهاء','inbox-aya@example.test','expired-other@example.test'));
insert into inbox_fixture values('archived',create_pair('أرشفة','inbox-aya@example.test','archived-other@example.test'));
insert into inbox_fixture values('frozen',create_pair('تجميد','inbox-aya@example.test','frozen-other@example.test'));
insert into inbox_fixture values('unverified',create_pair('غير مؤكد','inbox-unverified@example.test','unverified-other@example.test'));
select pg_temp.inbox_ok((select count(*) from list_my_invitations())=0,'supervisor has no recipient inbox override');
-- Resolve test IDs using supervisor's existing, safe invitation SELECT grant.
insert into inbox_fixture select 'main_aya_id',to_jsonb(id) from invitations
 where pair_id=(select (value->'pair'->>'id')::uuid from inbox_fixture where key='pair') and slot=1;
insert into inbox_fixture select 'main_sara_id',to_jsonb(id) from invitations
 where pair_id=(select (value->'pair'->>'id')::uuid from inbox_fixture where key='pair') and slot=2;
insert into inbox_fixture select 'old_rotation_id',to_jsonb(id) from invitations
 where pair_id=(select (value->'pair'->>'id')::uuid from inbox_fixture where key='rotate') and slot=1;
insert into inbox_fixture select 'unverified_id',to_jsonb(id) from invitations
 where pair_id=(select (value->'pair'->>'id')::uuid from inbox_fixture where key='unverified') and slot=1;
insert into inbox_fixture select 'current_backfill_id',to_jsonb(id) from invitations
 where pair_id=(select (value->'pair'->>'id')::uuid from inbox_fixture where key='frozen') and slot=1;
insert into inbox_fixture values('rotated_secret',rotate_invitation((select (value->'pair'->>'id')::uuid from inbox_fixture where key='rotate'),1));
-- created_at uses now(), so the prior/new rows have equal timestamps here.
insert into inbox_fixture select 'new_rotation_id',to_jsonb(id) from invitations
 where pair_id=(select (value->'pair'->>'id')::uuid from inbox_fixture where key='rotate') and slot=1 and revoked_at is null;

select set_config('request.jwt.claim.sub','24000000-0000-0000-0000-000000000002',true);
select pg_temp.inbox_ok((select count(*) from list_my_invitations())=5,'recipient sees one latest own invitation per seat');
select pg_temp.inbox_ok((select count(*) from invitations)=0,'inbox does not grant invitation table recipient SELECT');
select pg_temp.inbox_denied('select token_hash from invitations','token hashes remain unselectable');
select pg_temp.inbox_denied('select app_private.accept_invitation_id(null)','private acceptance helper cannot be called directly');
select pg_temp.inbox_ok((select state from list_my_invitations() where id=(select (value#>>'{}')::uuid from inbox_fixture where key='main_aya_id'))='pending','valid recipient invitation pending');
select pg_temp.inbox_ok((select supervisor_name from list_my_invitations() limit 1)='المشرفة سمية','inbox discloses inviting supervisor name');
select pg_temp.inbox_ok(not exists(
 select 1 from list_my_invitations() invitation,
 jsonb_object_keys(to_jsonb(invitation)) field
 where field not in ('id','supervisor_name','created_at','expires_at','accepted_at','revoked_at','state')
),'inbox DTO excludes pair members recipient token and private details');
select pg_temp.inbox_ok(not exists(select 1 from list_my_invitations() where id=(select (value#>>'{}')::uuid from inbox_fixture where key='old_rotation_id')),'timestamp tied rotation hides stale inbox row');
select pg_temp.inbox_ok(exists(select 1 from list_my_invitations() where id=(select (value#>>'{}')::uuid from inbox_fixture where key='new_rotation_id')),'timestamp tied rotation exposes newest row');
select pg_temp.inbox_ok(accept_profile_invitation((select (value#>>'{}')::uuid from inbox_fixture where key='old_rotation_id'))->>'error' is not null,'stale inbox ID cannot accept rotated invite');
select pg_temp.inbox_ok(accept_profile_invitation((select (value#>>'{}')::uuid from inbox_fixture where key='main_sara_id'))->>'error' is not null,'partner invitation ID rejected for wrong recipient');
select pg_temp.inbox_ok((select count(*) from pairs)=0,'pending inbox grants no workspace access');

select set_config('request.jwt.claim.sub','24000000-0000-0000-0000-000000000004',true);
select pg_temp.inbox_ok((select count(*) from list_my_invitations())=0,'unrelated user cannot list recipient invitations');
select pg_temp.inbox_ok(accept_profile_invitation((select (value#>>'{}')::uuid from inbox_fixture where key='main_aya_id'))->>'error' is not null,'unrelated user cannot accept known invitation ID');
select set_config('request.jwt.claim.sub','24000000-0000-0000-0000-000000000005',true);
select pg_temp.inbox_ok((select count(*) from list_my_invitations())=0,'admin flag adds no recipient inbox access');
select pg_temp.inbox_ok(accept_profile_invitation((select (value#>>'{}')::uuid from inbox_fixture where key='main_aya_id'))->>'error' is not null,'admin cannot accept invitation on behalf of member');
select set_config('request.jwt.claim.sub','24000000-0000-0000-0000-000000000006',true);
select pg_temp.inbox_denied('select * from list_my_invitations()','unverified account cannot list inbox');
select pg_temp.inbox_ok(accept_profile_invitation((select (value#>>'{}')::uuid from inbox_fixture where key='unverified_id'))->>'error' is not null,'unverified account cannot accept intended profile invitation');

reset role;
-- Simulate a pre-upgrade, timestamp-tied withdrawn row receiving a later
-- identity value than the valid row during physical-order backfill.
insert into public.invitations(pair_id,slot,recipient_email,token_hash,revoked_at)
 select (value->'pair'->>'id')::uuid,1,'inbox-aya@example.test',extensions.digest('backfilled-old-revoked','sha256'),now()
 from inbox_fixture where key='frozen';
set local role authenticated;
select set_config('request.jwt.claim.sub','24000000-0000-0000-0000-000000000002',true);
select pg_temp.inbox_ok(exists(select 1 from list_my_invitations() where id=(select (value#>>'{}')::uuid from inbox_fixture where key='current_backfill_id') and state='pending'),'backfill order cannot hide current invite behind revoked row');
select pg_temp.inbox_ok((select count(*) from list_my_invitations())=5,'backfilled stale row does not duplicate inbox seat');
reset role;
update invitations set expires_at=now()-interval '1 minute'
 where pair_id=(select (value->'pair'->>'id')::uuid from inbox_fixture where key='expired');
-- Preserve invite metadata while independently freezing the parent state.
update pairs set status='archived' where id=(select (value->'pair'->>'id')::uuid from inbox_fixture where key='archived');
update profiles set enabled=false where id='24000000-0000-0000-0000-000000000001';
set local role authenticated;
select set_config('request.jwt.claim.sub','24000000-0000-0000-0000-000000000002',true);
select pg_temp.inbox_ok((select state from list_my_invitations() where id=(select (value#>>'{}')::uuid from inbox_fixture where key='main_aya_id'))='unavailable','disabled supervisor makes inbox invite unavailable');
select pg_temp.inbox_ok(accept_profile_invitation((select (value#>>'{}')::uuid from inbox_fixture where key='main_aya_id'))->>'error' is not null,'disabled supervisor blocks inbox acceptance');
reset role;
update profiles set enabled=true where id='24000000-0000-0000-0000-000000000001';
set local role authenticated;
select pg_temp.inbox_ok(exists(select 1 from list_my_invitations() where state='expired'),'expired invitation labelled separately');
select pg_temp.inbox_ok(exists(select 1 from list_my_invitations() where state='unavailable'),'archived parent makes unrevoked invitation unavailable');
select pg_temp.inbox_ok(accept_profile_invitation((select id from list_my_invitations() where state='expired' limit 1))->>'error' is not null,'expired inbox invitation cannot accept');
select pg_temp.inbox_ok(accept_profile_invitation((select id from list_my_invitations() where state='unavailable' limit 1))->>'error' is not null,'archived inbox invitation cannot accept');
select set_config('request.jwt.claim.sub','24000000-0000-0000-0000-000000000001',true);
select revoke_invitation((select (value->'pair'->>'id')::uuid from inbox_fixture where key='rotate'),1);
select set_config('request.jwt.claim.sub','24000000-0000-0000-0000-000000000002',true);
select pg_temp.inbox_ok((select state from list_my_invitations() where id=(select (value#>>'{}')::uuid from inbox_fixture where key='new_rotation_id'))='revoked','revoked latest invitation retained as history');
select pg_temp.inbox_ok(accept_profile_invitation((select (value#>>'{}')::uuid from inbox_fixture where key='main_aya_id'))->>'status'='pending','first profile acceptance preserves pending state');
select pg_temp.inbox_ok((select state from list_my_invitations() where id=(select (value#>>'{}')::uuid from inbox_fixture where key='main_aya_id'))='accepted','accepted invitation remains in own history');
select pg_temp.inbox_ok((select count(*) from pairs)=0,'first profile acceptance does not reveal workspace');
select pg_temp.inbox_ok(accept_profile_invitation((select (value#>>'{}')::uuid from inbox_fixture where key='main_aya_id'))->>'status'='pending','profile acceptance retry idempotent');
select pg_temp.inbox_ok(accept_invitation((select value->'invites'->0->>'token' from inbox_fixture where key='pair'))->>'status'='pending','token retry after profile acceptance idempotent');

reset role;
update profiles set enabled=false where id='24000000-0000-0000-0000-000000000002';
set local role authenticated;
select pg_temp.inbox_denied('select * from list_my_invitations()','disabled existing session cannot list inbox');
select pg_temp.inbox_denied(format('select accept_profile_invitation(%L)',(select value#>>'{}' from inbox_fixture where key='main_aya_id')),'disabled existing session cannot accept inbox');
select set_config('request.jwt.claim.sub','24000000-0000-0000-0000-000000000003',true);
select pg_temp.inbox_ok((select state from list_my_invitations() where id=(select (value#>>'{}')::uuid from inbox_fixture where key='main_sara_id'))='unavailable','disabled first member freezes second inbox seat');
select pg_temp.inbox_ok(accept_profile_invitation((select (value#>>'{}')::uuid from inbox_fixture where key='main_sara_id'))->>'error' is not null,'frozen member prevents second-seat activation');
reset role;
update profiles set enabled=true where id='24000000-0000-0000-0000-000000000002';
set local role authenticated;
select pg_temp.inbox_ok(accept_invitation((select value->'invites'->1->>'token' from inbox_fixture where key='pair'))->>'status'='active','second token acceptance activates profile-accepted pair');
select pg_temp.inbox_ok(accept_profile_invitation((select (value#>>'{}')::uuid from inbox_fixture where key='main_sara_id'))->>'status'='active','profile retry after token acceptance idempotent');
select pg_temp.inbox_ok((select count(*) from pair_members)=2,'mixed entry points create exactly two members');
select set_config('request.jwt.claim.sub','24000000-0000-0000-0000-000000000002',true);
select pg_temp.inbox_ok(accept_profile_invitation((select id from list_my_invitations() where state='pending' limit 1))->>'error' is not null,'profile inbox cannot join a second active pair');

-- Accepted history follows the accepting account UUID, not recycled email.
reset role;
update auth.users set email='inbox-aya-new@example.test' where id='24000000-0000-0000-0000-000000000002';
update auth.users set email='inbox-aya@example.test' where id='24000000-0000-0000-0000-000000000004';
set local role authenticated;
select pg_temp.inbox_ok(exists(select 1 from list_my_invitations() where id=(select (value#>>'{}')::uuid from inbox_fixture where key='main_aya_id') and state='accepted'),'own accepted history survives verified email change');
select set_config('request.jwt.claim.sub','24000000-0000-0000-0000-000000000004',true);
select pg_temp.inbox_ok(not exists(select 1 from list_my_invitations() where id=(select (value#>>'{}')::uuid from inbox_fixture where key='main_aya_id')),'recycled email identity cannot read prior accepted history');

-- Both acceptance routes share one durable failed-attempt budget.
reset role;
delete from app_private.rate_limits where actor_id='24000000-0000-0000-0000-000000000004' and operation='accept_invitation';
set local role authenticated;
do $$ declare i integer; result jsonb;
begin
 for i in 1..20 loop
   result:=public.accept_profile_invitation(null);
   if result->>'error' is null then raise exception 'Missing inbox ID accepted'; end if;
   result:=public.accept_invitation(repeat('f',64));
   if result->>'error' is null then raise exception 'Invalid token accepted'; end if;
 end loop;
end $$;
select pg_temp.inbox_denied('select accept_profile_invitation(null)','mixed inbox and token failures share rate limit');
reset role;
select pg_temp.inbox_ok((select hits from app_private.rate_limits where actor_id='24000000-0000-0000-0000-000000000004' and operation='accept_invitation')=40,'mixed failed attempts commit one shared counter');
set local role anon;
select pg_temp.inbox_denied('select * from public.list_my_invitations()','anonymous caller cannot invoke inbox');
select pg_temp.inbox_denied('select public.accept_profile_invitation(null)','anonymous caller cannot accept inbox invitation');
reset role;
select count(*) as profile_invitation_checks_passed from inbox_checks;
select label from inbox_checks order by label;
rollback;
