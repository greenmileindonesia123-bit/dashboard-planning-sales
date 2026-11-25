-- PostgreSQL UTF-8 text does not permit chr(0) (SQLSTATE 54000: null character not permitted).
-- Remove pg_catalog.chr(0) calls from apply_shared_calendar_sync while keeping owner and grants.
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
    v_id = pg_catalog.btrim(coalesce(v_row ->> 'google_event_id', ''));
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
      pg_catalog.left(coalesce(v_row ->> 'title', ''), 500),
      v_start,
      v_end,
      v_all_day,
      nullif(pg_catalog.left(coalesce(v_row ->> 'location', ''), 500), ''),
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
