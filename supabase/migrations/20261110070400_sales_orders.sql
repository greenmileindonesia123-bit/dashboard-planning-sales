-- Sales Order deals uploaded by Super Admin.
-- Deal value is net_total. Cancelled and draft rows may be stored
-- and are excluded from totals in the app.
-- Staff read only sales_email equal to their JWT email.
-- Rows with a null sales_email (unmapped sales person) are visible to Super Admin only.
-- Insert and update are Super Admin only. No delete policy and no anon access.

create table public.sales_orders (
  id uuid primary key default gen_random_uuid(),
  so_number text not null,
  quotation text,
  customer text,
  order_date date not null,
  net_total numeric not null default 0,
  grand_total numeric not null default 0,
  status text,
  docstatus integer,
  source text,
  sales_person_raw text,
  sales_email text,
  uploaded_by text,
  uploaded_at timestamptz not null default pg_catalog.now(),
  created_at timestamptz not null default pg_catalog.now(),
  updated_at timestamptz not null default pg_catalog.now(),
  constraint sales_orders_so_number_unique unique (so_number),
  constraint sales_orders_email_lowercase check (sales_email is null or sales_email = lower(sales_email))
);

create index sales_orders_order_date_idx on public.sales_orders (order_date);
create index sales_orders_sales_email_idx on public.sales_orders (sales_email);

create trigger sales_orders_set_updated_at
before update on public.sales_orders
for each row execute function private.set_updated_at();

alter table public.sales_orders enable row level security;
alter table public.sales_orders force row level security;

revoke all on table public.sales_orders from anon, authenticated;
grant select, insert, update on table public.sales_orders to authenticated;

create policy sales_orders_select_scoped
on public.sales_orders
for select
to authenticated
using (
  private.current_user_is_super_admin()
  or (
    private.current_user_is_active_staff()
    and sales_email = lower(coalesce((select auth.jwt() ->> 'email'), ''))
  )
);

create policy sales_orders_insert_super_admin
on public.sales_orders
for insert
to authenticated
with check (private.current_user_is_super_admin());

create policy sales_orders_update_super_admin
on public.sales_orders
for update
to authenticated
using (private.current_user_is_super_admin())
with check (private.current_user_is_super_admin());
