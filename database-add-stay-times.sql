begin;

alter table public.campground_stays
  add column if not exists check_in_time time without time zone,
  add column if not exists check_out_time time without time zone;

create or replace function public.get_family_itinerary_v2()
returns table (
  trip_id uuid,
  trip_name text,
  destination_name text,
  start_date date,
  end_date date,
  campground_name text,
  arrival_date date,
  checkout_date date,
  check_in_time time without time zone,
  check_out_time time without time zone,
  address text,
  city text,
  state text,
  postal_code text,
  site_number text,
  stay_type text
)
language sql
stable
security definer
set search_path = ''
as $$
  select
    t.id,
    t.name,
    t.destination_name,
    t.start_date,
    t.end_date,
    cs.campground_name,
    cs.arrival_date,
    cs.checkout_date,
    cs.check_in_time,
    cs.check_out_time,
    cs.address,
    cs.city,
    cs.state,
    cs.postal_code,
    cs.site_number,
    cs.stay_type
  from public.household_members hm
  join public.trips t on t.household_id = hm.household_id
  left join public.campground_stays cs on cs.trip_id = t.id
  where hm.user_id = auth.uid()
    and hm.role = 'viewer'
    and t.end_date >= current_date
  order by t.start_date, cs.arrival_date;
$$;

revoke all on function public.get_family_itinerary_v2() from public;
grant execute on function public.get_family_itinerary_v2() to authenticated;

commit;
