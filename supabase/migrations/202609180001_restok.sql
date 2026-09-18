-- Restok relational schema. Apply to the new Supabase project only.
begin;
create table public.organizations (
  id text primary key, name text not null default 'My Organization', owner_id text,
  plan text not null default 'basic', active boolean not null default true,
  stripe_customer_id text, stripe_subscription_id text,
  created_at timestamptz default now(), canceled_at timestamptz,
  status text, beta boolean, manual_plan_override boolean default false,
  internal_notes text, metadata jsonb not null default '{}'::jsonb
);
create table public.profiles (
  id text primary key, auth_user_id uuid unique references auth.users(id) on delete set null,
  org_id text references public.organizations(id) on delete set null,
  email text not null, name text, phone text, role text not null default 'member' check(role in ('owner','admin','member')),
  disabled boolean not null default false, account_status text not null default 'active',
  internal_admin boolean not null default false, notification_email text,
  email_notifications boolean not null default true, low_stock_alerts boolean not null default true,
  created_at timestamptz default now(), updated_at timestamptz, removed_at timestamptz,
  deactivated_at timestamptz, reactivated_at timestamptz, scheduled_deletion_at timestamptz,
  last_notification_test_at timestamptz, auth_provider text, theme text,
  metadata jsonb not null default '{}'::jsonb
);
create index profiles_org on public.profiles(org_id);
create index profiles_email on public.profiles(lower(email));
create table public.vendors (
  id text not null, org_id text not null references public.organizations(id) on delete cascade,
  name text not null, email text, website text, has_physical_store boolean default false,
  created_at timestamptz default now(), updated_at timestamptz, metadata jsonb not null default '{}'::jsonb,
  primary key(org_id,id)
);
create table public.locations (
  id text not null, org_id text not null references public.organizations(id) on delete cascade,
  name text not null, address text, description text, is_department boolean default false,
  created_at timestamptz default now(), updated_at timestamptz, metadata jsonb not null default '{}'::jsonb,
  primary key(org_id,id)
);
create table public.items (
  id text not null, org_id text not null references public.organizations(id) on delete cascade,
  name text not null, days_last integer not null check(days_last > 0), reminder_days integer not null default 3 check(reminder_days between 0 and 365),
  vendor_id text, location_id text, description text, sku text, created_by_name text,
  created_at timestamptz default now(), last_restocked_at timestamptz, last_alert_sent_at timestamptz,
  order_status text not null default 'idle' check(order_status in ('idle','ordered')),
  ordered_at timestamptz, ordered_by_name text, reorder_method text,
  metadata jsonb not null default '{}'::jsonb, primary key(org_id,id),
  foreign key(org_id,vendor_id) references public.vendors(org_id,id),
  foreign key(org_id,location_id) references public.locations(org_id,id)
);
create table public.item_activity (
  id text not null, org_id text not null, item_id text not null,
  action text not null check(action in ('ordered','received','cancelled')), at timestamptz not null default now(),
  actor_uid text, actor_name text, previous_start double precision, item_name text,
  metadata jsonb not null default '{}'::jsonb,
  primary key(org_id,item_id,id), foreign key(org_id,item_id) references public.items(org_id,id) on delete cascade
);
create index item_activity_recent on public.item_activity(org_id,item_id,at desc);
create table public.pending_signups (
  id text primary key, email text not null, name text, org_name text, phone text, plan text, interval text,
  google_uid text, google_email text, created_at timestamptz default now(), metadata jsonb not null default '{}'::jsonb
);
create table public.password_setup_tokens (
  id text primary key, uid text not null, email text, created_at timestamptz default now(), expires_at timestamptz not null,
  metadata jsonb not null default '{}'::jsonb
);
create table public.audit_logs (
  id text primary key, org_id text, type text, created_at timestamptz default now(), metadata jsonb not null default '{}'::jsonb
);
create table public.notification_deliveries (
  id text primary key, recipient text not null, subject text not null, html text not null, text text,
  created_at timestamptz default now(), sent_at timestamptz, metadata jsonb not null default '{}'::jsonb
);
-- Keep unknown legacy collections in a private archive until their migration is reviewed.
create schema if not exists migration_private;
revoke all on schema migration_private from public, anon, authenticated;
create table migration_private.source_documents(path text primary key, payload jsonb not null);
create table migration_private.auth_mapping(firebase_uid text primary key, supabase_uid uuid unique not null, needs_password_reset boolean not null default false);

create function public.restok_uid() returns text language sql stable security definer set search_path = '' as $$
 select id from public.profiles where auth_user_id = auth.uid() and not disabled and account_status <> 'deactivated' limit 1;
