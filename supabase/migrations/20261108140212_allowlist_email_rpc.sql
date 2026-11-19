-- Login allowlist for the anon key. Returns a boolean only, so the roster
-- stays closed. This function lives in public because PostgREST exposes that
-- schema; it does not return profile rows.
-- Already applied on project dashboard-planning-sales. CREATE OR REPLACE keeps
-- a fresh database aligned with that contract.

create or replace function public.is_active_registered_email(check_email text)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.sales_profiles
    where status = 'Aktif'
      and email is not null
      and email = lower(btrim(check_email))
  );
$$;

revoke all on function public.is_active_registered_email(text) from public;
grant execute on function public.is_active_registered_email(text) to anon, authenticated;

comment on function public.is_active_registered_email(text) is
  'True only when the trimmed, lowercased email belongs to an Aktif sales_profiles row.';
