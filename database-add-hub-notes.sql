create table if not exists public.hub_notes (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households(id) on delete cascade,
  title text not null,
  body text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists hub_notes_household_updated_idx
  on public.hub_notes (household_id, updated_at desc);

alter table public.hub_notes enable row level security;

drop policy if exists "Owners and editors can view hub notes" on public.hub_notes;
create policy "Owners and editors can view hub notes"
on public.hub_notes
for select
to authenticated
using (
  exists (
    select 1
    from public.household_members hm
    where hm.household_id = hub_notes.household_id
      and hm.user_id = auth.uid()
      and hm.role in ('owner', 'editor')
  )
);

drop policy if exists "Owners and editors can add hub notes" on public.hub_notes;
create policy "Owners and editors can add hub notes"
on public.hub_notes
for insert
to authenticated
with check (
  exists (
    select 1
    from public.household_members hm
    where hm.household_id = hub_notes.household_id
      and hm.user_id = auth.uid()
      and hm.role in ('owner', 'editor')
  )
);

drop policy if exists "Owners and editors can update hub notes" on public.hub_notes;
create policy "Owners and editors can update hub notes"
on public.hub_notes
for update
to authenticated
using (
  exists (
    select 1
    from public.household_members hm
    where hm.household_id = hub_notes.household_id
      and hm.user_id = auth.uid()
      and hm.role in ('owner', 'editor')
  )
)
with check (
  exists (
    select 1
    from public.household_members hm
    where hm.household_id = hub_notes.household_id
      and hm.user_id = auth.uid()
      and hm.role in ('owner', 'editor')
  )
);

drop policy if exists "Owners and editors can delete hub notes" on public.hub_notes;
create policy "Owners and editors can delete hub notes"
on public.hub_notes
for delete
to authenticated
using (
  exists (
    select 1
    from public.household_members hm
    where hm.household_id = hub_notes.household_id
      and hm.user_id = auth.uid()
      and hm.role in ('owner', 'editor')
  )
);

grant select, insert, update, delete on public.hub_notes to authenticated;
