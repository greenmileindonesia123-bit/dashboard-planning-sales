-- Cross-user kegiatan access belongs to Super Admin only.
-- Super Admin is the active sales_profiles row for Puput
-- (operasionalgreenmileindonesia@gmail.com), matched to the JWT email.
-- Team PPIC stays an organizational label and no longer grants all-data access.
-- current_user_is_ppic() remains for the org-team check.

create or replace function private.current_user_is_super_admin()
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
      and email = 'operasionalgreenmileindonesia@gmail.com'
      and email = lower(coalesce((select auth.jwt() ->> 'email'), ''))
  );
$$;

revoke all on function private.current_user_is_super_admin() from public, anon;
grant execute on function private.current_user_is_super_admin() to authenticated;

drop policy if exists visit_reports_select_scoped on public.visit_reports;
create policy visit_reports_select_scoped
on public.visit_reports
for select
to authenticated
using (
  private.current_user_is_super_admin()
  or (
    private.current_user_is_active_staff()
    and lower(coalesce(sales_email, '')) = lower(coalesce((select auth.jwt() ->> 'email'), ''))
  )
);

drop policy if exists visit_reports_insert_scoped on public.visit_reports;
create policy visit_reports_insert_scoped
on public.visit_reports
for insert
to authenticated
with check (
  private.current_user_is_super_admin()
  or (
    private.current_user_is_active_staff()
    and sales_email = lower(coalesce((select auth.jwt() ->> 'email'), ''))
  )
);

drop policy if exists visit_reports_update_scoped on public.visit_reports;
create policy visit_reports_update_scoped
on public.visit_reports
for update
to authenticated
using (
  private.current_user_is_super_admin()
  or (
    private.current_user_is_active_staff()
    and lower(coalesce(sales_email, '')) = lower(coalesce((select auth.jwt() ->> 'email'), ''))
  )
)
with check (
  private.current_user_is_super_admin()
  or (
    private.current_user_is_active_staff()
    and sales_email = lower(coalesce((select auth.jwt() ->> 'email'), ''))
  )
);

drop policy if exists calendar_events_select_scoped on public.calendar_events;
create policy calendar_events_select_scoped
on public.calendar_events
for select
to authenticated
using (
  private.current_user_is_super_admin()
  or (
    private.current_user_is_active_staff()
    and sales_email = lower(coalesce((select auth.jwt() ->> 'email'), ''))
  )
);

drop policy if exists calendar_events_insert_scoped on public.calendar_events;
create policy calendar_events_insert_scoped
on public.calendar_events
for insert
to authenticated
with check (
  private.current_user_is_super_admin()
  or (
    private.current_user_is_active_staff()
    and sales_email = lower(coalesce((select auth.jwt() ->> 'email'), ''))
  )
);

drop policy if exists calendar_events_update_scoped on public.calendar_events;
create policy calendar_events_update_scoped
on public.calendar_events
for update
to authenticated
using (
  private.current_user_is_super_admin()
  or (
    private.current_user_is_active_staff()
    and sales_email = lower(coalesce((select auth.jwt() ->> 'email'), ''))
  )
)
with check (
  private.current_user_is_super_admin()
  or (
    private.current_user_is_active_staff()
    and sales_email = lower(coalesce((select auth.jwt() ->> 'email'), ''))
  )
);

drop policy if exists calendar_sync_requests_select_scoped on public.calendar_sync_requests;
create policy calendar_sync_requests_select_scoped
on public.calendar_sync_requests
for select
to authenticated
using (
  private.current_user_is_super_admin()
  or (
    private.current_user_is_active_staff()
    and requested_by = lower(coalesce((select auth.jwt() ->> 'email'), ''))
  )
);
