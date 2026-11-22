-- Minimal Supabase schema contract for isolated PostgreSQL testing only.
do $$ begin
 if not exists(select 1 from pg_roles where rolname='anon') then create role anon nologin; end if;
 if not exists(select 1 from pg_roles where rolname='authenticated') then create role authenticated nologin; end if;
 if not exists(select 1 from pg_roles where rolname='service_role') then create role service_role nologin bypassrls; end if;
end $$;
create schema auth;
create schema storage;
create table auth.users (
 id uuid primary key, email text not null, email_confirmed_at timestamptz,
 raw_user_meta_data jsonb not null default '{}'
);
create function auth.uid() returns uuid language sql stable as $$
 select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid
$$;
grant usage on schema auth to anon,authenticated;
grant execute on function auth.uid() to anon,authenticated;
create table storage.buckets (
 id text primary key,name text not null,public boolean not null default false,
 file_size_limit bigint,allowed_mime_types text[]
);
create table storage.objects (
 id uuid primary key default gen_random_uuid(),bucket_id text references storage.buckets(id),
 name text not null,metadata jsonb,created_at timestamptz default now(),unique(bucket_id,name)
);
alter table storage.objects enable row level security;
grant usage on schema storage to authenticated;
grant select,insert,delete on storage.objects to authenticated;
create function storage.allow_any_operation(p_operations text[]) returns boolean language sql stable as $$
 select replace(current_setting('storage.operation',true),'storage.','')=any(p_operations)
$$;
grant execute on function storage.allow_any_operation(text[]) to authenticated;
