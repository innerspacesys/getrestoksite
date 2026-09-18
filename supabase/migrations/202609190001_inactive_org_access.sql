-- Restok: let inactive / expired / canceled orgs show a "please resubscribe"
-- screen instead of a silently blank dashboard, and record a data-retention
-- window so an accidental cancellation can be undone before anything is deleted.
begin;

-- Membership check that IGNORES whether the org is active. Used only to let a
-- valid member READ their own organization row (so the app can read active /
-- status / retention and render the right screen). Every data table and every
-- org write still goes through restok_member(), which requires an active org.
create or replace function public.restok_belongs(target_org text)
  returns boolean language sql stable security definer set search_path = '' as $$
  select exists(
    select 1 from public.profiles p
    where p.auth_user_id = auth.uid()
      and p.org_id = target_org
      and not p.disabled
      and p.account_status <> 'deactivated'
  );
$$;
revoke all on function public.restok_belongs(text) from public;
grant execute on function public.restok_belongs(text) to authenticated, service_role;

-- Relax ONLY the organization read policy so a member can always see their own
-- org row, active or not. org_internal_update and every data-table policy are
-- unchanged and still require an active org via restok_member().
drop policy if exists org_read on public.organizations;
create policy org_read on public.organizations for select to authenticated
  using (public.restok_belongs(id) or public.restok_internal());

-- When an org is canceled we keep its data until this moment before any
-- deletion, so an accidental cancellation can be undone by resubscribing.
alter table public.organizations
  add column if not exists scheduled_deletion_at timestamptz;

commit;
