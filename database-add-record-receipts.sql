-- Phillis & Ruby Travel Journal
-- Optional private receipt photos for fuel, maintenance, upgrades,
-- seasonal-site payments, and electric bills. Safe to run more than once.

begin;

alter table public.trip_fuel
  add column if not exists receipt_photo_path text;

alter table public.maintenance
  add column if not exists receipt_photo_paths text[] not null default '{}';

alter table public.seasonal_payments
  add column if not exists receipt_photo_paths text[] not null default '{}';

alter table public.electric_bills
  add column if not exists receipt_photo_path text;

insert into storage.buckets (
  id,
  name,
  public,
  file_size_limit,
  allowed_mime_types
)
values (
  'record-receipts',
  'record-receipts',
  false,
  12582912,
  array['image/jpeg', 'image/png', 'image/webp', 'image/heic', 'image/heif']
)
on conflict (id) do update set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "Owners and editors can view record receipts" on storage.objects;
create policy "Owners and editors can view record receipts"
on storage.objects
for select
to authenticated
using (
  bucket_id = 'record-receipts'
  and exists (
    select 1
    from public.household_members hm
    where hm.user_id = auth.uid()
      and hm.household_id::text = (storage.foldername(name))[1]
      and hm.role in ('owner', 'editor')
  )
);

drop policy if exists "Owners and editors can add record receipts" on storage.objects;
create policy "Owners and editors can add record receipts"
on storage.objects
for insert
to authenticated
with check (
  bucket_id = 'record-receipts'
  and exists (
    select 1
    from public.household_members hm
    where hm.user_id = auth.uid()
      and hm.household_id::text = (storage.foldername(name))[1]
      and hm.role in ('owner', 'editor')
  )
);

drop policy if exists "Owners and editors can update record receipts" on storage.objects;
create policy "Owners and editors can update record receipts"
on storage.objects
for update
to authenticated
using (
  bucket_id = 'record-receipts'
  and exists (
    select 1
    from public.household_members hm
    where hm.user_id = auth.uid()
      and hm.household_id::text = (storage.foldername(name))[1]
      and hm.role in ('owner', 'editor')
  )
)
with check (
  bucket_id = 'record-receipts'
  and exists (
    select 1
    from public.household_members hm
    where hm.user_id = auth.uid()
      and hm.household_id::text = (storage.foldername(name))[1]
      and hm.role in ('owner', 'editor')
  )
);

drop policy if exists "Owners and editors can delete record receipts" on storage.objects;
create policy "Owners and editors can delete record receipts"
on storage.objects
for delete
to authenticated
using (
  bucket_id = 'record-receipts'
  and exists (
    select 1
    from public.household_members hm
    where hm.user_id = auth.uid()
      and hm.household_id::text = (storage.foldername(name))[1]
      and hm.role in ('owner', 'editor')
  )
);

commit;
