-- Pull the shared public calendar "Kunjungan sales" into calendar_events.
-- Rows are keyed by google_event_id for source = shared_calendar, including
-- recurrence instances (uid::instant). sales_email may be null when the event
-- cannot be mapped to Data Sales; those rows stay invisible to sales.
-- Apply this in the Supabase SQL editor. Do not run it from the app.

alter table public.calendar_events
  add column source text not null default 'ics_upload',
  add column sales_profile_id uuid references public.sales_profiles (id) on delete set null;

alter table public.calendar_events
  alter column sales_email drop not null;

alter table public.calendar_events
  drop constraint calendar_events_identity_unique;

alter table public.calendar_events
  add constraint calendar_events_identity_unique
  unique (source, sales_email, google_event_id);

alter table public.calendar_events
  add constraint calendar_events_source_check
  check (source in ('ics_upload', 'shared_calendar'));

comment on table public.calendar_events is
  'Calendar rows per sales. ics_upload comes from an uploaded .ics file. shared_calendar comes from the Kunjungan sales public feed and is unique per google_event_id. Null sales_email means the shared event is not mapped to a salesperson.';

comment on column public.calendar_events.source is
  'ics_upload or shared_calendar.';

comment on column public.calendar_events.sales_profile_id is
  'Data Sales row that owns the event. Null together with sales_email means Belum dipetakan.';

comment on column public.calendar_events.sales_email is
  'Lowercase Google email from sales_profiles. Null when a shared event has no owner, or the owner has no email.';

create index calendar_events_sales_profile_id_idx
  on public.calendar_events (sales_profile_id);

create unique index calendar_events_shared_uid_key
  on public.calendar_events (google_event_id)
  where source = 'shared_calendar';

create index calendar_events_shared_range_idx
  on public.calendar_events (starts_at, ends_at)
  where source = 'shared_calendar';

create or replace function private.normalize_calendar_email()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.sales_email is not null then
    new.sales_email = lower(pg_catalog.btrim(new.sales_email));
    if new.sales_email = '' then
      new.sales_email = null;
    end if;
  end if;
  return new;
end;
$$;

revoke all on function private.normalize_calendar_email() from public, anon, authenticated;

drop policy if exists calendar_events_insert_scoped on public.calendar_events;
create policy calendar_events_insert_scoped
on public.calendar_events
for insert
to authenticated
with check (
  (select private.current_user_is_super_admin())
  or (
    (select private.current_user_is_active_staff())
    and sales_email = lower(coalesce((select auth.jwt() ->> 'email'), ''))
    and source = 'ics_upload'
  )
);

drop policy if exists calendar_events_update_scoped on public.calendar_events;
create policy calendar_events_update_scoped
on public.calendar_events
for update
to authenticated
using (
  (select private.current_user_is_super_admin())
  or (
    (select private.current_user_is_active_staff())
    and sales_email = lower(coalesce((select auth.jwt() ->> 'email'), ''))
    and source = 'ics_upload'
  )
)
with check (
  (select private.current_user_is_super_admin())
  or (
    (select private.current_user_is_active_staff())
    and sales_email = lower(coalesce((select auth.jwt() ->> 'email'), ''))
    and source = 'ics_upload'
  )
);

grant delete on table public.calendar_events to authenticated;

drop policy if exists calendar_events_delete_shared on public.calendar_events;
create policy calendar_events_delete_shared
on public.calendar_events
for delete
to authenticated
using (
  (select private.current_user_is_super_admin())
  and source = 'shared_calendar'
);

