-- Rofaqa al-Hifdh v1. Apply through the Supabase SQL editor or CLI as owner.
-- No service-role key is needed in the web application.
begin;
create schema if not exists extensions;
create extension if not exists pgcrypto with schema extensions;
create schema if not exists app_private;
revoke all on schema app_private from public, anon, authenticated;

create table public.profiles (
  id uuid primary key references auth.users(id) on delete restrict,
  email text not null,
  display_name text not null check (length(trim(display_name)) between 1 and 100),
  is_supervisor boolean not null default false,
  is_admin boolean not null default false,
  enabled boolean not null default true,
  created_at timestamptz not null default now()
);
create table public.pairs (
  id uuid primary key default gen_random_uuid(),
  name text not null check (length(trim(name)) between 1 and 100),
  supervisor_id uuid not null references public.profiles(id),
  status text not null default 'pending' check (status in ('pending','active','archived')),
  time_zone text not null default 'Africa/Algiers' check (time_zone = 'Africa/Algiers'),
  created_at timestamptz not null default now()
);
create table public.pair_members (
  pair_id uuid not null references public.pairs(id),
  slot smallint not null check (slot in (1,2)),
  user_id uuid references public.profiles(id),
  accepted_at timestamptz,
  primary key (pair_id,slot), unique(pair_id,user_id),
  check ((user_id is null) = (accepted_at is null))
);
create table public.invitations (
  id uuid primary key default gen_random_uuid(),
  pair_id uuid not null,
  slot smallint not null,
  recipient_email text not null check (recipient_email = lower(trim(recipient_email))),
  token_hash bytea not null unique,
  expires_at timestamptz not null default now() + interval '7 days',
  accepted_at timestamptz,
  accepted_by uuid references public.profiles(id),
  revoked_at timestamptz,
  created_at timestamptz not null default now(),
  foreign key(pair_id,slot) references public.pair_members(pair_id,slot)
);
create unique index one_open_invitation on public.invitations(pair_id,slot)
  where accepted_at is null and revoked_at is null;
create index pair_members_user on public.pair_members(user_id);
create index pairs_supervisor on public.pairs(supervisor_id);

-- Ayah counts use the Hafs/Kufan numbering in Tanzil's Quran metadata.
-- Provenance: https://tanzil.net/docs/quran_metadata (metadata only, no Quran text).
create table public.surahs (id smallint primary key, ayahs smallint not null);
insert into public.surahs(id,ayahs)
select ordinality::smallint,n::smallint from unnest(array[
7,286,200,176,120,165,206,75,129,109,123,111,43,52,99,128,111,110,98,135,
112,78,118,64,77,227,93,88,69,60,34,30,73,54,45,83,182,88,75,85,
54,53,89,59,37,35,38,29,18,45,60,49,62,55,78,96,29,22,24,13,
14,11,11,18,12,12,30,52,52,44,28,28,20,56,40,31,50,40,46,42,
29,19,36,25,22,17,19,26,30,20,15,21,11,8,8,19,5,8,8,11,
11,8,3,9,5,4,7,3,6,3,5,4,5,6]) with ordinality as x(n,ordinality);

create table public.weekly_targets (
  id uuid primary key default gen_random_uuid(),
  pair_id uuid not null references public.pairs(id),
  week_start date not null check (extract(dow from week_start)=0),
  owner_id uuid references public.profiles(id),
  mode text not null check (mode in ('individual','shared')),
  status text not null check (status in ('confirmed','proposed','rejected','superseded')),
  hifdh jsonb not null default '[]',
  revision jsonb not null default '[]',
  note text not null default '' check(length(note)<=2000),
  proposed_by uuid not null references public.profiles(id),
  confirmed_by uuid references public.profiles(id),
  version integer not null default 1,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check ((mode='shared')=(owner_id is null))
);
create unique index one_individual_target on public.weekly_targets(pair_id,week_start,owner_id)
  where mode='individual' and status='confirmed';
create unique index one_shared_target on public.weekly_targets(pair_id,week_start)
  where mode='shared' and status='confirmed';
create unique index one_shared_proposal on public.weekly_targets(pair_id,week_start)
  where mode='shared' and status='proposed';
create table public.daily_entries (
  id uuid primary key default gen_random_uuid(),
  pair_id uuid not null references public.pairs(id),
  owner_id uuid not null references public.profiles(id),
  date date not null,
  plan_hifdh jsonb not null default '{"state":"draft","ranges":[]}',
  plan_revision jsonb not null default '{"state":"draft","ranges":[]}',
  actual_hifdh jsonb not null default '{"state":"unlogged","ranges":[]}',
  actual_revision jsonb not null default '{"state":"unlogged","ranges":[]}',
  note text not null default '' check(length(note)<=2000),
  version integer not null default 1,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(pair_id,owner_id,date)
);
create table public.meetings (
  id uuid primary key default gen_random_uuid(),
  pair_id uuid not null references public.pairs(id),
  type text not null check(type in ('daily','weekly')),
  date date not null,
  period_date date not null,
  scheduled_at timestamptz not null,
  link text not null default '',
  status text not null default 'planned' check(status in ('planned','held','missed')),
  note text not null default '' check(length(note)<=2000),
  created_by uuid not null references public.profiles(id),
  updated_by uuid not null references public.profiles(id),
  version integer not null default 1,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(pair_id,type,period_date)
);
create table public.resources (
  id uuid primary key default gen_random_uuid(),
  pair_id uuid not null references public.pairs(id),
  uploader_id uuid not null references public.profiles(id),
  title text not null check(length(trim(title)) between 1 and 200),
  description text not null default '' check(length(description)<=2000),
  type text not null check(type in ('link','file')),
  url text,
  object_key text unique,
  size bigint,
  mime_type text,
  status text not null default 'published' check(status in ('published','withdrawn')),
  week_start date check(extract(dow from week_start)=0),
  surah smallint references public.surahs(id),
  version integer not null default 1,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check ((type='link' and url is not null and object_key is null and size is null)
    or (type='file' and url is null and object_key is not null and size between 1 and 5242880))
);
create table public.admin_audit (
  id bigint generated always as identity primary key,
  actor_id uuid not null references public.profiles(id),
  target_id uuid not null references public.profiles(id),
  action text not null check(action in ('disable','enable')),
  reason text not null default '' check(length(reason)<=1000),
  created_at timestamptz not null default now()
);
create table app_private.rate_limits (
  actor_id uuid not null,
  operation text not null,
  bucket timestamptz not null,
  hits integer not null default 1,
  primary key(actor_id,operation,bucket)
);

