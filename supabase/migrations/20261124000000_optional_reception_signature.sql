create or replace function public.create_handoff(p_reservation_id uuid, p_device_id uuid, p_passport jsonb, p_language text, p_source text)
returns public.tablet_handoffs
language plpgsql security definer set search_path = '' as $$
declare v_r public.reservations; v_h public.tablet_handoffs; v_lang text;
begin
  select * into v_r from public.reservations where id = p_reservation_id for update;
  if v_r.id is null then raise exception 'reservation_not_found' using errcode = 'P0001'; end if;
  if v_r.status <> 'expected' and not (v_r.status = 'in_house' and p_source is not distinct from 'partner') then raise exception 'reservation_not_expected' using errcode = 'P0001'; end if;
  if not exists (select 1 from public.devices where id = p_device_id and not revoked and paired_at is not null) then
    raise exception 'tablet_not_found' using errcode = 'P0001';
  end if;
  v_lang := coalesce(nullif(p_language, ''), public.language_for_nationality(p_passport ->> 'nationality'));
  update public.tablet_handoffs set status = 'cancelled' where device_id = p_device_id and status in ('pending', 'shown');
  insert into public.tablet_handoffs (device_id, reservation_id, language, passport, source)
  values (p_device_id, v_r.id, v_lang, p_passport, coalesce(p_source, 'partner'))
  returning * into v_h;
  return v_h;
end $$;

create or replace function public.tablet_poll(p_secret text) returns json
language plpgsql security definer set search_path = '' as $$
declare v_dev uuid := public.device_from_secret(p_secret); v_h public.tablet_handoffs; v_r public.reservations;
begin
  select * into v_h from public.tablet_handoffs
  where device_id = v_dev and status = 'pending' and expires_at > now()
  order by created_at desc limit 1 for update skip locked;
  if v_h.id is null then return null; end if;
  select * into v_r from public.reservations where id = v_h.reservation_id;
  if v_r.id is null or (v_r.status <> 'expected' and not (v_r.status = 'in_house' and v_h.source = 'partner')) then
    update public.tablet_handoffs set status = 'cancelled' where id = v_h.id;
    return null;
  end if;
  update public.tablet_handoffs set status = 'shown' where id = v_h.id;
  update public.tablet_handoffs set status = 'cancelled' where device_id = v_dev and status = 'pending' and id <> v_h.id;
  return json_build_object('id', v_h.id, 'language', v_h.language, 'passport', v_h.passport, 'reservation', public.reservation_public(v_r));
end $$;

create or replace function public.submit_checkin(p_secret text, p_reservation_id uuid, p jsonb)
 returns json language plpgsql security definer set search_path to '' as $function$
declare
  v_dev uuid := public.device_from_secret(p_secret);
  v_r public.reservations;
  v_id uuid;
  v_code text := public.new_desk_code();
  v_h public.tablet_handoffs;
  v_pp jsonb;
  v_src text;
  v_policy uuid;
  g jsonb;
begin
  select * into v_r from public.reservations where id = p_reservation_id for update;
  if v_r.id is null or v_r.status not in ('expected', 'in_house') then raise exception 'reservation_unavailable' using errcode = 'P0001'; end if;
  if coalesce(length(p ->> 'signature_png'), 0) < 100 then raise exception 'signature_required' using errcode = 'P0001'; end if;
  if jsonb_array_length(coalesce(p -> 'companions', '[]'::jsonb)) > 9 then raise exception 'too_many_guests' using errcode = 'P0001'; end if;

  if nullif(p ->> 'handoff_id', '') is not null then
    select * into v_h from public.tablet_handoffs
    where id = (p ->> 'handoff_id')::uuid and device_id = v_dev and reservation_id = v_r.id and status in ('pending', 'shown') and expires_at > now() for update;
    if not found then raise exception 'reservation_unavailable'; end if;
  end if;
  if v_r.status = 'in_house' and v_h.source is distinct from 'partner' then
    raise exception 'reservation_unavailable';
  end if;
  v_pp := case when v_h.id is not null and v_h.passport is not null then v_h.passport else p end;
  v_src := case when v_h.id is not null and v_h.passport is not null then 'desk' else coalesce(nullif(p ->> 'doc_source', ''), 'none') end;
  if nullif(p ->> 'policy_id', '') is not null then
    select id into v_policy from public.hotel_policies where id = (p ->> 'policy_id')::uuid;
  end if;

  insert into public.checkins (
    reservation_id, device_id, language, doc_source, doc_type, issuing_country, nationality,
    surname, given_names, document_number, birth_date, sex, expiry_date, mrz_valid,
    phone, email, shuttle, consent_at, signature_png, desk_code, handoff_id, policy_id
  ) values (
    v_r.id, v_dev,
    coalesce(nullif(p ->> 'language', ''), 'en'),
    v_src,
    left(nullif(v_pp ->> 'doc_type', ''), 4),
    left(nullif(v_pp ->> 'issuing_country', ''), 3),
    left(nullif(v_pp ->> 'nationality', ''), 3),
    left(nullif(v_pp ->> 'surname', ''), 80),
    left(nullif(v_pp ->> 'given_names', ''), 120),
    left(nullif(v_pp ->> 'document_number', ''), 20),
    nullif(v_pp ->> 'birth_date', '')::date,
    case when v_pp ->> 'sex' in ('M', 'F', 'X') then v_pp ->> 'sex' end,
    nullif(v_pp ->> 'expiry_date', '')::date,
    case when v_src = 'desk' then null else (p ->> 'mrz_valid')::boolean end,
    nullif(trim(p ->> 'phone'), ''),
    nullif(lower(trim(p ->> 'email')), ''),
    coalesce((p ->> 'shuttle')::boolean, false),
    now(),
    p ->> 'signature_png',
    v_code,
    v_h.id,
    v_policy
  ) returning id into v_id;

  for g in select * from jsonb_array_elements(coalesce(p -> 'companions', '[]'::jsonb)) loop
    insert into public.checkin_guests (checkin_id, doc_type, issuing_country, nationality, surname, given_names,
      document_number, birth_date, sex, expiry_date, mrz_valid)
    values (v_id, nullif(g ->> 'doc_type', ''), nullif(g ->> 'issuing_country', ''), nullif(g ->> 'nationality', ''),
      nullif(g ->> 'surname', ''), nullif(g ->> 'given_names', ''), nullif(g ->> 'document_number', ''),
      nullif(g ->> 'birth_date', '')::date, nullif(g ->> 'sex', ''), nullif(g ->> 'expiry_date', '')::date,
      (g ->> 'mrz_valid')::boolean);
  end loop;

  if v_h.id is not null then
    update public.tablet_handoffs set status = 'completed', checkin_id = v_id where id = v_h.id;
  end if;
  -- A partner handoff collects paperwork for a stay managed by Rumi Reception.
  if v_h.source is distinct from 'partner' then
    update public.reservations set status = 'pending_desk' where id = v_r.id;
  end if;
  return json_build_object('id', v_id, 'desk_code', v_code);
