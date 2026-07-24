begin;

create table if not exists public.vehicle_private_details (
  vehicle_id uuid primary key references public.vehicles(id) on delete cascade,
  household_id uuid not null references public.households(id) on delete cascade,
  vin text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.vehicle_private_details enable row level security;

drop policy if exists "Owners and editors can view private vehicle details"
  on public.vehicle_private_details;
create policy "Owners and editors can view private vehicle details"
  on public.vehicle_private_details
  for select
  using (
    exists (
      select 1
      from public.household_members hm
      where hm.household_id = vehicle_private_details.household_id
        and hm.user_id = auth.uid()
        and hm.role in ('owner', 'editor')
    )
  );

drop policy if exists "Owners and editors can add private vehicle details"
  on public.vehicle_private_details;
create policy "Owners and editors can add private vehicle details"
  on public.vehicle_private_details
  for insert
  with check (
    exists (
      select 1
      from public.household_members hm
      where hm.household_id = vehicle_private_details.household_id
        and hm.user_id = auth.uid()
        and hm.role in ('owner', 'editor')
    )
  );

drop policy if exists "Owners and editors can update private vehicle details"
  on public.vehicle_private_details;
create policy "Owners and editors can update private vehicle details"
  on public.vehicle_private_details
  for update
  using (
    exists (
      select 1
      from public.household_members hm
      where hm.household_id = vehicle_private_details.household_id
        and hm.user_id = auth.uid()
        and hm.role in ('owner', 'editor')
    )
  )
  with check (
    exists (
      select 1
      from public.household_members hm
      where hm.household_id = vehicle_private_details.household_id
        and hm.user_id = auth.uid()
        and hm.role in ('owner', 'editor')
    )
  );

drop policy if exists "Owners and editors can delete private vehicle details"
  on public.vehicle_private_details;
create policy "Owners and editors can delete private vehicle details"
  on public.vehicle_private_details
  for delete
  using (
    exists (
      select 1
      from public.household_members hm
      where hm.household_id = vehicle_private_details.household_id
        and hm.user_id = auth.uid()
        and hm.role in ('owner', 'editor')
    )
  );

commit;
