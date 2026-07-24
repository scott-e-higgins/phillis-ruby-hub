begin;

alter table public.hub_notes
  add column if not exists photo_paths text[] not null default '{}';

insert into storage.buckets (
  id,
  name,
  public,
  file_size_limit,
  allowed_mime_types
)
values (
  'note-photos',
  'note-photos',
  false,
  12582912,
  array['image/jpeg', 'image/png', 'image/webp', 'image/heic', 'image/heif']
)
on conflict (id) do update set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "Owners and editors can view note photos" on storage.objects;
create policy "Owners and editors can view note photos"
on storage.objects
for select
to authenticated
using (
  bucket_id = 'note-photos'
  and exists (
    select 1
    from public.household_members hm
    where hm.user_id = auth.uid()
      and hm.household_id::text = (storage.foldername(name))[1]
      and hm.role in ('owner', 'editor')
  )
);

drop policy if exists "Owners and editors can add note photos" on storage.objects;
create policy "Owners and editors can add note photos"
on storage.objects
for insert
to authenticated
with check (
  bucket_id = 'note-photos'
  and exists (
    select 1
    from public.household_members hm
    where hm.user_id = auth.uid()
      and hm.household_id::text = (storage.foldername(name))[1]
      and hm.role in ('owner', 'editor')
  )
);

drop policy if exists "Owners and editors can update note photos" on storage.objects;
create policy "Owners and editors can update note photos"
on storage.objects
for update
to authenticated
using (
  bucket_id = 'note-photos'
  and exists (
    select 1
    from public.household_members hm
    where hm.user_id = auth.uid()
      and hm.household_id::text = (storage.foldername(name))[1]
      and hm.role in ('owner', 'editor')
  )
)
with check (
  bucket_id = 'note-photos'
  and exists (
    select 1
    from public.household_members hm
    where hm.user_id = auth.uid()
      and hm.household_id::text = (storage.foldername(name))[1]
      and hm.role in ('owner', 'editor')
  )
);

drop policy if exists "Owners and editors can delete note photos" on storage.objects;
create policy "Owners and editors can delete note photos"
on storage.objects
for delete
to authenticated
using (
  bucket_id = 'note-photos'
  and exists (
    select 1
    from public.household_members hm
    where hm.user_id = auth.uid()
      and hm.household_id::text = (storage.foldername(name))[1]
      and hm.role in ('owner', 'editor')
  )
);

commit;