create function app_private.enabled(p_user uuid default auth.uid()) returns boolean
language sql stable security definer set search_path=public,pg_temp as $$
  select exists(select 1 from public.profiles where id=p_user and enabled)
$$;
create function app_private.admin() returns boolean
language sql stable security definer set search_path=public,pg_temp as $$
  select exists(select 1 from public.profiles where id=auth.uid() and enabled and is_admin)
$$;
create function app_private.member(p_pair uuid) returns boolean
language sql stable security definer set search_path=public,pg_temp as $$
  select app_private.enabled() and exists(select 1 from public.pair_members where pair_id=p_pair and user_id=auth.uid())
$$;
create function app_private.supervisor(p_pair uuid) returns boolean
language sql stable security definer set search_path=public,pg_temp as $$
  select app_private.enabled() and exists(select 1 from public.pairs where id=p_pair and supervisor_id=auth.uid())
$$;
create function app_private.can_read_pair(p_pair uuid) returns boolean
language sql stable security definer set search_path=public,pg_temp as $$
  select app_private.enabled() and exists(select 1 from public.pairs p where p.id=p_pair
    and (p.supervisor_id=auth.uid() or (p.status in ('active','archived') and exists(
      select 1 from public.pair_members m where m.pair_id=p.id and m.user_id=auth.uid()))))
$$;
create function app_private.writable(p_pair uuid) returns boolean
language sql stable security definer set search_path=public,pg_temp as $$
  select app_private.can_read_pair(p_pair) and exists(select 1 from public.pairs p
  where p.id=p_pair and p.status='active' and app_private.enabled(p.supervisor_id)
  and (select count(*) from public.pair_members m where m.pair_id=p.id and m.user_id is not null)=2
  and not exists(select 1 from public.pair_members m join public.profiles pr on pr.id=m.user_id
    where m.pair_id=p.id and not pr.enabled))
$$;
create function app_private.assert_write(p_pair uuid) returns void
language plpgsql security definer set search_path=public,pg_temp as $$
begin
  -- Locks serialize state changes, disable, archive, and quota checks.
  perform 1 from public.pairs where id=p_pair for update;
  if not app_private.writable(p_pair) then
    raise exception 'مساحة الرفقة غير متاحة للتعديل أو ليست لديك صلاحية.' using errcode='42501';
  end if;
end $$;
create function app_private.rate_limit(p_operation text,p_max integer) returns void
language plpgsql security definer set search_path=public,pg_temp as $$
declare n integer;
begin
  if not app_private.enabled() then raise exception 'يرجى تسجيل الدخول بحساب مفعّل.' using errcode='42501'; end if;
  insert into app_private.rate_limits(actor_id,operation,bucket)
    values(auth.uid(),p_operation,date_trunc('hour',now()))
    on conflict(actor_id,operation,bucket) do update set hits=rate_limits.hits+1 returning hits into n;
  if n>p_max then raise exception 'محاولات كثيرة. يرجى المحاولة لاحقًا.' using errcode='P0001'; end if;
end $$;
create function app_private.validate_ranges(p_ranges jsonb) returns void
language plpgsql security definer set search_path=public,pg_temp as $$
declare r jsonb; n integer; a integer; b integer; lim integer;
begin
  if p_ranges is null or jsonb_typeof(p_ranges)<>'array' or jsonb_array_length(p_ranges)>200 then
    raise exception 'قائمة الآيات غير صالحة.'; end if;
  for r in select value from jsonb_array_elements(p_ranges) loop
    if jsonb_typeof(r)<>'object' or not (r ?& array['surah','from','to'])
       or (r->>'surah') is null or (r->>'from') is null or (r->>'to') is null
       or (r->>'surah') !~ '^[0-9]{1,3}$' or (r->>'from') !~ '^[0-9]{1,3}$' or (r->>'to') !~ '^[0-9]{1,3}$' then
      raise exception 'يجب تحديد السورة وبداية الآيات ونهايتها.'; end if;
    n:=(r->>'surah')::integer; a:=(r->>'from')::integer; b:=(r->>'to')::integer;
    select ayahs into lim from public.surahs where id=n;
    if lim is null or a<1 or b<a or b>lim then raise exception 'نطاق الآيات غير صالح لهذه السورة.'; end if;
  end loop;
