-- Fuel Receipt Scanner
-- Additive, safe to run more than once.

alter table public.trip_fuel
  add column if not exists fuel_time time,
  add column if not exists address text,
  add column if not exists price_per_gallon numeric,
  add column if not exists receipt_number text;

comment on column public.trip_fuel.fuel_time is
  'Printed transaction time extracted from a fuel receipt or entered by the user.';
comment on column public.trip_fuel.address is
  'Printed station street address, when available.';
comment on column public.trip_fuel.price_per_gallon is
  'Printed receipt price per gallon. Retained separately from the calculated value for document traceability.';
comment on column public.trip_fuel.receipt_number is
  'Optional printed receipt or transaction number.';
