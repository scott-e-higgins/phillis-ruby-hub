begin;

alter table public.hub_notes
  add column if not exists is_pinned boolean not null default false,
  add column if not exists trip_id uuid references public.trips(id)
    on update cascade
    on delete set null;

create index if not exists hub_notes_household_pinned_updated_idx
  on public.hub_notes (household_id, is_pinned desc, updated_at desc);

create index if not exists hub_notes_trip_id_idx
  on public.hub_notes (trip_id);

commit;
