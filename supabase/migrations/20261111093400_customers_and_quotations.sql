-- Quotation requests and a private storage bucket.
-- Customer lists are assembled in the app from visit_reports and sales_orders,
-- so they follow the existing select policies. No sample rows.

create or replace function private.current_user_is_quotation_reviewer()
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
      and email = lower(coalesce((select auth.jwt() ->> 'email'), ''))
      and email in (
        'operasionalgreenmileindonesia@gmail.com',
        'estimatorgreenmileindonesia@gmail.com',
        'halogreenmile@gmail.com'
      )
  );
$$;

revoke all on function private.current_user_is_quotation_reviewer() from public, anon;
grant execute on function private.current_user_is_quotation_reviewer() to authenticated;

create table public.quotation_requests (
  id uuid primary key default gen_random_uuid(),
  request_number text not null,
  requested_at date not null,
  sales_email text not null,
  sales_name text not null,
  customer_name text not null,
  pic text,
  phone text,
  project_address text,
  project_name text not null,
  work_type text,
  target_date date,
  notes text,
  status text not null default 'Baru',
  quote_pdf_path text,
  created_at timestamptz not null default pg_catalog.now(),
  updated_at timestamptz not null default pg_catalog.now(),
  constraint quotation_requests_number_unique unique (request_number),
  constraint quotation_requests_email_lowercase check (sales_email = lower(sales_email)),
  constraint quotation_requests_status_check check (status in ('Baru', 'Diproses', 'Selesai', 'Batal'))
);

create table public.quotation_items (
  id uuid primary key default gen_random_uuid(),
  request_id uuid not null references public.quotation_requests (id) on delete cascade,
  line_no integer not null,
  description text not null,
  specification text,
  quantity numeric not null,
  unit text,
  constraint quotation_items_line_unique unique (request_id, line_no),
  constraint quotation_items_quantity_positive check (quantity > 0)
);

create table public.quotation_attachments (
  id uuid primary key default gen_random_uuid(),
  request_id uuid not null references public.quotation_requests (id) on delete cascade,
  storage_path text not null,
  file_name text not null,
  content_type text not null,
  created_at timestamptz not null default pg_catalog.now(),
  constraint quotation_attachments_path_unique unique (storage_path)
);

create index quotation_requests_sales_idx on public.quotation_requests (sales_email, requested_at desc);
create index quotation_items_request_idx on public.quotation_items (request_id, line_no);

create or replace function private.assign_quotation_number()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_year text := to_char(new.requested_at, 'YYYY');
  v_next integer;
begin
  new.sales_email := lower(btrim(new.sales_email));
  if new.request_number is null or btrim(new.request_number) = '' then
    perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtext('quotation-' || v_year));
    select coalesce(max(substring(request_number from 9)::integer), 0) + 1
      into v_next
    from public.quotation_requests
    where request_number like 'QR-' || v_year || '-%';
    new.request_number := 'QR-' || v_year || '-' || lpad(v_next::text, 4, '0');
  end if;
  return new;
end;
$$;

revoke all on function private.assign_quotation_number() from public, anon, authenticated;

create trigger quotation_requests_assign_number
before insert on public.quotation_requests
for each row execute function private.assign_quotation_number();

create trigger quotation_requests_set_updated_at
before update on public.quotation_requests
for each row execute function private.set_updated_at();

alter table public.quotation_requests enable row level security;
alter table public.quotation_requests force row level security;
alter table public.quotation_items enable row level security;
alter table public.quotation_items force row level security;
alter table public.quotation_attachments enable row level security;
alter table public.quotation_attachments force row level security;

revoke all on table public.quotation_requests from anon, authenticated;
revoke all on table public.quotation_items from anon, authenticated;
revoke all on table public.quotation_attachments from anon, authenticated;
grant select, insert, update on table public.quotation_requests to authenticated;
grant select, insert on table public.quotation_items to authenticated;
grant select, insert on table public.quotation_attachments to authenticated;

