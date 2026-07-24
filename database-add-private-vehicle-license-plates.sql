begin;

alter table public.vehicle_private_details
  add column if not exists license_plate text;

commit;