-- One transaction for the UID upsert and the in-window delete.
-- PostgREST cannot target the partial unique index, so the write goes through
-- this security definer function. The call still uses the signed-in JWT and
-- refuses anyone who is not private.current_user_is_super_admin().
-- No service role key is used.
create or replace function public.apply_shared_calendar_sync(
  p_upserts jsonb,
  p_delete_ids uuid[]
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_row jsonb;
  v_profile uuid;
  v_email text;
  v_id text;
  v_status text;
  v_start timestamptz;
  v_end timestamptz;
  v_link text;
  v_all_day boolean;
  v_count integer;
  v_index integer;
  v_events jsonb := coalesce(p_upserts, '[]'::jsonb);
begin
  if coalesce(private.current_user_is_super_admin(), false) is not true then
    raise exception 'Tarik jadwal kalender hanya untuk Super Admin.' using errcode = '42501';
  end if;

  if pg_catalog.jsonb_typeof(v_events) <> 'array' then
    raise exception 'Daftar acara tidak valid.';
  end if;
  v_count := pg_catalog.jsonb_array_length(v_events);
  if v_count > 2000 then
    raise exception 'Terlalu banyak acara untuk disimpan sekaligus.';
  end if;
  if coalesce(pg_catalog.cardinality(p_delete_ids), 0) > 5000 then
    raise exception 'Terlalu banyak acara untuk dihapus sekaligus.';
  end if;

  for v_index in 0 .. v_count - 1 loop
    v_row := v_events -> v_index;
    v_id = pg_catalog.replace(pg_catalog.btrim(coalesce(v_row ->> 'google_event_id', '')), pg_catalog.chr(0), '');
    if v_id = '' or pg_catalog.char_length(v_id) > 512 then
      raise exception 'UID acara tidak valid.';
    end if;

    v_status = pg_catalog.lower(pg_catalog.btrim(coalesce(v_row ->> 'status', 'confirmed')));
    if v_status not in ('confirmed', 'tentative', 'cancelled') then
      raise exception 'Status acara tidak valid.';
    end if;

    begin
      v_start = (v_row ->> 'starts_at')::timestamptz;
      v_end = (v_row ->> 'ends_at')::timestamptz;
    exception
      when others then
        raise exception 'Waktu acara tidak valid.';
    end;
    if v_start is null or v_end is null or v_end < v_start then
      raise exception 'Waktu acara tidak valid.';
    end if;

    if nullif(pg_catalog.btrim(coalesce(v_row ->> 'sales_profile_id', '')), '') is null then
      v_profile = null;
      v_email = null;
    else
      begin
        v_profile = (v_row ->> 'sales_profile_id')::uuid;
      exception
        when invalid_text_representation then
          raise exception 'Sales pemilik acara tidak valid.';
      end;
      select sp.email
        into v_email
      from public.sales_profiles as sp
      where sp.id = v_profile;
      if not found then
        raise exception 'Sales pemilik acara tidak ada di Data Sales.';
      end if;
    end if;

    v_link = nullif(pg_catalog.btrim(coalesce(v_row ->> 'html_link', '')), '');
    if v_link is not null and v_link !~* '^https?://' then
      v_link = null;
    end if;

    v_all_day = pg_catalog.lower(coalesce(v_row ->> 'all_day', 'false')) in ('true', 't', '1');

    insert into public.calendar_events (
      sales_email,
      sales_profile_id,
      google_event_id,
      title,
      starts_at,
      ends_at,
      all_day,
      location,
      html_link,
      status,
      source
    ) values (
      v_email,
      v_profile,
      v_id,
      pg_catalog.left(pg_catalog.replace(coalesce(v_row ->> 'title', ''), pg_catalog.chr(0), ''), 500),
      v_start,
      v_end,
      v_all_day,
      nullif(pg_catalog.left(pg_catalog.replace(coalesce(v_row ->> 'location', ''), pg_catalog.chr(0), ''), 500), ''),
      v_link,
      v_status,
      'shared_calendar'
    )
    on conflict (google_event_id) where source = 'shared_calendar'
    do update set
      sales_email = excluded.sales_email,
      sales_profile_id = excluded.sales_profile_id,
      title = excluded.title,
      starts_at = excluded.starts_at,
      ends_at = excluded.ends_at,
      all_day = excluded.all_day,
      location = excluded.location,
      html_link = excluded.html_link,
      status = excluded.status;
  end loop;

  delete from public.calendar_events as event
  where event.source = 'shared_calendar'
    and event.id = any (coalesce(p_delete_ids, '{}'::uuid[]));
end;
$$;

comment on function public.apply_shared_calendar_sync(jsonb, uuid[]) is
  'Super Admin sync of the shared public calendar. Upserts by google_event_id and deletes shared rows whose ids are passed in.';

alter function public.apply_shared_calendar_sync(jsonb, uuid[]) owner to postgres;

revoke all on function public.apply_shared_calendar_sync(jsonb, uuid[]) from public, anon, authenticated;
grant execute on function public.apply_shared_calendar_sync(jsonb, uuid[]) to authenticated;
