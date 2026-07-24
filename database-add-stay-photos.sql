begin;

alter table public.campground_stays
  add column if not exists site_photo_path text,
  add column if not exists sign_photo_path text;

insert into storage.buckets (
  id,
  name,
  public,
  file_size_limit,
  allowed_mime_types
)
values (
  'stay-photos',
  'stay-photos',
  false,
  12582912,
  array['image/jpeg', 'image/png', 'image/webp', 'image/heic', 'image/heif']
)
on conflict (id) do update set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "Household members can view stay photos" on storage.objects;
create policy "Household members can view stay photos"
on storage.objects
for select
to authenticated
using (
  bucket_id = 'stay-photos'
  and exists (
    select 1
    from public.household_members hm
    where hm.user_id = auth.uid()
      and hm.household_id::text = (storage.foldername(name))[1]
  )
);

drop policy if exists "Owners and editors can add stay photos" on storage.objects;
create policy "Owners and editors can add stay photos"
on storage.objects
for insert
to authenticated
with check (
  bucket_id = 'stay-photos'
  and exists (
    select 1
    from public.household_members hm
    where hm.user_id = auth.uid()
      and hm.household_id::text = (storage.foldername(name))[1]
      and hm.role in ('owner', 'editor')
  )
);

drop policy if exists "Owners and editors can update stay photos" on storage.objects;
create policy "Owners and editors can update stay photos"
on storage.objects
for update
to authenticated
using (
  bucket_id = 'stay-photos'
  and exists (
    select 1
    from public.household_members hm
    where hm.user_id = auth.uid()
      and hm.household_id::text = (storage.foldername(name))[1]
      and hm.role in ('owner', 'editor')
  )
)
with check (
  bucket_id = 'stay-photos'
  and exists (
    select 1
    from public.household_members hm
    where hm.user_id = auth.uid()
      and hm.household_id::text = (storage.foldername(name))[1]
      and hm.role in ('owner', 'editor')
  )
);

drop policy if exists "Owners and editors can delete stay photos" on storage.objects;
create policy "Owners and editors can delete stay photos"
on storage.objects
for delete
to authenticated
using (
  bucket_id = 'stay-photos'
  and exists (
    select 1
    from public.household_members hm
    where hm.user_id = auth.uid()
      and hm.household_id::text = (storage.foldername(name))[1]
      and hm.role in ('owner', 'editor')
  )
);

create or replace function public.get_family_itinerary_v3()
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
  stay_type text,
  site_photo_path text,
  sign_photo_path text
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
    cs.stay_type,
    cs.site_photo_path,
    cs.sign_photo_path
  from public.household_members hm
  join public.trips t on t.household_id = hm.household_id
  left join public.campground_stays cs on cs.trip_id = t.id
  where hm.user_id = auth.uid()
    and hm.role = 'viewer'
    and t.end_date >= current_date
  order by t.start_date, cs.arrival_date;
$$;

revoke all on function public.get_family_itinerary_v3() from public;
grant execute on function public.get_family_itinerary_v3() to authenticated;

commit;