end $function$;

-- Serialize a desk decision with checkout on the reservation row. Both writes commit together.
create or replace function public.decide_checkin(p_id uuid, p_approve boolean, p_room text, p_actor uuid)
returns text language plpgsql security definer set search_path = '' as $$
declare
  r public.reservations;
  c public.checkins;
begin
  select * into r from public.reservations where id =
    (select reservation_id from public.checkins where id = p_id) for update;
  if not found then return 'not_found'; end if;
  if r.status in ('checked_out', 'cancelled', 'no_show') then return 'stay_closed'; end if;
  select * into c from public.checkins where id = p_id for update;
  if not found then return 'not_found'; end if;
  if c.status <> 'waiting' then return 'already_handled'; end if;
  if p_approve then
    if nullif(trim(p_room), '') is null then return 'room_required'; end if;
    update public.checkins set status = 'approved', approved_at = now(), approved_by = p_actor where id = p_id;
    if exists (select 1 from public.tablet_handoffs where id = c.handoff_id and source = 'partner') then
      -- Reception owns stay status. Approval acknowledges the guest's paperwork only.
      update public.reservations set room_number = left(trim(p_room), 10)
        where id = r.id and room_number is null;
    else
      update public.reservations set status = 'in_house', room_number = left(trim(p_room), 10) where id = r.id;
    end if;
  else
    update public.checkins set status = 'rejected' where id = p_id;
    update public.reservations set status = 'expected' where id = r.id and status = 'pending_desk';
  end if;
  return 'ok';
end $$;
revoke all on function public.decide_checkin(uuid,boolean,text,uuid) from public, anon, authenticated;
grant execute on function public.decide_checkin(uuid,boolean,text,uuid) to service_role;

create or replace function public.close_stay_paperwork() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  update public.checkins set status = 'rejected' where reservation_id = new.id and status = 'waiting';
  update public.tablet_handoffs set status = 'cancelled' where reservation_id = new.id and status in ('pending','shown');
  return new;
end $$;
revoke all on function public.close_stay_paperwork() from public, anon, authenticated;
create trigger close_stay_paperwork after update of status on public.reservations for each row
  when (new.status in ('checked_out','cancelled','no_show') and old.status is distinct from new.status)
  execute function public.close_stay_paperwork();

create or replace function public.approve_checkin(p_checkin_id uuid, p_room_number text) returns void
language plpgsql security definer set search_path = '' as $$
declare result text;
begin
  if not public.is_staff() then raise exception 'not_allowed' using errcode = '42501'; end if;
  result := public.decide_checkin(p_checkin_id, true, p_room_number, auth.uid());
  if result = 'room_required' then raise exception 'room_required'; end if;
  if result <> 'ok' then raise exception 'checkin_unavailable'; end if;
end $$;

create or replace function public.reject_checkin(p_checkin_id uuid) returns void
language plpgsql security definer set search_path = '' as $$
declare result text;
begin
  if not public.is_staff() then raise exception 'not_allowed' using errcode = '42501'; end if;
  result := public.decide_checkin(p_checkin_id, false, null, auth.uid());
  if result = 'room_required' then raise exception 'room_required'; end if;
  if result <> 'ok' then raise exception 'checkin_unavailable'; end if;
end $$;


create or replace function public.tablet_checkin_info(p_secret text, p_checkin_id uuid)
 returns json language plpgsql security definer set search_path to '' as $function$
declare v_dev uuid := public.device_from_secret(p_secret); v_c public.checkins; v_r public.reservations;
begin
  select * into v_c from public.checkins where id = p_checkin_id and device_id = v_dev and created_at > now() - interval '30 minutes';
  if v_c.id is null then return null; end if;
  select * into v_r from public.reservations where id = v_c.reservation_id;
  if v_r.status in ('checked_out','cancelled','no_show') then
    return json_build_object('status','rejected','room_number',null,'wifi',null);
  end if;
  return json_build_object('status', v_c.status, 'room_number', v_r.room_number, 'wifi', public.tablet_wifi(p_secret, p_checkin_id));
end $function$;
