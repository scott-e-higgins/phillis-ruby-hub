begin;

alter table public.hub_notes
  add column if not exists is_archived boolean not null default false;

create index if not exists hub_notes_household_archived_updated_idx
  on public.hub_notes (household_id, is_archived, updated_at desc);

commit;
