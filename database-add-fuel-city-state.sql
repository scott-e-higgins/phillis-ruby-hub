-- Phillis & Ruby Travel Journal
-- Add separate city and state fields to fuel stops without removing the
-- original location field. Safe to run more than once.

alter table public.trip_fuel
  add column if not exists city text,
  add column if not exists state text;

update public.trip_fuel
set
  city = coalesce(
    city,
    trim(regexp_replace(location, ',\s*[A-Za-z]{2}\s*$', ''))
  ),
  state = coalesce(
    state,
    upper(substring(location from ',\s*([A-Za-z]{2})\s*$'))
  )
where location is not null
  and trim(location) <> ''
  and location ~ ',\s*[A-Za-z]{2}\s*$';

update public.trip_fuel
set city = location
where location is not null
  and trim(location) <> ''
  and city is null;

comment on column public.trip_fuel.city is
  'City where the fuel stop occurred.';

comment on column public.trip_fuel.state is
  'Two-letter state abbreviation for the fuel stop.';
