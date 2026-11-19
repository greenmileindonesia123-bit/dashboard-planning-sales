-- Synced Google Calendar rows. Written outside this app from the hub account
-- greenmileindonesia123@gmail.com after each salesperson shares their calendar.
-- This app only selects. Do not insert sample events.

create table public.calendar_events (
  id uuid primary key default gen_random_uuid(),
  sales_email text not null,
  google_event_id text not null,
  title text not null default '',
  starts_at timestamptz not null,
  ends_at timestamptz not null,
  all_day boolean not null default false,
  location text,
  html_link text,
  status text not null default 'confirmed',
  created_at timestamptz not null default pg_catalog.now(),
  updated_at timestamptz not null default pg_catalog.now(),
  constraint calendar_events_identity_unique unique (sales_email, google_event_id),
  constraint calendar_events_email_lowercase check (sales_email = lower(sales_email)),
  constraint calendar_events_status_check check (status in ('confirmed', 'tentative', 'cancelled')),
  constraint calendar_events_time_order check (ends_at >= starts_at)
);

comment on table public.calendar_events is
  'Google Calendar events synced per sales email. Cancelled rows stay so a later sync can hide them. No sample data.';

comment on column public.calendar_events.sales_email is
  'Email Google from sales_profiles. People without an email have no rows.';

comment on column public.calendar_events.status is
  'confirmed, tentative, or cancelled. The board hides cancelled.';

create index calendar_events_sales_starts_idx
  on public.calendar_events (sales_email, starts_at);

create index calendar_events_range_idx
  on public.calendar_events (starts_at, ends_at);

create or replace function private.normalize_calendar_email()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.sales_email = lower(btrim(new.sales_email));
  return new;
end;
$$;

revoke all on function private.normalize_calendar_email() from public, anon, authenticated;

create trigger calendar_events_normalize_email
before insert or update on public.calendar_events
for each row execute function private.normalize_calendar_email();

create trigger calendar_events_set_updated_at
before update on public.calendar_events
for each row execute function private.set_updated_at();

alter table public.calendar_events enable row level security;
alter table public.calendar_events force row level security;

revoke all on table public.calendar_events from anon, authenticated;
grant select on table public.calendar_events to authenticated;

create policy calendar_events_select_scoped
on public.calendar_events
for select
to authenticated
using (
  private.current_user_is_ppic()
  or (
    private.current_user_is_active_staff()
    and sales_email = lower(coalesce((select auth.jwt() ->> 'email'), ''))
  )
);
