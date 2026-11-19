-- Green Mile sales planning dashboard.
-- Authorization reads sales_profiles (team = 'PPIC'), never user_metadata.
-- app_metadata.team may be set by scripts/provision-auth-users.mjs, but policies
-- do not trust the JWT claim because it can be stale until the token refreshes.

create schema if not exists private;

revoke all on schema private from public, anon;
grant usage on schema private to authenticated;

create table public.sales_profiles (
  id uuid primary key default gen_random_uuid(),
  roster_order integer not null,
  name text not null,
  email text,
  area text not null,
  team text not null,
  status text not null,
  auth_user_id uuid unique references auth.users (id) on delete set null,
  created_at timestamptz not null default pg_catalog.now(),
  updated_at timestamptz not null default pg_catalog.now(),
  constraint sales_profiles_name_unique unique (name),
  constraint sales_profiles_email_unique unique (email),
  constraint sales_profiles_email_lowercase check (email is null or email = lower(email)),
  constraint sales_profiles_team_check check (team in ('Sales', 'PPIC')),
  constraint sales_profiles_status_check check (status in ('Aktif', 'Nonaktif'))
);

comment on table public.sales_profiles is
  'Roster Data Sales. Email null means the person cannot log in.';

create table public.visit_reports (
  id uuid primary key default gen_random_uuid(),
  external_id text,
  visit_date date not null,
  start_time time,
  end_time time,
  duration_hours numeric(6, 2),
  sales_email text,
  sales_name text not null,
  calendar_event_id text,
  customer_name text,
  customer_type text,
  city_area text,
  address text,
  visit_purpose text,
  visit_status text,
  activity_result text,
  products_discussed text,
  potential_value numeric(18, 2) not null default 0,
  order_value numeric(18, 2) not null default 0,
  pipeline_status text,
  notes text,
  follow_up_date date,
  documentation_url text,
  created_at timestamptz not null default pg_catalog.now(),
  updated_at timestamptz not null default pg_catalog.now(),
  constraint visit_reports_external_id_unique unique (external_id),
  constraint visit_reports_values_nonnegative check (
    potential_value >= 0 and order_value >= 0
  )
);

comment on table public.visit_reports is
  'Laporan kunjungan. Starts empty. Do not insert sample rows.';

comment on column public.visit_reports.pipeline_status is
  'Expected: Prospek, Negosiasi, Deal, Lost. Active pipeline = Prospek or Negosiasi.';

comment on column public.visit_reports.visit_status is
  'Expected: Terlaksana, Tidak Ketemu, Reschedule, Dibatalkan.';

comment on column public.visit_reports.activity_result is
  'Expected: Deal, Progress / Minat, Follow Up Lagi, Tidak Tertarik, Tidak Ada Keputusan.';

create index sales_profiles_auth_user_id_idx on public.sales_profiles (auth_user_id);
create index visit_reports_visit_date_idx on public.visit_reports (visit_date);
create index visit_reports_sales_email_idx on public.visit_reports (lower(sales_email));

create or replace function private.set_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at = pg_catalog.now();
  return new;
end;
$$;

create or replace function private.normalize_visit_email()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.sales_email is not null then
    new.sales_email = lower(btrim(new.sales_email));
    if new.sales_email = '' then
      new.sales_email = null;
    end if;
  end if;
  return new;
end;
$$;

create or replace function private.link_sales_profile()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  update public.sales_profiles
     set auth_user_id = new.id,
         updated_at = pg_catalog.now()
   where email = lower(new.email)
     and (auth_user_id is null or auth_user_id = new.id);
  return new;
end;
$$;

create or replace function private.current_user_is_active_staff()
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
      and (
        auth_user_id = (select auth.uid())
        or (
          email is not null
          and email = lower(coalesce((select auth.jwt() ->> 'email'), ''))
        )
      )
  );
$$;

create or replace function private.current_user_is_ppic()
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
      and team = 'PPIC'
      and (
        auth_user_id = (select auth.uid())
        or (
          email is not null
          and email = lower(coalesce((select auth.jwt() ->> 'email'), ''))
        )
      )
  );
$$;

revoke all on function private.set_updated_at() from public, anon, authenticated;
revoke all on function private.normalize_visit_email() from public, anon, authenticated;
revoke all on function private.link_sales_profile() from public, anon, authenticated;
revoke all on function private.current_user_is_active_staff() from public, anon;
revoke all on function private.current_user_is_ppic() from public, anon;
grant execute on function private.current_user_is_active_staff() to authenticated;
grant execute on function private.current_user_is_ppic() to authenticated;

create trigger sales_profiles_set_updated_at
before update on public.sales_profiles
for each row execute function private.set_updated_at();

create trigger visit_reports_set_updated_at
before update on public.visit_reports
for each row execute function private.set_updated_at();

create trigger visit_reports_normalize_email
before insert or update on public.visit_reports
for each row execute function private.normalize_visit_email();

create trigger on_auth_user_created_link_profile
after insert on auth.users
for each row execute function private.link_sales_profile();

alter table public.sales_profiles enable row level security;
alter table public.sales_profiles force row level security;
alter table public.visit_reports enable row level security;
alter table public.visit_reports force row level security;

revoke all on table public.sales_profiles from anon, authenticated;
revoke all on table public.visit_reports from anon, authenticated;
grant select on table public.sales_profiles to authenticated;
grant select on table public.visit_reports to authenticated;

create policy sales_profiles_select_active_staff
on public.sales_profiles
for select
to authenticated
using (private.current_user_is_active_staff());

create policy visit_reports_select_scoped
on public.visit_reports
for select
to authenticated
using (
  private.current_user_is_ppic()
  or (
    private.current_user_is_active_staff()
    and lower(coalesce(sales_email, '')) = lower(coalesce((select auth.jwt() ->> 'email'), ''))
  )
);