end $$;
create function app_private.validate_activity(p_value jsonb,p_actual boolean) returns void
language plpgsql security definer set search_path=public,pg_temp as $$
declare s text;
begin
  if p_value is null or jsonb_typeof(p_value)<>'object' then raise exception 'يجب تعبئة الحفظ والمراجعة معًا.'; end if;
  s:=p_value->>'state';
  if s is null or (p_actual and s not in ('unlogged','not_done','partial','completed'))
    or (not p_actual and s not in ('draft','none','planned')) then raise exception 'حالة النشاط غير صالحة.'; end if;
  perform app_private.validate_ranges(p_value->'ranges');
  if s in ('planned','partial','completed') and jsonb_array_length(p_value->'ranges')=0 then
    raise exception 'أدخل الآيات المخططة أو المنجزة.'; end if;
  if s in ('draft','none','unlogged','not_done') and jsonb_array_length(p_value->'ranges')<>0 then
    raise exception 'هذه الحالة لا تقبل نطاق آيات.'; end if;
end $$;
create function app_private.validate_https(p_url text,p_optional boolean default false) returns void
language plpgsql as $$
begin
  if p_optional and coalesce(p_url,'')='' then return; end if;
  if p_url is null or length(p_url)>2048 or p_url !~ '^https://[A-Za-z0-9][A-Za-z0-9.-]*(:[0-9]{1,5})?([/?#][^[:space:][:cntrl:]]*)?$'
  then raise exception 'أدخل رابطًا آمنًا يبدأ بـ https://.'; end if;
end $$;

create function app_private.on_auth_user() returns trigger
language plpgsql security definer set search_path=public,pg_temp as $$
begin
  insert into public.profiles(id,email,display_name,is_supervisor)
  values(new.id,lower(new.email),left(coalesce(nullif(trim(new.raw_user_meta_data->>'display_name'),''),'عضو جديد'),100),
    coalesce(new.raw_user_meta_data->>'is_supervisor','false')='true')
  on conflict(id) do update set email=excluded.email;
  return new;
end $$;
create trigger on_rofaqa_auth_user after insert or update of email on auth.users
  for each row execute function app_private.on_auth_user();
-- Existing email-auth accounts also receive an ordinary profile; metadata cannot grant admin.
insert into public.profiles(id,email,display_name,is_supervisor)
select id,lower(email),left(coalesce(nullif(trim(raw_user_meta_data->>'display_name'),''),'عضو جديد'),100),
  coalesce(raw_user_meta_data->>'is_supervisor','false')='true'
from auth.users where email is not null
on conflict(id) do nothing;

create function public.complete_profile(p_display_name text,p_supervisor boolean default false)
returns public.profiles language plpgsql security definer set search_path=public,pg_temp as $$
declare r public.profiles;
begin
  if not app_private.enabled() then raise exception 'الحساب غير متاح.' using errcode='42501'; end if;
  update public.profiles set display_name=trim(p_display_name),is_supervisor=is_supervisor or p_supervisor
    where id=auth.uid() returning * into r;
  return r;
end $$;

create function public.create_pair(p_name text,p_email1 text,p_email2 text) returns jsonb
language plpgsql security definer set search_path=public,extensions,pg_temp as $$
declare p public.pairs; e text; t text; result jsonb:='[]'; i integer;
begin
  perform app_private.rate_limit('create_pair',20);
  if not exists(select 1 from public.profiles where id=auth.uid() and is_supervisor and enabled) then
    raise exception 'إنشاء الرفقة متاح للمشرف فقط.' using errcode='42501'; end if;
  p_email1:=lower(trim(p_email1)); p_email2:=lower(trim(p_email2));
  if p_email1=p_email2 or p_email1 !~ '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$'
    or p_email2 !~ '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$'
    or exists(select 1 from public.profiles where id=auth.uid() and email in (p_email1,p_email2)) then
    raise exception 'أدخل بريدين مختلفين للرفيقين، غير بريد المشرف.'; end if;
  insert into public.pairs(name,supervisor_id) values(trim(p_name),auth.uid()) returning * into p;
  for i in 1..2 loop
    e:=case when i=1 then p_email1 else p_email2 end; t:=encode(extensions.gen_random_bytes(32),'hex');
    insert into public.pair_members(pair_id,slot) values(p.id,i);
    insert into public.invitations(pair_id,slot,recipient_email,token_hash) values(p.id,i,e,extensions.digest(t,'sha256'));
    result:=result||jsonb_build_array(jsonb_build_object('slot',i,'token',t,'recipient_email',e,'expires_at',now()+interval '7 days'));
  end loop;
  return jsonb_build_object('pair',to_jsonb(p),'invites',result);
end $$;
create function public.rotate_invitation(p_pair_id uuid,p_slot integer) returns jsonb
language plpgsql security definer set search_path=public,extensions,pg_temp as $$
declare old public.invitations; t text;
begin
  perform app_private.rate_limit('invite',40);
  perform 1 from public.pairs where id=p_pair_id for update;
  if not app_private.supervisor(p_pair_id) or not exists(select 1 from public.pairs where id=p_pair_id and status='pending')
    or exists(select 1 from public.pair_members where pair_id=p_pair_id and slot=p_slot and user_id is not null) then
    raise exception 'لا يمكن تجديد هذه الدعوة.' using errcode='42501'; end if;
  select * into old from public.invitations where pair_id=p_pair_id and slot=p_slot order by created_at desc limit 1;
  if not found then raise exception 'الدعوة غير متاحة.'; end if;
  update public.invitations set revoked_at=now() where pair_id=p_pair_id and slot=p_slot and accepted_at is null and revoked_at is null;
  t:=encode(extensions.gen_random_bytes(32),'hex');
  insert into public.invitations(pair_id,slot,recipient_email,token_hash) values(p_pair_id,p_slot,old.recipient_email,extensions.digest(t,'sha256'));
  return jsonb_build_object('slot',p_slot,'token',t,'recipient_email',old.recipient_email,'expires_at',now()+interval '7 days');
