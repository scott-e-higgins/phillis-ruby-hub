-- Higgins Hub shared documents
-- Catalogs existing electric-bill receipt images without copying, moving,
-- replacing, or deleting the stored files.
-- Safe to run more than once.

begin;

create temporary table pending_electric_bill_documents
on commit drop
as
select
  gen_random_uuid() as document_id,
  bill.id as electric_bill_id,
  site.household_id,
  bill.bill_date,
  bill.receipt_photo_path as storage_path,
  coalesce(
    (
      select member.user_id
      from public.household_members member
      where member.household_id = site.household_id
        and member.role in ('owner', 'editor')
      order by case member.role when 'owner' then 0 else 1 end, member.created_at
      limit 1
    ),
    auth.uid()
  ) as created_by,
  stored.metadata as storage_metadata,
  stored.created_at as storage_created_at
from public.electric_bills bill
join public.site_seasons season
  on season.id = bill.season_id
join public.seasonal_sites site
  on site.id = season.seasonal_site_id
left join storage.objects stored
  on stored.bucket_id = 'record-receipts'
 and stored.name = bill.receipt_photo_path
where bill.receipt_photo_path is not null
  and bill.receipt_photo_path <> ''
  and not exists (
    select 1
    from public.hub_document_links link
    where link.source_app = 'travel-journal'
      and link.record_type = 'electric_bill'
      and link.record_id = bill.id::text
      and link.link_role = 'bill_scan'
  );

insert into public.hub_documents (
  id,
  household_id,
  display_title,
  document_type,
  document_date,
  source_app,
  processing_status,
  ai_processing_status,
  retention_status,
  created_by,
  uploaded_at
)
select
  pending.document_id,
  pending.household_id,
  'Lehigh Gorge electric bill · ' || to_char(pending.bill_date, 'Mon FMDD, YYYY'),
  'electric_bill',
  pending.bill_date,
  'travel-journal',
  'approved',
  'not_requested',
  'keep',
  pending.created_by,
  coalesce(pending.storage_created_at, now())
from pending_electric_bill_documents pending;

insert into public.hub_document_files (
  document_id,
  page_number,
  original_filename,
  mime_type,
  file_size_bytes,
  storage_bucket,
  storage_path,
  cleanup_metadata
)
select
  pending.document_id,
  1,
  regexp_replace(pending.storage_path, '^.*/', ''),
  coalesce(
    pending.storage_metadata ->> 'mimetype',
    pending.storage_metadata ->> 'contentType',
    'image/jpeg'
  ),
  coalesce((pending.storage_metadata ->> 'size')::bigint, 0),
  'record-receipts',
  pending.storage_path,
  jsonb_build_object('migrated_from_legacy_receipt', true)
from pending_electric_bill_documents pending;

insert into public.hub_document_links (
  document_id,
  source_app,
  record_type,
  record_id,
  link_role,
  is_primary,
  created_by
)
select
  pending.document_id,
  'travel-journal',
  'electric_bill',
  pending.electric_bill_id::text,
  'bill_scan',
  true,
  pending.created_by
from pending_electric_bill_documents pending;

commit;

select
  count(*) as electric_bill_documents
from public.hub_document_links
where source_app = 'travel-journal'
  and record_type = 'electric_bill'
  and link_role = 'bill_scan';