$$;
create function public.restok_member(target_org text) returns boolean language sql stable security definer set search_path = '' as $$
 select exists(select 1 from public.profiles p join public.organizations o on o.id=p.org_id
 where p.auth_user_id=auth.uid() and p.org_id=target_org and not p.disabled and p.account_status <> 'deactivated' and o.active);
$$;
create function public.restok_internal() returns boolean language sql stable security definer set search_path = '' as $$
 select exists(select 1 from public.profiles where auth_user_id=auth.uid() and internal_admin and not disabled);
$$;
revoke all on function public.restok_uid(), public.restok_member(text), public.restok_internal() from public;
grant execute on function public.restok_uid(), public.restok_member(text), public.restok_internal() to authenticated, service_role;

alter table public.organizations enable row level security;
alter table public.profiles enable row level security;
alter table public.vendors enable row level security;
alter table public.locations enable row level security;
alter table public.items enable row level security;
alter table public.item_activity enable row level security;
alter table public.pending_signups enable row level security;
alter table public.password_setup_tokens enable row level security;
alter table public.audit_logs enable row level security;
alter table public.notification_deliveries enable row level security;

-- Explicit grants: no anonymous access and no browser access to server-only tables.
revoke all on all tables in schema public from anon, authenticated;
grant select on public.organizations,public.profiles,public.vendors,public.locations,public.items,public.item_activity to authenticated;
grant insert,update,delete on public.vendors,public.locations,public.items to authenticated;
grant update on public.organizations to authenticated;
grant update(name,phone,theme,updated_at) on public.profiles to authenticated;
grant all on all tables in schema public to service_role;
create policy org_read on public.organizations for select to authenticated using(public.restok_member(id) or public.restok_internal());
create policy org_internal_update on public.organizations for update to authenticated using(public.restok_internal()) with check(public.restok_internal());
create policy profile_read on public.profiles for select to authenticated using(auth_user_id=auth.uid() or public.restok_member(org_id) or public.restok_internal());
create policy profile_edit on public.profiles for update to authenticated using(auth_user_id=auth.uid() and not disabled) with check(auth_user_id=auth.uid() and not disabled);
create policy vendors_member on public.vendors for all to authenticated using(public.restok_member(org_id)) with check(public.restok_member(org_id));
create policy locations_member on public.locations for all to authenticated using(public.restok_member(org_id)) with check(public.restok_member(org_id));
create policy items_member on public.items for all to authenticated using(public.restok_member(org_id)) with check(public.restok_member(org_id));
create policy activity_read on public.item_activity for select to authenticated using(public.restok_member(org_id));

-- Lock organization row so simultaneous inserts cannot exceed plan limits.
create function public.enforce_restok_limits() returns trigger language plpgsql security definer set search_path = '' as $$
 declare plan_name text; capacity integer; used integer;
 begin
 if auth.role() = 'service_role' or current_user = 'postgres' and auth.uid() is null then return new; end if;
 select plan into plan_name from public.organizations where id=new.org_id for update;
 if tg_table_name='items' then
   capacity := case plan_name when 'basic' then 5 when 'pro' then 10 else null end;
   select count(*) into used from public.items where org_id=new.org_id;
 else
   capacity := case plan_name when 'basic' then 1 when 'pro' then 2 else null end;
   select count(*) into used from public.locations where org_id=new.org_id;
 end if;
 if capacity is not null and used >= capacity then raise exception 'Plan limit reached'; end if;
 return new;
 end;
$$;
revoke all on function public.enforce_restok_limits() from public;
create trigger item_plan_limit before insert on public.items for each row execute function public.enforce_restok_limits();
create trigger location_plan_limit before insert on public.locations for each row execute function public.enforce_restok_limits();

-- Enable authenticated subscriptions to the tables used by the dashboard.
do $$ declare t text; begin
 foreach t in array array['organizations','profiles','items','vendors','locations'] loop
   if not exists(select 1 from pg_publication_tables where pubname='supabase_realtime' and schemaname='public' and tablename=t) then
     execute format('alter publication supabase_realtime add table public.%I',t);
   end if;
 end loop;
end $$;
create function public.create_auth_profile() returns trigger language plpgsql security definer set search_path='' as $$
 begin
 insert into public.profiles(id,auth_user_id,email,name,internal_admin)
 values(coalesce(new.raw_app_meta_data->>'restok_uid',new.id::text),new.id,coalesce(new.email,''),coalesce(new.raw_user_meta_data->>'display_name',new.raw_user_meta_data->>'full_name',''),coalesce((new.raw_app_meta_data->>'internalAdmin')::boolean,false))
 on conflict(id) do update set auth_user_id=excluded.auth_user_id;
 return new;
 end;
$$;
revoke all on function public.create_auth_profile() from public;
create trigger create_restok_profile after insert on auth.users for each row execute function public.create_auth_profile();
commit;