end $$;
create function public.revoke_invitation(p_pair_id uuid,p_slot integer) returns void
language plpgsql security definer set search_path=public,pg_temp as $$
begin
  perform 1 from public.pairs where id=p_pair_id for update;
  if not app_private.supervisor(p_pair_id) then raise exception 'ليس لديك صلاحية.' using errcode='42501'; end if;
  update public.invitations set revoked_at=now() where pair_id=p_pair_id and slot=p_slot and accepted_at is null and revoked_at is null;
end $$;
create function public.inspect_invitation(p_token text) returns jsonb
language plpgsql security definer set search_path=public,extensions,pg_temp as $$
declare inv public.invitations; supervisor_name text;
begin
  if length(p_token)<>64 then return jsonb_build_object('state','invalid'); end if;
  select * into inv from public.invitations where token_hash=extensions.digest(p_token,'sha256');
  if not found or inv.revoked_at is not null then return jsonb_build_object('state','invalid'); end if;
  if inv.accepted_at is not null then return jsonb_build_object('state','used'); end if;
  if inv.expires_at<=now() then return jsonb_build_object('state','expired'); end if;
  select pr.display_name into supervisor_name from public.pairs p join public.profiles pr on pr.id=p.supervisor_id
    where p.id=inv.pair_id and p.status='pending' and pr.enabled;
  if supervisor_name is null then return jsonb_build_object('state','invalid'); end if;
  return jsonb_build_object('state','valid','supervisor_name',supervisor_name);
end $$;
create function public.accept_invitation(p_token text) returns jsonb
language plpgsql security definer set search_path=public,extensions,pg_temp as $$
declare inv public.invitations; p public.pairs; user_email text; accepted_member record;
begin
  perform app_private.rate_limit('accept_invitation',40);
  -- Failed acceptance rolls back the inner changes while the outer counter commits.
  begin
  -- A pilot-wide advisory lock closes races across different pending pairs.
  perform pg_advisory_xact_lock(hashtextextended('rofaqa_membership',0));
  select * into inv from public.invitations where token_hash=extensions.digest(p_token,'sha256') for update;
  if not found or inv.revoked_at is not null then raise exception 'الدعوة غير صالحة. اطلب رابطًا جديدًا من المشرف.'; end if;
  select * into p from public.pairs where id=inv.pair_id for update;
  select lower(email) into user_email from auth.users where id=auth.uid() and email_confirmed_at is not null;
  if user_email is null or user_email<>inv.recipient_email then raise exception 'سجّل الدخول بالبريد المؤكّد المخصّص لهذه الدعوة.' using errcode='42501'; end if;
  if inv.accepted_by=auth.uid() then return jsonb_build_object('pair_id',p.id,'status',p.status,'name',p.name); end if;
  if inv.accepted_at is not null or inv.expires_at<=now() or p.status<>'pending' or not app_private.enabled(p.supervisor_id) then
    raise exception 'انتهت صلاحية الدعوة أو استُخدمت. اطلب رابطًا جديدًا من المشرف.'; end if;
  if p.supervisor_id=auth.uid() or exists(select 1 from public.pair_members where pair_id=p.id and user_id=auth.uid())
    or exists(select 1 from public.pair_members m join public.pairs x on x.id=m.pair_id where m.user_id=auth.uid() and x.status='active') then
    raise exception 'لا يمكنك الانضمام إلى أكثر من رفقة نشطة أو شغل مقعدين.'; end if;
  update public.pair_members set user_id=auth.uid(),accepted_at=now() where pair_id=p.id and slot=inv.slot and user_id is null;
  if not found then raise exception 'هذا المقعد غير متاح.'; end if;
  update public.invitations set accepted_at=now(),accepted_by=auth.uid() where id=inv.id;
  if (select count(*) from public.pair_members where pair_id=p.id and user_id is not null)=2 then
    for accepted_member in select user_id from public.pair_members where pair_id=p.id loop
      if not app_private.enabled(accepted_member.user_id) or exists(select 1 from public.pair_members pm join public.pairs x on x.id=pm.pair_id
        where pm.user_id=accepted_member.user_id and x.status='active' and x.id<>p.id) then
        raise exception 'تعذّر تفعيل الرفقة. راجع المشرف بشأن عضوية الرفيقين.'; end if;
    end loop;
    update public.pairs set status='active' where id=p.id returning * into p;
  end if;
  return jsonb_build_object('pair_id',p.id,'status',p.status,'name',p.name);
  exception when others then
    return jsonb_build_object('error',case when sqlerrm ~ '[ء-ي]' then sqlerrm
      else 'تعذّر قبول الدعوة. أعد المحاولة أو اطلب رابطًا جديدًا من المشرف.' end,'code',sqlstate);
  end;
end $$;
create function public.archive_pair(p_pair_id uuid) returns void
language plpgsql security definer set search_path=public,pg_temp as $$
begin
  perform 1 from public.pairs where id=p_pair_id for update;
  if not app_private.supervisor(p_pair_id) then raise exception 'الأرشفة متاحة للمشرف المكلّف فقط.' using errcode='42501'; end if;
  update public.pairs set status='archived' where id=p_pair_id;
  update public.invitations set revoked_at=now() where pair_id=p_pair_id and accepted_at is null and revoked_at is null;
