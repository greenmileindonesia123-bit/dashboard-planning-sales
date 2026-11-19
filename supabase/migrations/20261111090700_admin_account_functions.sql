-- Super Admin account management without the service role key.
-- Each function refuses callers who are not private.current_user_is_super_admin().
-- Direct inserts into auth.users do not send mail.
-- Apply this in the Supabase SQL editor. Do not run it from the app.

create or replace function public.admin_list_accounts()
returns table (
  id uuid,
  profile_id uuid,
  email text,
  name text,
  team text,
  status text,
  last_sign_in_at timestamptz,
  banned boolean
)
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if coalesce(private.current_user_is_super_admin(), false) is not true then
    raise exception 'Menu ini hanya untuk Super Admin.' using errcode = '42501';
  end if;

  return query
  select
    listed.id,
    listed.profile_id,
    listed.email,
    listed.name,
    listed.team,
    listed.status,
    listed.last_sign_in_at,
    listed.banned
  from (
    select
      u.id,
      p.id as profile_id,
      lower(u.email)::text as email,
      coalesce(p.name, 'Tanpa nama di Data Sales')::text as name,
      p.team::text as team,
      case
        when u.banned_until is not null and u.banned_until > pg_catalog.now() then 'Nonaktif'
        when p.status = 'Aktif' then 'Aktif'
        else 'Nonaktif'
      end::text as status,
      u.last_sign_in_at,
      (u.banned_until is not null and u.banned_until > pg_catalog.now()) as banned,
      p.roster_order
    from auth.users as u
    left join lateral (
      select sp.id, sp.name, sp.team, sp.status, sp.roster_order
      from public.sales_profiles as sp
      where sp.auth_user_id = u.id
         or (
           sp.email is not null
           and lower(sp.email) = lower(u.email)
         )
      order by case when sp.auth_user_id = u.id then 0 else 1 end, sp.roster_order
      limit 1
    ) as p on true
    where u.email is not null
      and u.deleted_at is null
      and coalesce(u.is_anonymous, false) = false

    union all

    select
      null::uuid as id,
      sp.id as profile_id,
      lower(sp.email)::text as email,
      sp.name::text as name,
      sp.team::text as team,
      case when sp.status = 'Aktif' then 'Aktif' else 'Nonaktif' end::text as status,
      null::timestamptz as last_sign_in_at,
      false as banned,
      sp.roster_order
    from public.sales_profiles as sp
    where sp.email is not null
      and not exists (
        select 1
        from auth.users as u
        where u.deleted_at is null
          and (
            u.id = sp.auth_user_id
            or lower(u.email) = lower(sp.email)
          )
      )
  ) as listed
  order by listed.roster_order nulls last, listed.email;
end;
$$;

