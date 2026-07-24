-- Phillis & Ruby Travel Journal
-- Allow fuel stops for everyday Ruby driving without creating a fake trip.
-- Safe to run more than once.

begin;

alter table public.trip_fuel
  add column if not exists household_id uuid;

update public.trip_fuel fuel
set household_id = trip.household_id
from public.trips trip
where fuel.trip_id = trip.id
  and fuel.household_id is null;

update public.trip_fuel fuel
set household_id = vehicle.household_id
from public.vehicles vehicle
where fuel.vehicle_id = vehicle.id
  and fuel.household_id is null;

do $$
begin
  if exists (
    select 1
    from public.trip_fuel
    where household_id is null
  ) then
    raise exception 'Every fuel stop must be connected to a household before enabling everyday fuel.';
  end if;
end
$$;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'trip_fuel_household_id_fkey'
      and conrelid = 'public.trip_fuel'::regclass
  ) then
    alter table public.trip_fuel
      add constraint trip_fuel_household_id_fkey
      foreign key (household_id)
      references public.households(id)
      on update cascade
      on delete cascade;
  end if;
end
$$;

alter table public.trip_fuel
  alter column household_id set not null,
  alter column trip_id drop not null;

create index if not exists idx_trip_fuel_household_id
  on public.trip_fuel(household_id);

-- Replace the old trip-dependent rules with household rules so a fuel stop
-- remains private even when it is not attached to a trip.
do $$
declare
  policy_record record;
begin
  for policy_record in
    select policyname
    from pg_policies
    where schemaname = 'public'
      and tablename = 'trip_fuel'
  loop
    execute format(
      'drop policy if exists %I on public.trip_fuel',
      policy_record.policyname
    );
  end loop;
end
$$;

create policy "Owners and editors can view fuel stops"
on public.trip_fuel
for select
to authenticated
using (
  exists (
    select 1
    from public.household_members member
    where member.household_id = trip_fuel.household_id
      and member.user_id = auth.uid()
      and member.role in ('owner', 'editor')
  )
);

create policy "Owners and editors can add fuel stops"
on public.trip_fuel
for insert
to authenticated
with check (
  exists (
    select 1
    from public.household_members member
    where member.household_id = trip_fuel.household_id
      and member.user_id = auth.uid()
      and member.role in ('owner', 'editor')
  )
);

create policy "Owners and editors can update fuel stops"
on public.trip_fuel
for update
to authenticated
using (
  exists (
    select 1
    from public.household_members member
    where member.household_id = trip_fuel.household_id
      and member.user_id = auth.uid()
      and member.role in ('owner', 'editor')
  )
)
with check (
  exists (
    select 1
    from public.household_members member
    where member.household_id = trip_fuel.household_id
      and member.user_id = auth.uid()
      and member.role in ('owner', 'editor')
  )
);

create policy "Owners and editors can delete fuel stops"
on public.trip_fuel
for delete
to authenticated
using (
  exists (
    select 1
    from public.household_members member
    where member.household_id = trip_fuel.household_id
      and member.user_id = auth.uid()
      and member.role in ('owner', 'editor')
  )
);

commit;

select
  count(*) filter (where trip_id is null) as everyday_ruby_fuel_stops,
  count(*) filter (where trip_id is not null) as trip_fuel_stops
from public.trip_fuel;