end $$;

create function public.save_weekly_target(p_pair_id uuid,p_week_start date,p_hifdh jsonb,p_revision jsonb,
  p_shared boolean default false,p_note text default '',p_id uuid default null,p_expected_version integer default null)
returns public.weekly_targets language plpgsql security definer set search_path=public,pg_temp as $$
declare r public.weekly_targets;
begin
  perform app_private.assert_write(p_pair_id);
  if not app_private.member(p_pair_id) then raise exception 'الأهداف يضعها العضو لنفسه فقط.' using errcode='42501'; end if;
  perform app_private.validate_ranges(p_hifdh); perform app_private.validate_ranges(p_revision);
  if extract(dow from p_week_start)<>0 then raise exception 'بداية الأسبوع يوم الأحد.'; end if;
  if p_id is not null then
    select * into r from public.weekly_targets where id=p_id for update;
    if not found or r.pair_id<>p_pair_id or r.week_start<>p_week_start or r.proposed_by<>auth.uid()
      or r.mode<>(case when p_shared then 'shared' else 'individual' end)
      or r.status not in ('confirmed','proposed') or (r.mode='shared' and r.status='confirmed') then
      raise exception 'لا يمكن تعديل هذا الهدف.' using errcode='42501'; end if;
    if p_expected_version is null or r.version<>p_expected_version then raise exception 'تغيّر السجل. أعد تحميل الصفحة ثم حاول مجددًا.' using errcode='40001'; end if;
    if exists(select 1 from public.daily_entries where pair_id=p_pair_id and date between p_week_start and p_week_start+6
      and (actual_hifdh->>'state'<>'unlogged' or actual_revision->>'state'<>'unlogged')) then
      raise exception 'لا يمكن استبدال الهدف بعد تسجيل الإنجاز؛ احتفظ بسجل الأسبوع.'; end if;
    update public.weekly_targets set hifdh=p_hifdh,revision=p_revision,note=coalesce(p_note,''),version=version+1,updated_at=now()
      where id=p_id returning * into r;
  else
    if exists(select 1 from public.daily_entries where pair_id=p_pair_id and date between p_week_start and p_week_start+6
      and (actual_hifdh->>'state'<>'unlogged' or actual_revision->>'state'<>'unlogged'))
      and exists(select 1 from public.weekly_targets where pair_id=p_pair_id and week_start=p_week_start and status='confirmed'
        and (mode='shared' or owner_id=auth.uid())) then
      raise exception 'لا يمكن استبدال الهدف بعد تسجيل الإنجاز.'; end if;
    if not p_shared then
      update public.weekly_targets set status='superseded',updated_at=now(),version=version+1
        where pair_id=p_pair_id and week_start=p_week_start and owner_id=auth.uid() and mode='individual' and status='confirmed';
      -- Leaving a confirmed shared target requires a new shared proposal; avoid silently changing the common reference.
      if exists(select 1 from public.weekly_targets where pair_id=p_pair_id and week_start=p_week_start and mode='shared' and status='confirmed') then
        raise exception 'يوجد هدف مشترك مؤكّد لهذا الأسبوع. احتفظ به أو اقترح هدفًا مشتركًا جديدًا.'; end if;
    else
      if exists(select 1 from public.weekly_targets where pair_id=p_pair_id and week_start=p_week_start and mode='shared' and status='proposed') then
        raise exception 'يوجد اقتراح ينتظر رد الرفيق. حدّث الصفحة.' using errcode='40001'; end if;
    end if;
    insert into public.weekly_targets(pair_id,week_start,owner_id,mode,status,hifdh,revision,note,proposed_by)
      values(p_pair_id,p_week_start,case when p_shared then null else auth.uid() end,
        case when p_shared then 'shared' else 'individual' end,case when p_shared then 'proposed' else 'confirmed' end,
        p_hifdh,p_revision,coalesce(p_note,''),auth.uid()) returning * into r;
  end if;
  return r;
end $$;
create function public.respond_shared_target(p_id uuid,p_accept boolean,p_expected_version integer)
returns public.weekly_targets language plpgsql security definer set search_path=public,pg_temp as $$
declare r public.weekly_targets;
begin
  select * into r from public.weekly_targets where id=p_id;
  if not found then raise exception 'الهدف غير متاح.' using errcode='42501'; end if;
  perform app_private.assert_write(r.pair_id);
  select * into r from public.weekly_targets where id=p_id for update;
  if not app_private.member(r.pair_id) or r.proposed_by=auth.uid() or r.mode<>'shared' or r.status<>'proposed' then
    raise exception 'التأكيد متاح للرفيق الآخر فقط.' using errcode='42501'; end if;
  if p_expected_version is null or p_expected_version<>r.version then raise exception 'تغيّر الاقتراح. أعد تحميل الصفحة.' using errcode='40001'; end if;
  if p_accept then
    if exists(select 1 from public.daily_entries where pair_id=r.pair_id and date between r.week_start and r.week_start+6
      and (actual_hifdh->>'state'<>'unlogged' or actual_revision->>'state'<>'unlogged')) then
      raise exception 'لا يمكن تغيير الهدف بعد تسجيل الإنجاز.'; end if;
    update public.weekly_targets set status='superseded',version=version+1,updated_at=now()
      where pair_id=r.pair_id and week_start=r.week_start and mode='shared' and status='confirmed';
  end if;
  update public.weekly_targets set status=case when p_accept then 'confirmed' else 'rejected' end,
    confirmed_by=auth.uid(),version=version+1,updated_at=now() where id=p_id returning * into r;
  return r;
