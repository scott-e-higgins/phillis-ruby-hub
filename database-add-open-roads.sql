-- Phillis & Ruby Travel Journal
-- Add optional Open Roads settlement details without changing pump receipts,
-- gallons, trip meters, odometers, or historical fuel records.

alter table public.trip_fuel
  add column if not exists discount_program text not null default 'none',
  add column if not exists open_roads_status text,
  add column if not exists open_roads_invoice_id text,
  add column if not exists open_roads_transaction_date date,
  add column if not exists open_roads_location text,
  add column if not exists open_roads_product text,
  add column if not exists open_roads_quantity numeric,
  add column if not exists open_roads_unit_price numeric,
  add column if not exists open_roads_subtotal numeric,
  add column if not exists open_roads_gross_discount numeric,
  add column if not exists open_roads_program_fee numeric,
  add column if not exists open_roads_other_fees numeric,
  add column if not exists open_roads_net_savings numeric,
  add column if not exists open_roads_total_paid numeric;

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'trip_fuel_discount_program_check'
      and conrelid = 'public.trip_fuel'::regclass
  ) then
    alter table public.trip_fuel
      add constraint trip_fuel_discount_program_check
      check (discount_program in ('none', 'open_roads'));
  end if;

  if not exists (
    select 1 from pg_constraint
    where conname = 'trip_fuel_open_roads_status_check'
      and conrelid = 'public.trip_fuel'::regclass
  ) then
    alter table public.trip_fuel
      add constraint trip_fuel_open_roads_status_check
      check (open_roads_status is null or open_roads_status in ('pending', 'settled'));
  end if;
end $$;

comment on column public.trip_fuel.total_cost is
  'Original pump receipt total. For settled Open Roads entries, open_roads_total_paid is the authoritative actual expense.';
comment on column public.trip_fuel.discount_program is
  'Optional discount program. Historical rows default to none.';
comment on column public.trip_fuel.open_roads_total_paid is
  'Final amount paid shown by the confirmed Open Roads settlement.';

select
  count(*) filter (where discount_program = 'none') as standard_fuel_records,
  count(*) filter (where discount_program = 'open_roads') as open_roads_records
from public.trip_fuel;
