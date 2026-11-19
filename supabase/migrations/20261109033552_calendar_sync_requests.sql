-- Manual calendar sync requests. The Next.js app inserts a pending row.
-- An external worker, using the service role outside this app, updates status.
-- The app never calls Google and never receives the service role.

create table public.calendar_sync_requests (
  id uuid primary key default gen_random_uuid(),
  requested_by text not null,
  requested_at timestamptz not null default pg_catalog.now(),
  status text not null default 'pending',
  message text,
  finished_at timestamptz,
  constraint calendar_sync_requests_email_lowercase check (requested_by = lower(requested_by)),
  constraint calendar_sync_requests_status_check check (status in ('pending', 'running', 'done', 'failed'))
);

comment on table public.calendar_sync_requests is
  'Staff request a hub calendar sync. Does not store Google credentials or events.';

create index calendar_sync_requests_recent_idx
  on public.calendar_sync_requests (status, requested_at desc);

create or replace function public.calendar_sync_is_active(since timestamptz)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select private.current_user_is_active_staff()
    and exists (
      select 1
      from public.calendar_sync_requests
      where status in ('pending', 'running')
        and requested_at >= since
    );
$$;

revoke all on function public.calendar_sync_is_active(timestamptz) from public;
grant execute on function public.calendar_sync_is_active(timestamptz) to authenticated;

alter table public.calendar_sync_requests enable row level security;
alter table public.calendar_sync_requests force row level security;

revoke all on table public.calendar_sync_requests from anon, authenticated;
grant select, insert on table public.calendar_sync_requests to authenticated;

create policy calendar_sync_requests_select_scoped
on public.calendar_sync_requests
for select
to authenticated
using (
  private.current_user_is_ppic()
  or (
    private.current_user_is_active_staff()
    and requested_by = lower(coalesce((select auth.jwt() ->> 'email'), ''))
  )
);

create policy calendar_sync_requests_insert_own
on public.calendar_sync_requests
for insert
to authenticated
with check (
  private.current_user_is_active_staff()
  and requested_by = lower(coalesce((select auth.jwt() ->> 'email'), ''))
);
