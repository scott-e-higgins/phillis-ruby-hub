-- Phillis & Ruby Travel Journal
-- Trip plans, activities, and reservations with private supporting pictures.
-- Safe to run more than once.

begin;

create table if not exists public.trip_plans (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households(id) on delete cascade,
  trip_id uuid not null references public.trips(id) on update cascade on delete cascade,
  title text not null,
  plan_type text not null default 'activity',
  status text not null default 'planned',
  plan_date date not null,
  start_time time without time zone,
  end_time time without time zone,
  location_name text,
  address text,
  city text,
  state text,
  postal_code text,
  confirmation_code text,
  cost numeric not null default 0,
  website_url text,
  notes text,
  receipt_photo_paths text[] not null default '{}',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists trip_plans_household_trip_date_idx
  on public.trip_plans (household_id, trip_id, plan_date, start_time);

alter table public.trip_plans enable row level security;

drop policy if exists "Owners and editors can view trip plans" on public.trip_plans;
create policy "Owners and editors can view trip plans"
on public.trip_plans
for select
to authenticated
using (
  exists (
    select 1
    from public.household_members hm
    where hm.user_id = auth.uid()
      and hm.household_id = trip_plans.household_id
      and hm.role in ('owner', 'editor')
  )
);

drop policy if exists "Owners and editors can add trip plans" on public.trip_plans;
create policy "Owners and editors can add trip plans"
on public.trip_plans
for insert
to authenticated
with check (
  exists (
    select 1
    from public.household_members hm
    where hm.user_id = auth.uid()
      and hm.household_id = trip_plans.household_id
      and hm.role in ('owner', 'editor')
  )
);

drop policy if exists "Owners and editors can update trip plans" on public.trip_plans;
create policy "Owners and editors can update trip plans"
on public.trip_plans
for update
to authenticated
using (
  exists (
    select 1
    from public.household_members hm
    where hm.user_id = auth.uid()
      and hm.household_id = trip_plans.household_id
      and hm.role in ('owner', 'editor')
  )
)
with check (
  exists (
    select 1
    from public.household_members hm
    where hm.user_id = auth.uid()
      and hm.household_id = trip_plans.household_id
      and hm.role in ('owner', 'editor')
  )
);

drop policy if exists "Owners and editors can delete trip plans" on public.trip_plans;
create policy "Owners and editors can delete trip plans"
on public.trip_plans
for delete
to authenticated
using (
  exists (
    select 1
    from public.household_members hm
    where hm.user_id = auth.uid()
      and hm.household_id = trip_plans.household_id
      and hm.role in ('owner', 'editor')
  )
);

grant select, insert, update, delete on public.trip_plans to authenticated;

create or replace function public.get_family_trip_plans()
returns table (
  plan_id uuid,
  trip_id uuid,
  title text,
  plan_type text,
  status text,
  plan_date date,
  start_time time without time zone,
  end_time time without time zone,
  location_name text,
  address text,
  city text,
  state text,
  postal_code text
)
language sql
stable
security definer
set search_path = ''
as $$
  select
    plan.id,
    plan.trip_id,
    plan.title,
    plan.plan_type,
    plan.status,
    plan.plan_date,
    plan.start_time,
    plan.end_time,
    plan.location_name,
    plan.address,
    plan.city,
    plan.state,
    plan.postal_code
  from public.household_members hm
  join public.trips trip on trip.household_id = hm.household_id
  join public.trip_plans plan on plan.trip_id = trip.id
  where hm.user_id = auth.uid()
    and hm.role = 'viewer'
    and trip.end_date >= current_date
  order by plan.plan_date, plan.start_time, plan.title;
$$;

revoke all on function public.get_family_trip_plans() from public;
grant execute on function public.get_family_trip_plans() to authenticated;

commit;
