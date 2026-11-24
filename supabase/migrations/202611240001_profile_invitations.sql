-- Add a private, email-bound invitation inbox without exposing invitation tokens.
-- Additive migration: apply after 202611220001_initial.sql; do not rerun the initial schema.
begin;

-- now() is transaction-stable, so rotation timestamps can tie. This internal
-- sequence provides a deterministic insertion order for future invitations.
alter table public.invitations add column if not exists issued_order bigint generated always as identity;
create index if not exists invitation_recipient_inbox
  on public.invitations(recipient_email,created_at desc,issued_order desc);
create index if not exists invitation_accepted_inbox
  on public.invitations(accepted_by) where accepted_by is not null;

create or replace function public.list_my_invitations()
returns table(
  id uuid,
  supervisor_name text,
  created_at timestamptz,
  expires_at timestamptz,
  accepted_at timestamptz,
  revoked_at timestamptz,
  state text
)
language plpgsql stable security definer set search_path=public,pg_temp as $$
declare current_email text;
begin
  if not app_private.enabled() then
    raise exception 'يرجى تسجيل الدخول بحساب مفعّل لعرض دعواتك.' using errcode='42501';
  end if;
  select lower(u.email) into current_email from auth.users u
    where u.id=auth.uid() and u.email_confirmed_at is not null;
  if current_email is null then
    raise exception 'أكّد بريدك الإلكتروني لعرض الدعوات الموجّهة إليك.' using errcode='42501';
  end if;
  return query
  with latest as (
    select distinct on (i.pair_id,i.slot) i.*
    from public.invitations i
    -- Existing rows can have tied timestamps and physically reordered heap
    -- positions during the identity backfill. Prefer the sole current/accepted
    -- invite, then use issuance order to choose withdrawn history.
    order by i.pair_id,i.slot,
      case when i.accepted_at is not null then 0 when i.revoked_at is null then 1 else 2 end,
      i.created_at desc,i.issued_order desc
  )
  select i.id,pr.display_name,i.created_at,i.expires_at,i.accepted_at,i.revoked_at,
    case
      when i.accepted_by=auth.uid() and i.accepted_at is not null then 'accepted'
      when i.revoked_at is not null then 'revoked'
      when p.status<>'pending' or not pr.enabled or exists(
        select 1 from public.pair_members m join public.profiles participant on participant.id=m.user_id
        where m.pair_id=p.id and not participant.enabled
      ) then 'unavailable'
      when i.expires_at<=now() then 'expired'
      else 'pending'
    end
  from latest i join public.pairs p on p.id=i.pair_id
    join public.profiles pr on pr.id=p.supervisor_id
  where (i.accepted_at is null and i.recipient_email=current_email)
    or (i.accepted_at is not null and i.accepted_by=auth.uid())
  order by i.created_at desc,i.issued_order desc;
end $$;