end $$;
create function public.save_daily_entry(p_pair_id uuid,p_date date,p_kind text,p_hifdh jsonb,p_revision jsonb,
  p_note text default '',p_expected_version integer default null)
returns public.daily_entries language plpgsql security definer set search_path=public,pg_temp as $$
declare r public.daily_entries;
begin
  perform app_private.assert_write(p_pair_id);
  if not app_private.member(p_pair_id) then raise exception 'يمكنك تعديل سجلك الشخصي فقط.' using errcode='42501'; end if;
  if p_kind is null or p_kind not in ('plan','actual') then raise exception 'نوع السجل غير صالح.'; end if;
  perform app_private.validate_activity(p_hifdh,p_kind='actual'); perform app_private.validate_activity(p_revision,p_kind='actual');
  select * into r from public.daily_entries where pair_id=p_pair_id and owner_id=auth.uid() and date=p_date for update;
  if found and (p_expected_version is null or p_expected_version<>r.version) then
    raise exception 'تغيّر السجل. أعد تحميل الصفحة ثم حاول مجددًا.' using errcode='40001'; end if;
  if not found then
    insert into public.daily_entries(pair_id,owner_id,date) values(p_pair_id,auth.uid(),p_date) returning * into r;
  end if;
  if p_kind='plan' then
    update public.daily_entries set plan_hifdh=p_hifdh,plan_revision=p_revision,note=coalesce(p_note,''),
      version=version+1,updated_at=now() where id=r.id returning * into r;
  else
    update public.daily_entries set actual_hifdh=p_hifdh,actual_revision=p_revision,note=coalesce(p_note,''),
      version=version+1,updated_at=now() where id=r.id returning * into r;
  end if;
  return r;
end $$;
create function public.save_meeting(p_pair_id uuid,p_type text,p_date date,p_scheduled_at timestamptz,
  p_link text default '',p_status text default 'planned',p_note text default '',p_id uuid default null,p_expected_version integer default null)
returns public.meetings language plpgsql security definer set search_path=public,pg_temp as $$
declare r public.meetings; period date;
begin
  perform app_private.assert_write(p_pair_id);
  if not ((p_type='daily' and app_private.member(p_pair_id)) or (p_type='weekly' and app_private.supervisor(p_pair_id))) then
    raise exception 'ليس لديك صلاحية لتعديل هذا النوع من اللقاءات.' using errcode='42501'; end if;
  perform app_private.validate_https(p_link,true);
  if (p_scheduled_at at time zone 'Africa/Algiers')::date<>p_date then raise exception 'تاريخ اللقاء لا يوافق توقيته المحلي.'; end if;
  period:=case when p_type='daily' then p_date else p_date-extract(dow from p_date)::integer end;
  if p_id is null then
    insert into public.meetings(pair_id,type,date,period_date,scheduled_at,link,status,note,created_by,updated_by)
      values(p_pair_id,p_type,p_date,period,p_scheduled_at,coalesce(p_link,''),p_status,coalesce(p_note,''),auth.uid(),auth.uid()) returning * into r;
  else
    select * into r from public.meetings where id=p_id for update;
    if not found or r.pair_id<>p_pair_id or r.type<>p_type then raise exception 'اللقاء غير متاح.' using errcode='42501'; end if;
    if p_expected_version is null or r.version<>p_expected_version then raise exception 'عدّل أحدهم اللقاء. أعد تحميل الصفحة.' using errcode='40001'; end if;
    if r.status<>'planned' and p_status='planned' then raise exception 'احتفظ بنتيجة اللقاء المسجّلة عند التصحيح.'; end if;
    update public.meetings set date=p_date,period_date=period,scheduled_at=p_scheduled_at,link=coalesce(p_link,''),status=p_status,
      note=coalesce(p_note,''),updated_by=auth.uid(),updated_at=now(),version=version+1 where id=p_id returning * into r;
  end if;
  return r;
end $$;

create function public.publish_resource(p_pair_id uuid,p_title text,p_description text default '',p_url text default null,
  p_object_key text default null,p_week_start date default null,p_surah integer default null)
returns public.resources language plpgsql security definer set search_path=public,pg_temp as $$
declare r public.resources; obj storage.objects; n bigint; mime text;
begin
  perform app_private.assert_write(p_pair_id);
  if not app_private.supervisor(p_pair_id) then raise exception 'نشر الموارد متاح للمشرف المكلّف فقط.' using errcode='42501'; end if;
  if (nullif(p_url,'') is null)=(nullif(p_object_key,'') is null) then raise exception 'اختر ملفًا أو رابطًا واحدًا.'; end if;
  if nullif(p_url,'') is not null then
    perform app_private.validate_https(p_url);
    insert into public.resources(pair_id,uploader_id,title,description,type,url,week_start,surah)
      values(p_pair_id,auth.uid(),trim(p_title),coalesce(p_description,''),'link',p_url,p_week_start,p_surah) returning * into r;
  else
    if split_part(p_object_key,'/',1)<>p_pair_id::text then raise exception 'الملف خارج مساحة الرفقة.' using errcode='42501'; end if;
    select * into r from public.resources where object_key=p_object_key;
    if found then return r; end if; -- idempotent upload finalization
    select * into obj from storage.objects where bucket_id='pair-resources' and name=p_object_key;
    if not found then raise exception 'لم يكتمل رفع الملف. أعد المحاولة.'; end if;
    n:=coalesce((obj.metadata->>'size')::bigint,0); mime:=obj.metadata->>'mimetype';
    if n<1 or n>5242880 or coalesce(mime,'') not in ('application/pdf','image/png','image/jpeg') then raise exception 'الملف يجب أن يكون PDF أو PNG أو JPEG وبحجم لا يتجاوز ٥ ميبيبايت.'; end if;
    insert into public.resources(pair_id,uploader_id,title,description,type,object_key,size,mime_type,week_start,surah)
      values(p_pair_id,auth.uid(),trim(p_title),coalesce(p_description,''),'file',p_object_key,n,mime,p_week_start,p_surah) returning * into r;
  end if;
  return r;
