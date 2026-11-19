-- Allow signed-in staff to insert and update visit reports.
-- Sales can write only rows whose sales_email matches the JWT email.
-- PPIC can write every row. There is no delete policy and no anon access.
-- SELECT policy visit_reports_select_scoped already exists.

grant insert, update on table public.visit_reports to authenticated;

create policy visit_reports_insert_scoped
on public.visit_reports
for insert
to authenticated
with check (
  private.current_user_is_ppic()
  or (
    private.current_user_is_active_staff()
    and sales_email = lower(coalesce((select auth.jwt() ->> 'email'), ''))
  )
);

create policy visit_reports_update_scoped
on public.visit_reports
for update
to authenticated
using (
  private.current_user_is_ppic()
  or (
    private.current_user_is_active_staff()
    and lower(coalesce(sales_email, '')) = lower(coalesce((select auth.jwt() ->> 'email'), ''))
  )
)
with check (
  private.current_user_is_ppic()
  or (
    private.current_user_is_active_staff()
    and sales_email = lower(coalesce((select auth.jwt() ->> 'email'), ''))
  )
);
