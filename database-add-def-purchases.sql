-- Phillis & Ruby Travel Journal
-- Add DEF purchases without changing existing fuel or MPG records.
-- Safe to run more than once.

begin;

create table if not exists public.def_purchases (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households(id) on update cascade on delete cascade,
  trip_id uuid references public.trips(id) on update cascade on delete set null,
  vehicle_id uuid not null references public.vehicles(id) on update cascade on delete restrict,
  fuel_id uuid references public.trip_fuel(id) on update cascade on delete set null,
  purchase_date date not null,
  purchase_time time,
  station text,
  address text,
  city text,
  state text,
  odometer numeric,
  gallons numeric not null check (gallons > 0),
  price_per_gallon numeric check (price_per_gallon is null or price_per_gallon >= 0),
  total_cost numeric not null check (total_cost >= 0),
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_def_purchases_household_date
  on public.def_purchases(household_id, purchase_date desc);
create index if not exists idx_def_purchases_trip_id
  on public.def_purchases(trip_id);
create index if not exists idx_def_purchases_vehicle_odometer
  on public.def_purchases(vehicle_id, odometer)
  where odometer is not null;
create index if not exists idx_def_purchases_fuel_id
  on public.def_purchases(fuel_id)
  where fuel_id is not null;

alter table public.def_purchases enable row level security;

drop policy if exists "Owners and editors can view DEF purchases" on public.def_purchases;
drop policy if exists "Owners and editors can add DEF purchases" on public.def_purchases;
drop policy if exists "Owners and editors can update DEF purchases" on public.def_purchases;
drop policy if exists "Owners and editors can delete DEF purchases" on public.def_purchases;

create policy "Owners and editors can view DEF purchases"
on public.def_purchases for select to authenticated
using (exists (
  select 1 from public.household_members member
  where member.household_id = def_purchases.household_id
    and member.user_id = auth.uid()
    and member.role in ('owner', 'editor')
));

create policy "Owners and editors can add DEF purchases"
on public.def_purchases for insert to authenticated
with check (exists (
  select 1 from public.household_members member
  where member.household_id = def_purchases.household_id
    and member.user_id = auth.uid()
    and member.role in ('owner', 'editor')
));

create policy "Owners and editors can update DEF purchases"
on public.def_purchases for update to authenticated
using (exists (
  select 1 from public.household_members member
  where member.household_id = def_purchases.household_id
    and member.user_id = auth.uid()
    and member.role in ('owner', 'editor')
))
with check (exists (
  select 1 from public.household_members member
  where member.household_id = def_purchases.household_id
    and member.user_id = auth.uid()
    and member.role in ('owner', 'editor')
));

create policy "Owners and editors can delete DEF purchases"
on public.def_purchases for delete to authenticated
using (exists (
  select 1 from public.household_members member
  where member.household_id = def_purchases.household_id
    and member.user_id = auth.uid()
    and member.role in ('owner', 'editor')
));

commit;

select count(*) as def_purchase_records from public.def_purchases;