end $$;
create function public.update_resource(p_id uuid,p_title text,p_description text,p_withdraw boolean,p_expected_version integer)
returns public.resources language plpgsql security definer set search_path=public,pg_temp as $$
declare r public.resources;
begin
  select * into r from public.resources where id=p_id;
  if not found then raise exception 'المورد غير متاح.' using errcode='42501'; end if;
  perform app_private.assert_write(r.pair_id);
  if not app_private.supervisor(r.pair_id) then raise exception 'تعديل الموارد متاح للمشرف المكلّف فقط.' using errcode='42501'; end if;
  select * into r from public.resources where id=p_id for update;
  if p_expected_version is null or r.version<>p_expected_version then raise exception 'تغيّر المورد. أعد تحميل الصفحة.' using errcode='40001'; end if;
  update public.resources set title=trim(p_title),description=coalesce(p_description,''),
    status=case when p_withdraw then 'withdrawn' else status end,version=version+1,updated_at=now() where id=p_id returning * into r;
  return r;
end $$;
create function public.resource_storage_usage(p_pair_id uuid) returns bigint
language plpgsql stable security definer set search_path=public,pg_temp as $$
declare n bigint;
begin
  if not app_private.can_read_pair(p_pair_id) then raise exception 'المساحة غير متاحة.' using errcode='42501'; end if;
  select coalesce(sum(coalesce((metadata->>'size')::bigint,0)),0) into n from storage.objects
    where bucket_id='pair-resources' and split_part(name,'/',1)=p_pair_id::text;
  return n;
end $$;
create function public.admin_accounts(p_search text default '') returns setof public.profiles
language plpgsql security definer set search_path=public,pg_temp as $$
begin
  if not app_private.admin() then raise exception 'هذه الصفحة لمسؤول النظام فقط.' using errcode='42501'; end if;
  return query select * from public.profiles where email ilike '%'||left(p_search,100)||'%'
    or display_name ilike '%'||left(p_search,100)||'%' order by created_at desc limit 100;
end $$;
create function public.admin_set_enabled(p_user_id uuid,p_enabled boolean,p_reason text default '') returns void
language plpgsql security definer set search_path=public,pg_temp as $$
declare r public.profiles;
begin
  perform pg_advisory_xact_lock(hashtextextended('rofaqa_admin',0));
  if not app_private.admin() then raise exception 'هذه العملية لمسؤول النظام فقط.' using errcode='42501'; end if;
  -- Same pair locks as all writes prevent operations from racing a disable.
  perform 1 from public.pairs p where p.supervisor_id=p_user_id or exists(
    select 1 from public.pair_members m where m.pair_id=p.id and m.user_id=p_user_id) order by p.id for update;
  select * into r from public.profiles where id=p_user_id for update;
  if not found then raise exception 'الحساب غير متاح.'; end if;
  if not p_enabled and r.is_admin and r.enabled and (select count(*) from public.profiles where is_admin and enabled)<=1 then
    raise exception 'لا يمكن تعطيل آخر مسؤول نظام مفعّل.'; end if;
  if r.enabled=p_enabled then return; end if;
  update public.profiles set enabled=p_enabled where id=p_user_id;
  insert into public.admin_audit(actor_id,target_id,action,reason)
    values(auth.uid(),p_user_id,case when p_enabled then 'enable' else 'disable' end,coalesce(p_reason,''));
end $$;

-- Every table is private by default. No application role receives direct mutation privileges.
alter table public.profiles enable row level security;
alter table public.pairs enable row level security;
alter table public.pair_members enable row level security;
alter table public.invitations enable row level security;
alter table public.weekly_targets enable row level security;
alter table public.daily_entries enable row level security;
alter table public.meetings enable row level security;
alter table public.resources enable row level security;
alter table public.admin_audit enable row level security;
alter table public.surahs enable row level security;
create policy profile_read on public.profiles for select to authenticated using (
  app_private.enabled() and (id=auth.uid() or exists(select 1 from public.pairs p where app_private.can_read_pair(p.id)
    and (p.supervisor_id=profiles.id or exists(select 1 from public.pair_members m where m.pair_id=p.id and m.user_id=profiles.id)))));
create policy pair_read on public.pairs for select to authenticated using (app_private.can_read_pair(id));
create policy members_read on public.pair_members for select to authenticated using (app_private.can_read_pair(pair_id));
create policy invitations_read on public.invitations for select to authenticated using (app_private.supervisor(pair_id));
create policy targets_read on public.weekly_targets for select to authenticated using (app_private.can_read_pair(pair_id));
create policy entries_read on public.daily_entries for select to authenticated using (app_private.can_read_pair(pair_id));
create policy meetings_read on public.meetings for select to authenticated using (app_private.can_read_pair(pair_id));
create policy resources_read on public.resources for select to authenticated using (
  app_private.can_read_pair(pair_id) and (status='published' or app_private.supervisor(pair_id)));
