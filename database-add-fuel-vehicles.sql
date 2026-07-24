begin;

alter table public.trip_fuel
  add column if not exists vehicle_id uuid;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'trip_fuel_vehicle_id_fkey'
      and conrelid = 'public.trip_fuel'::regclass
  ) then
    alter table public.trip_fuel
      add constraint trip_fuel_vehicle_id_fkey
      foreign key (vehicle_id)
      references public.vehicles(id)
      on update cascade
      on delete set null;
  end if;
end
$$;

create index if not exists idx_trip_fuel_vehicle_id
  on public.trip_fuel(vehicle_id);

update public.vehicles
set household_id = (
  select household_id
  from public.vehicles
  where name = 'Ruby'
  limit 1
)
where household_id is null;

update public.trip_fuel fuel
set
  vehicle_id = trip.tow_vehicle_id,
  fuel_type = vehicle.fuel_type,
  updated_at = now()
from public.trips trip
join public.vehicles vehicle on vehicle.id = trip.tow_vehicle_id
where fuel.trip_id = trip.id;

commit;

select
  vehicle.name as vehicle,
  fuel.fuel_type,
  count(*) as fuel_stops,
  min(fuel.fuel_date) as first_stop,
  max(fuel.fuel_date) as latest_stop
from public.trip_fuel fuel
join public.vehicles vehicle on vehicle.id = fuel.vehicle_id
group by vehicle.name, fuel.fuel_type
order by min(fuel.fuel_date);
