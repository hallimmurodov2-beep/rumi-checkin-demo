-- Run against a disposable database with the application schema and migration applied.
begin;
do $$
declare
  d uuid;
  r uuid;
  h public.tablet_handoffs;
  secret text := gen_random_uuid()::text;
  c uuid;
  payload jsonb;
begin
  insert into public.devices(name, paired_at) values ('Fixture tablet',now()) returning id into d;
  insert into public.device_secrets values (d,public.hash_secret(secret));
  insert into public.reservations(booking_ref,guest_name,arrival_date,departure_date,status)
    values (gen_random_uuid()::text,'Fictional guest',current_date,current_date+1,'expected') returning id into r;
  h := public.create_handoff(r,d,null,'en','partner');
  payload := jsonb_build_object('handoff_id',h.id,'signature_png',repeat('x',101));
  c := (public.submit_checkin(secret,r,payload)->>'id')::uuid;
  if public.decide_checkin(c,true,'517',null) <> 'ok' then raise exception 'approval failed'; end if;
  if (select status from public.reservations where id=r) <> 'expected' then
    raise exception 'paperwork changed the desk booking';
  end if;
  update public.reservations set status='in_house' where id=r;
  h := public.create_handoff(r,d,null,'en','partner');
  if (public.tablet_poll(secret)->>'id')::uuid is distinct from h.id then raise exception 'missing in-house form'; end if;
  update public.reservations set status='checked_out' where id=r;
  begin
    perform public.submit_checkin(secret,r,jsonb_set(payload,'{handoff_id}',to_jsonb(h.id)));
    raise exception 'late signature accepted';
  exception when raise_exception then
    if sqlerrm <> 'reservation_unavailable' then raise; end if;
  end;
  if public.decide_checkin(c,true,'517',null) <> 'stay_closed' then raise exception 'late approval accepted'; end if;
  if (select status from public.reservations where id=r) <> 'checked_out' then raise exception 'departure reversed'; end if;
end $$;
rollback;
