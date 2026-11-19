-- Staff can insert and update synced calendar rows.
-- Sales may write only sales_email equal to their JWT email.
-- PPIC may write every row. No delete policy.

grant insert, update on table public.calendar_events to authenticated;

create policy calendar_events_insert_scoped
on public.calendar_events
for insert
to authenticated
with check (
  private.current_user_is_ppic()
  or (
    private.current_user_is_active_staff()
    and sales_email = lower(coalesce((select auth.jwt() ->> 'email'), ''))
  )
);

create policy calendar_events_update_scoped
on public.calendar_events
for update
to authenticated
using (
  private.current_user_is_ppic()
  or (
    private.current_user_is_active_staff()
    and sales_email = lower(coalesce((select auth.jwt() ->> 'email'), ''))
  )
)
with check (
  private.current_user_is_ppic()
  or (
    private.current_user_is_active_staff()
    and sales_email = lower(coalesce((select auth.jwt() ->> 'email'), ''))
  )
);