create or replace function public.admin_create_account(
  p_email text,
  p_name text,
  p_team text,
  p_password text
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_email text := lower(btrim(coalesce(p_email, '')));
  v_name text := btrim(coalesce(p_name, ''));
  v_team text := btrim(coalesce(p_team, ''));
  v_user_id uuid := pg_catalog.gen_random_uuid();
  v_order integer;
  v_constraint text;
begin
  if coalesce(private.current_user_is_super_admin(), false) is not true then
    raise exception 'Menu ini hanya untuk Super Admin.' using errcode = '42501';
  end if;

  if v_email !~ '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$' or char_length(v_email) > 254 then
    raise exception 'Masukkan email yang valid.';
  end if;
  if v_name = '' or char_length(v_name) > 80 or v_name ~ '[<>[:cntrl:]]' then
    raise exception 'Masukkan nama pemakai.';
  end if;
  if v_team not in ('Sales', 'PPIC') then
    raise exception 'Pilih tim Sales atau PPIC.';
  end if;
  if p_password is null or char_length(p_password) < 8 or char_length(p_password) > 72 then
    raise exception 'Kata sandi sementara minimal 8 karakter.';
  end if;
  if exists (select 1 from auth.users where lower(email) = v_email and deleted_at is null)
     or exists (select 1 from public.sales_profiles where email = v_email) then
    raise exception 'Email ini sudah ada di Data Sales.';
  end if;
  if exists (select 1 from public.sales_profiles where name = v_name) then
    raise exception 'Nama pemakai sudah dipakai.';
  end if;

  select coalesce(max(roster_order), 0) + 1 into v_order from public.sales_profiles;

  insert into auth.users (
    instance_id,
    id,
    aud,
    role,
    email,
    encrypted_password,
    email_confirmed_at,
    confirmation_token,
    recovery_token,
    email_change_token_new,
    email_change,
    email_change_token_current,
    email_change_confirm_status,
    phone_change,
    phone_change_token,
    reauthentication_token,
    raw_app_meta_data,
    raw_user_meta_data,
    created_at,
    updated_at,
    is_sso_user,
    is_anonymous
  ) values (
    '00000000-0000-0000-0000-000000000000',
    v_user_id,
    'authenticated',
    'authenticated',
    v_email,
    extensions.crypt(p_password, extensions.gen_salt('bf')),
    pg_catalog.now(),
    '',
    '',
    '',
    '',
    '',
    0,
    '',
    '',
    '',
    jsonb_build_object('provider', 'email', 'providers', jsonb_build_array('email'), 'team', v_team),
    jsonb_build_object('name', v_name),
    pg_catalog.now(),
    pg_catalog.now(),
    false,
    false
  );

  insert into auth.identities (
    id,
    provider_id,
    user_id,
    identity_data,
    provider,
    last_sign_in_at,
    created_at,
    updated_at
  ) values (
    pg_catalog.gen_random_uuid(),
    v_user_id::text,
    v_user_id,
    jsonb_build_object('sub', v_user_id::text, 'email', v_email, 'email_verified', true),
    'email',
    null,
    pg_catalog.now(),
    pg_catalog.now()
  );

  insert into public.sales_profiles (
    roster_order,
    name,
    email,
    area,
    team,
    status,
    auth_user_id
  ) values (
    v_order,
    v_name,
    v_email,
    'surabaya',
    v_team,
    'Aktif',
    v_user_id
  );

  return v_user_id;
exception
  when unique_violation then
    get stacked diagnostics v_constraint = constraint_name;
    if v_constraint = 'sales_profiles_name_unique' then
      raise exception 'Nama pemakai sudah dipakai.';
    end if;
    raise exception 'Email ini sudah ada di Data Sales.';
end;
$$;

create or replace function public.admin_update_account(
  p_user_id uuid,
  p_name text,
  p_team text
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_name text := btrim(coalesce(p_name, ''));
  v_team text := btrim(coalesce(p_team, ''));
  v_email text;
  v_updated integer;
  v_constraint text;
begin
  if coalesce(private.current_user_is_super_admin(), false) is not true then
    raise exception 'Menu ini hanya untuk Super Admin.' using errcode = '42501';
  end if;
  if v_name = '' or char_length(v_name) > 80 or v_name ~ '[<>[:cntrl:]]' then
    raise exception 'Masukkan nama pemakai.';
  end if;
  if v_team not in ('Sales', 'PPIC') then
    raise exception 'Pilih tim Sales atau PPIC.';
  end if;

  select lower(email) into v_email
  from auth.users
  where id = p_user_id
    and deleted_at is null;
  if v_email is null then
    raise exception 'Akun tidak ditemukan.';
  end if;

  update public.sales_profiles
     set name = v_name,
         team = v_team
   where auth_user_id = p_user_id
      or email = v_email;
  get diagnostics v_updated = row_count;
  if v_updated = 0 then
    raise exception 'Baris Data Sales tidak ditemukan.';
  end if;

  update auth.users
     set raw_app_meta_data = coalesce(raw_app_meta_data, '{}'::jsonb) || jsonb_build_object('team', v_team),
         raw_user_meta_data = coalesce(raw_user_meta_data, '{}'::jsonb) || jsonb_build_object('name', v_name),
         updated_at = pg_catalog.now()
   where id = p_user_id;
exception
  when unique_violation then
    get stacked diagnostics v_constraint = constraint_name;
    if v_constraint = 'sales_profiles_name_unique' then
      raise exception 'Nama pemakai sudah dipakai.';
    end if;
    raise;
end;
$$;

create or replace function public.admin_reset_password(
  p_user_id uuid,
  p_password text
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_updated integer;
begin
  if coalesce(private.current_user_is_super_admin(), false) is not true then
    raise exception 'Menu ini hanya untuk Super Admin.' using errcode = '42501';
  end if;
  if p_password is null or char_length(p_password) < 8 or char_length(p_password) > 72 then
    raise exception 'Kata sandi sementara minimal 8 karakter.';
  end if;

  update auth.users
     set encrypted_password = extensions.crypt(p_password, extensions.gen_salt('bf')),
         updated_at = pg_catalog.now()
   where id = p_user_id
     and deleted_at is null;
  get diagnostics v_updated = row_count;
  if v_updated = 0 then
    raise exception 'Akun Auth untuk email ini belum ada.';
  end if;
end;
$$;

create or replace function public.admin_set_active(
  p_user_id uuid,
  p_active boolean
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_email text;
  v_actor text := lower(coalesce((select auth.jwt() ->> 'email'), ''));
begin
  if coalesce(private.current_user_is_super_admin(), false) is not true then
    raise exception 'Menu ini hanya untuk Super Admin.' using errcode = '42501';
  end if;

  select lower(email) into v_email
  from auth.users
  where id = p_user_id
    and deleted_at is null;
  if v_email is null then
    raise exception 'Akun tidak ditemukan.';
  end if;

  if p_active is not true and (p_user_id = (select auth.uid()) or v_email = v_actor) then
    raise exception 'Super Admin tidak dapat menonaktifkan akunnya sendiri.';
  end if;

  if p_active is true then
    update auth.users
       set banned_until = null,
           updated_at = pg_catalog.now()
     where id = p_user_id;
    update public.sales_profiles
       set status = 'Aktif'
     where auth_user_id = p_user_id
        or email = v_email;
  else
    update auth.users
       set banned_until = 'infinity',
           updated_at = pg_catalog.now()
     where id = p_user_id;
    delete from auth.refresh_tokens
     where user_id = p_user_id::text;
    delete from auth.sessions
     where user_id = p_user_id;
    update public.sales_profiles
       set status = 'Nonaktif'
     where auth_user_id = p_user_id
        or email = v_email;
  end if;
end;
$$;

alter function public.admin_list_accounts() owner to postgres;
alter function public.admin_create_account(text, text, text, text) owner to postgres;
alter function public.admin_update_account(uuid, text, text) owner to postgres;
alter function public.admin_reset_password(uuid, text) owner to postgres;
alter function public.admin_set_active(uuid, boolean) owner to postgres;

revoke all on function public.admin_list_accounts() from public, anon, authenticated;
revoke all on function public.admin_create_account(text, text, text, text) from public, anon, authenticated;
revoke all on function public.admin_update_account(uuid, text, text) from public, anon, authenticated;
revoke all on function public.admin_reset_password(uuid, text) from public, anon, authenticated;
revoke all on function public.admin_set_active(uuid, boolean) from public, anon, authenticated;

grant execute on function public.admin_list_accounts() to authenticated;
grant execute on function public.admin_create_account(text, text, text, text) to authenticated;
grant execute on function public.admin_update_account(uuid, text, text) to authenticated;
grant execute on function public.admin_reset_password(uuid, text) to authenticated;
grant execute on function public.admin_set_active(uuid, boolean) to authenticated;