create policy quotation_requests_select_scoped
on public.quotation_requests
for select
to authenticated
using (
  private.current_user_is_quotation_reviewer()
  or (
    private.current_user_is_active_staff()
    and sales_email = lower(coalesce((select auth.jwt() ->> 'email'), ''))
  )
);

create policy quotation_requests_insert_own
on public.quotation_requests
for insert
to authenticated
with check (
  private.current_user_is_active_staff()
  and sales_email = lower(coalesce((select auth.jwt() ->> 'email'), ''))
);

create policy quotation_requests_update_reviewer
on public.quotation_requests
for update
to authenticated
using (private.current_user_is_quotation_reviewer())
with check (private.current_user_is_quotation_reviewer());

create policy quotation_items_select_scoped
on public.quotation_items
for select
to authenticated
using (
  exists (
    select 1 from public.quotation_requests as request
    where request.id = request_id
      and (
        private.current_user_is_quotation_reviewer()
        or request.sales_email = lower(coalesce((select auth.jwt() ->> 'email'), ''))
      )
  )
);

create policy quotation_items_insert_own
on public.quotation_items
for insert
to authenticated
with check (
  exists (
    select 1 from public.quotation_requests as request
    where request.id = request_id
      and (
        private.current_user_is_quotation_reviewer()
        or (
          private.current_user_is_active_staff()
          and request.sales_email = lower(coalesce((select auth.jwt() ->> 'email'), ''))
        )
      )
  )
);

create policy quotation_attachments_select_scoped
on public.quotation_attachments
for select
to authenticated
using (
  exists (
    select 1 from public.quotation_requests as request
    where request.id = request_id
      and (
        private.current_user_is_quotation_reviewer()
        or request.sales_email = lower(coalesce((select auth.jwt() ->> 'email'), ''))
      )
  )
);

create policy quotation_attachments_insert_scoped
on public.quotation_attachments
for insert
to authenticated
with check (
  exists (
    select 1 from public.quotation_requests as request
    where request.id = request_id
      and (
        private.current_user_is_quotation_reviewer()
        or (
          private.current_user_is_active_staff()
          and request.sales_email = lower(coalesce((select auth.jwt() ->> 'email'), ''))
        )
      )
  )
);

insert into storage.buckets (id, name, public, file_size_limit)
values ('quotations', 'quotations', false, 20971520)
on conflict (id) do update set public = false, file_size_limit = 20971520;

create policy quotations_reviewer_select
on storage.objects
for select
to authenticated
using (
  bucket_id = 'quotations'
  and private.current_user_is_quotation_reviewer()
);

create policy quotations_owner_select
on storage.objects
for select
to authenticated
using (
  bucket_id = 'quotations'
  and private.current_user_is_active_staff()
  and exists (
    select 1
    from public.quotation_requests as request
    where request.id::text = (storage.foldername(name))[1]
      and request.sales_email = lower(coalesce((select auth.jwt() ->> 'email'), ''))
  )
);

create policy quotations_reviewer_insert
on storage.objects
for insert
to authenticated
with check (
  bucket_id = 'quotations'
  and private.current_user_is_quotation_reviewer()
);

create policy quotations_reviewer_update
on storage.objects
for update
to authenticated
using (
  bucket_id = 'quotations'
  and private.current_user_is_quotation_reviewer()
)
with check (
  bucket_id = 'quotations'
  and private.current_user_is_quotation_reviewer()
);

create policy quotations_owner_lampiran_insert
on storage.objects
for insert
to authenticated
with check (
  bucket_id = 'quotations'
  and private.current_user_is_active_staff()
  and (storage.foldername(name))[2] = 'lampiran'
  and exists (
    select 1
    from public.quotation_requests as request
    where request.id::text = (storage.foldername(name))[1]
      and request.sales_email = lower(coalesce((select auth.jwt() ->> 'email'), ''))
  )
);
