-- Phillis & Ruby Travel Journal
-- Campground Log foundation
--
-- This migration is intentionally small:
--   1. One permanent campground/host profile.
--   2. One link from each existing stay to that profile.
--   3. One flexible journal object on each stay for visit-specific details.
--
-- It is safe to run more than once.

begin;

create table if not exists public.campgrounds (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households(id) on delete cascade,
  name text not null,
  place_type text not null default 'campground',
  address text,
  city text,
  state text,
  postal_code text,
  phone text,
  website_url text,
  profile_data jsonb not null default '{}'::jsonb,
  created_by uuid references auth.users(id) on delete set null default auth.uid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint campgrounds_place_type_check
    check (place_type in ('campground', 'harvest_host', 'moochdocking', 'boondocking', 'other')),
  constraint campgrounds_profile_data_object_check
    check (jsonb_typeof(profile_data) = 'object')
);

alter table public.campground_stays
  add column if not exists campground_id uuid references public.campgrounds(id) on delete set null,
  add column if not exists journal_data jsonb not null default '{}'::jsonb,
  add column if not exists overall_rating smallint,
  add column if not exists would_return boolean,
  add column if not exists journal_completed_at timestamptz;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'campground_stays_journal_data_object_check'
      and conrelid = 'public.campground_stays'::regclass
  ) then
    alter table public.campground_stays
      add constraint campground_stays_journal_data_object_check
      check (jsonb_typeof(journal_data) = 'object');
  end if;

  if not exists (
    select 1
    from pg_constraint
    where conname = 'campground_stays_overall_rating_check'
      and conrelid = 'public.campground_stays'::regclass
  ) then
    alter table public.campground_stays
      add constraint campground_stays_overall_rating_check
      check (overall_rating is null or overall_rating between 1 and 5);
  end if;
end
$$;

create index if not exists idx_campgrounds_household_name
  on public.campgrounds (household_id, lower(name));

create index if not exists idx_campgrounds_household_location
  on public.campgrounds (household_id, state, city);

create index if not exists idx_campground_stays_campground_id
  on public.campground_stays (campground_id);

-- Create one permanent profile for each exact campground/host name and
-- city/state combination already present in the Travel Journal.
-- This deliberately avoids merging similar-looking names.
insert into public.campgrounds (
  household_id,
  name,
  place_type,
  address,
  city,
  state,
  postal_code,
  created_at,
  updated_at
)
select
  trip.household_id,
  min(stay.campground_name),
  case
    when bool_or(stay.stay_type in ('harvest_host', 'harvest-host')) then 'harvest_host'
    when bool_or(stay.stay_type = 'moochdocking') then 'moochdocking'
    when bool_or(stay.stay_type = 'boondocking') then 'boondocking'
    else 'campground'
  end,
  nullif(max(stay.address), ''),
  nullif(max(stay.city), ''),
  nullif(max(stay.state), ''),
  nullif(max(stay.postal_code), ''),
  min(stay.created_at),
  now()
from public.campground_stays stay
join public.trips trip on trip.id = stay.trip_id
where nullif(trim(stay.campground_name), '') is not null
  and not exists (
    select 1
    from public.campgrounds campground
    where campground.household_id = trip.household_id
      and lower(trim(campground.name)) = lower(trim(stay.campground_name))
      and lower(trim(coalesce(campground.city, ''))) = lower(trim(coalesce(stay.city, '')))
      and upper(trim(coalesce(campground.state, ''))) = upper(trim(coalesce(stay.state, '')))
  )
group by
  trip.household_id,
  lower(trim(stay.campground_name)),
  lower(trim(coalesce(stay.city, ''))),
  upper(trim(coalesce(stay.state, '')));

-- Link the existing visits to the newly created permanent profiles.
update public.campground_stays stay
set campground_id = campground.id
from public.trips trip,
     public.campgrounds campground
where trip.id = stay.trip_id
  and campground.household_id = trip.household_id
  and lower(trim(campground.name)) = lower(trim(stay.campground_name))
  and lower(trim(coalesce(campground.city, ''))) = lower(trim(coalesce(stay.city, '')))
  and upper(trim(coalesce(campground.state, ''))) = upper(trim(coalesce(stay.state, '')))
  and stay.campground_id is null;

-- Keep updated_at current when the shared profile changes.
drop trigger if exists campgrounds_set_updated_at on public.campgrounds;
create trigger campgrounds_set_updated_at
before update on public.campgrounds
for each row execute function public.set_updated_at();

alter table public.campgrounds enable row level security;

drop policy if exists "Owners and editors can view campgrounds" on public.campgrounds;
create policy "Owners and editors can view campgrounds"
on public.campgrounds
for select
to authenticated
using (
  public.current_household_role(household_id) in ('owner', 'editor')
);

drop policy if exists "Owners and editors can add campgrounds" on public.campgrounds;
create policy "Owners and editors can add campgrounds"
on public.campgrounds
for insert
to authenticated
with check (
  public.current_household_role(household_id) in ('owner', 'editor')
);

drop policy if exists "Owners and editors can update campgrounds" on public.campgrounds;
create policy "Owners and editors can update campgrounds"
on public.campgrounds
for update
to authenticated
using (
  public.current_household_role(household_id) in ('owner', 'editor')
)
with check (
  public.current_household_role(household_id) in ('owner', 'editor')
);

drop policy if exists "Owners and editors can delete campgrounds" on public.campgrounds;
create policy "Owners and editors can delete campgrounds"
on public.campgrounds
for delete
to authenticated
using (
  public.current_household_role(household_id) in ('owner', 'editor')
);

commit;

-- Verification: the result should show the number of permanent profiles,
-- existing stays, and any stays that still need to be linked.
select 'campgrounds' as record_type, count(*) as records
from public.campgrounds
union all
select 'campground_stays', count(*)
from public.campground_stays
union all
select 'unlinked_stays', count(*)
from public.campground_stays
where campground_id is null
order by record_type;