create policy audit_read on public.admin_audit for select to authenticated using(app_private.admin());
create policy surahs_read on public.surahs for select to anon,authenticated using(true);
revoke all on public.profiles,public.pairs,public.pair_members,public.invitations,public.weekly_targets,
  public.daily_entries,public.meetings,public.resources,public.admin_audit,public.surahs from anon,authenticated;
grant select on public.profiles,public.pairs,public.pair_members,public.weekly_targets,public.daily_entries,
  public.meetings,public.resources,public.admin_audit to authenticated;
grant select(id,pair_id,slot,recipient_email,expires_at,accepted_at,accepted_by,revoked_at,created_at) on public.invitations to authenticated;
grant select on public.surahs to anon,authenticated;

-- Storage access uses authenticated download() each time, without signed/public URLs.
insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types)
values('pair-resources','pair-resources',false,5242880,array['application/pdf','image/png','image/jpeg'])
on conflict(id) do update set public=false,file_size_limit=excluded.file_size_limit,allowed_mime_types=excluded.allowed_mime_types;
create function app_private.object_pair(p_name text) returns uuid
language plpgsql immutable as $$
begin
  return split_part(p_name,'/',1)::uuid;
exception when invalid_text_representation then return null;
end $$;
create function app_private.guard_resource_upload() returns trigger
language plpgsql security definer set search_path=public,pg_temp as $$
declare pair_id uuid; n bigint; used bigint;
begin
  if new.bucket_id<>'pair-resources' then return new; end if;
  pair_id:=app_private.object_pair(new.name);
  perform app_private.assert_write(pair_id);
  if not app_private.supervisor(pair_id) then raise exception 'رفع الملفات متاح للمشرف المكلّف فقط.' using errcode='42501'; end if;
  n:=coalesce((new.metadata->>'size')::bigint,0);
  if n<1 or n>5242880 or coalesce(new.metadata->>'mimetype','') not in ('application/pdf','image/png','image/jpeg') then
    raise exception 'نوع الملف أو حجمه غير مسموح.'; end if;
  select coalesce(sum(coalesce((metadata->>'size')::bigint,0)),0) into used from storage.objects
    where bucket_id='pair-resources' and split_part(name,'/',1)=pair_id::text;
  if used+n>52428800 then raise exception 'امتلأت مساحة الملفات لهذه الرفقة (٥٠ ميبيبايت). يمكنك مشاركة رابط.'; end if;
  return new;
end $$;
create trigger rofaqa_resource_upload before insert on storage.objects for each row execute function app_private.guard_resource_upload();
create policy rofaqa_file_read on storage.objects for select to authenticated using (
  bucket_id='pair-resources' and (
    (storage.allow_any_operation(array['object.get_authenticated','object.get_authenticated_info','object.head_authenticated_info'])
      and exists(select 1 from public.resources r where r.object_key=name and r.status='published'
        and app_private.can_read_pair(r.pair_id)))
    or (storage.allow_any_operation(array['object.delete','object.delete_many'])
      and app_private.supervisor(app_private.object_pair(name)) and app_private.writable(app_private.object_pair(name))
      and not exists(select 1 from public.resources r where r.object_key=name and r.status='published'))));
create policy rofaqa_file_insert on storage.objects for insert to authenticated with check (
  bucket_id='pair-resources' and app_private.supervisor(app_private.object_pair(name)) and app_private.writable(app_private.object_pair(name)));
create policy rofaqa_file_delete on storage.objects for delete to authenticated using (
  bucket_id='pair-resources' and app_private.supervisor(app_private.object_pair(name)) and app_private.writable(app_private.object_pair(name))
  and not exists(select 1 from public.resources r where r.object_key=name and r.status='published'));

-- Only listed public entry points are callable. Private helpers cannot be invoked directly.
do $$ declare f record;
begin
  for f in select p.oid::regprocedure as signature from pg_proc p join pg_namespace n on n.oid=p.pronamespace
    where n.nspname='app_private' or (n.nspname='public' and p.proname in (
      'complete_profile','create_pair','rotate_invitation','revoke_invitation','inspect_invitation','accept_invitation',
      'archive_pair','save_weekly_target','respond_shared_target','save_daily_entry','save_meeting','publish_resource',
      'update_resource','resource_storage_usage','admin_accounts','admin_set_enabled')) loop
    execute format('revoke all on function %s from public,anon,authenticated',f.signature);
  end loop;
  for f in select p.oid::regprocedure as signature from pg_proc p join pg_namespace n on n.oid=p.pronamespace
    where n.nspname='public' and p.proname in (
      'complete_profile','create_pair','rotate_invitation','revoke_invitation','inspect_invitation','accept_invitation',
      'archive_pair','save_weekly_target','respond_shared_target','save_daily_entry','save_meeting','publish_resource',
      'update_resource','resource_storage_usage','admin_accounts','admin_set_enabled') loop
    execute format('grant execute on function %s to authenticated',f.signature);
  end loop;
end $$;
grant execute on function public.inspect_invitation(text) to anon;
-- RLS policies invoke helpers with invoker privilege, so expose narrowly scoped predicates.
grant usage on schema app_private to authenticated;
grant execute on function app_private.enabled(uuid),app_private.admin(),app_private.member(uuid),
  app_private.supervisor(uuid),app_private.can_read_pair(uuid),app_private.writable(uuid),app_private.object_pair(text) to authenticated;
commit;