-- Both acceptance entry points share exactly the same transaction invariants.
-- This helper is not callable by application roles.
create or replace function app_private.accept_invitation_id(p_invitation_id uuid)
returns jsonb language plpgsql security definer set search_path=public,pg_temp as $$
declare inv public.invitations; p public.pairs; current_email text; member_record record;
begin
  if not app_private.enabled() then raise exception 'الحساب غير متاح.' using errcode='42501'; end if;
  perform pg_advisory_xact_lock(hashtextextended('rofaqa_membership',0));
  select * into inv from public.invitations where id=p_invitation_id;
  if not found then raise exception 'الدعوة غير صالحة. اطلب دعوة جديدة من المشرف.'; end if;
  -- Pair -> invitation lock order agrees with rotation/revocation/archive.
  select * into p from public.pairs where id=inv.pair_id for update;
  select * into inv from public.invitations where id=p_invitation_id for update;
  select lower(u.email) into current_email from auth.users u
    where u.id=auth.uid() and u.email_confirmed_at is not null;
  if current_email is null or current_email<>inv.recipient_email then
    raise exception 'سجّل الدخول بالبريد المؤكّد المخصّص لهذه الدعوة.' using errcode='42501';
  end if;
  if inv.revoked_at is not null then raise exception 'أُلغيت هذه الدعوة. اطلب دعوة جديدة من المشرف.'; end if;
  if inv.accepted_by=auth.uid() then
    return jsonb_build_object('pair_id',p.id,'status',p.status,'name',p.name);
  end if;
  if inv.accepted_at is not null or inv.expires_at<=now() or p.status<>'pending' then
    raise exception 'انتهت صلاحية الدعوة أو استُخدمت. اطلب دعوة جديدة من المشرف.';
  end if;
  -- Reject stale IDs as well as revoked tokens, including timestamp-tied rotations.
  if exists(select 1 from public.invitations newer
    where newer.pair_id=inv.pair_id and newer.slot=inv.slot
      and newer.revoked_at is null and newer.accepted_at is null
      and (newer.created_at,newer.issued_order)>(inv.created_at,inv.issued_order)) then
    raise exception 'جُدّدت هذه الدعوة. حدّث صفحة الدعوات واستخدم الدعوة الأحدث.';
  end if;
  -- Lock all participant profiles while deciding activation, to serialize a
  -- simultaneous account disable against acceptance into a new member seat.
  perform 1 from public.profiles participant
    where participant.id in (auth.uid(),p.supervisor_id)
      or participant.id in (select m.user_id from public.pair_members m where m.pair_id=p.id)
    order by participant.id for share;
  if not app_private.enabled(p.supervisor_id) or exists(
    select 1 from public.pair_members m join public.profiles participant on participant.id=m.user_id
    where m.pair_id=p.id and not participant.enabled
  ) then raise exception 'الرفقة متوقفة مؤقتًا. راجع المشرف قبل قبول الدعوة.'; end if;
  if not app_private.enabled() then raise exception 'الحساب غير متاح.' using errcode='42501'; end if;
  if p.supervisor_id=auth.uid() or exists(
    select 1 from public.pair_members m where m.pair_id=p.id and m.user_id=auth.uid()
  ) or exists(
    select 1 from public.pair_members m join public.pairs other_pair on other_pair.id=m.pair_id
    where m.user_id=auth.uid() and other_pair.status='active'
  ) then raise exception 'لا يمكنك الانضمام إلى أكثر من رفقة نشطة أو شغل مقعدين.'; end if;
  update public.pair_members set user_id=auth.uid(),accepted_at=now()
    where pair_id=p.id and slot=inv.slot and user_id is null;
  if not found then raise exception 'هذا المقعد غير متاح.'; end if;
  update public.invitations set accepted_at=now(),accepted_by=auth.uid() where id=inv.id;
  if (select count(*) from public.pair_members m where m.pair_id=p.id and m.user_id is not null)=2 then
    for member_record in select m.user_id from public.pair_members m where m.pair_id=p.id loop
      if not app_private.enabled(member_record.user_id) or exists(
        select 1 from public.pair_members m join public.pairs other_pair on other_pair.id=m.pair_id
        where m.user_id=member_record.user_id and other_pair.status='active' and other_pair.id<>p.id
      ) then raise exception 'تعذّر تفعيل الرفقة. راجع المشرف بشأن عضوية الرفيقين.'; end if;
    end loop;
    update public.pairs set status='active' where id=p.id returning * into p;
  end if;
  return jsonb_build_object('pair_id',p.id,'status',p.status,'name',p.name);
end $$;

create or replace function public.accept_invitation(p_token text) returns jsonb
language plpgsql security definer set search_path=public,extensions,pg_temp as $$
declare invitation_id uuid;
begin
  perform app_private.rate_limit('accept_invitation',40);
  begin
    select id into invitation_id from public.invitations where token_hash=extensions.digest(p_token,'sha256');
    return app_private.accept_invitation_id(invitation_id);
  exception when others then
    return jsonb_build_object('error',case when sqlerrm ~ '[ء-ي]' then sqlerrm
      else 'تعذّر قبول الدعوة. أعد المحاولة أو اطلب دعوة جديدة من المشرف.' end,'code',sqlstate);
  end;
end $$;

create or replace function public.accept_profile_invitation(p_invitation_id uuid) returns jsonb
language plpgsql security definer set search_path=public,pg_temp as $$
begin
  -- Same budget as token acceptance; failed validation commits this counter.
  perform app_private.rate_limit('accept_invitation',40);
  begin
    return app_private.accept_invitation_id(p_invitation_id);
  exception when others then
    return jsonb_build_object('error',case when sqlerrm ~ '[ء-ي]' then sqlerrm
      else 'تعذّر قبول الدعوة. أعد المحاولة أو اطلب دعوة جديدة من المشرف.' end,'code',sqlstate);
  end;
end $$;

revoke all on function app_private.accept_invitation_id(uuid) from public,anon,authenticated;
revoke all on function public.list_my_invitations(),public.accept_profile_invitation(uuid),public.accept_invitation(text)
  from public,anon,authenticated;
grant execute on function public.list_my_invitations(),public.accept_profile_invitation(uuid),public.accept_invitation(text)
  to authenticated;
-- No recipient table SELECT grant, token/hash grant, or admin access override.
commit;
