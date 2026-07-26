-- Higgins Hub shared documents foundation
-- Adds the reusable document catalog used by Travel Journal, future Finance,
-- and the future Filing Cabinet / File Box.
-- This migration is non-destructive and safe to run more than once.

begin;

create or replace function public.set_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create or replace function public.current_household_role(target_household uuid)
returns text
language sql
stable
security definer
set search_path = ''
as $$
  select member.role
  from public.household_members member
  where member.household_id = target_household
    and member.user_id = auth.uid()
  limit 1;
$$;

revoke all on function public.current_household_role(uuid) from public;
grant execute on function public.current_household_role(uuid) to authenticated;

create table if not exists public.hub_documents (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households(id) on delete cascade,
  display_title text not null,
  document_type text not null,
  document_date date,
  source_app text not null,
  processing_status text not null default 'draft'
    check (processing_status in ('draft', 'uploaded', 'processing', 'review', 'approved', 'failed')),
  ai_processing_status text not null default 'not_requested'
    check (ai_processing_status in ('not_requested', 'queued', 'processing', 'review', 'complete', 'failed')),
  extracted_text text,
  extracted_data jsonb not null default '{}'::jsonb,
  user_corrections jsonb not null default '{}'::jsonb,
  review_fields jsonb not null default '[]'::jsonb,
  confidence numeric
    check (confidence is null or (confidence >= 0 and confidence <= 1)),
  processing_cost_usd numeric not null default 0
    check (processing_cost_usd >= 0),
  retention_status text not null default 'keep'
    check (retention_status in ('keep', 'archive', 'review', 'delete_requested')),
  created_by uuid references auth.users(id) on delete set null,
  uploaded_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.hub_document_files (
  id uuid primary key default gen_random_uuid(),
  document_id uuid not null references public.hub_documents(id) on delete cascade,
  page_number integer not null default 1 check (page_number > 0),
  original_filename text not null,
  mime_type text not null,
  file_size_bytes bigint not null check (file_size_bytes >= 0),
  storage_bucket text not null default 'hub-documents',
  storage_path text not null,
  sha256 text,
  width integer check (width is null or width > 0),
  height integer check (height is null or height > 0),
  has_selectable_text boolean,
  cleanup_metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  unique (document_id, page_number),
  unique (storage_bucket, storage_path)
);

create table if not exists public.hub_document_links (
  id uuid primary key default gen_random_uuid(),
  document_id uuid not null references public.hub_documents(id) on delete cascade,
  source_app text not null,
  record_type text not null,
  record_id text not null,
  link_role text not null default 'supporting_document',
  is_primary boolean not null default false,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  unique (document_id, source_app, record_type, record_id, link_role)
);

create index if not exists hub_documents_household_date_idx
  on public.hub_documents (household_id, document_date desc, created_at desc);

create index if not exists hub_documents_household_type_idx
  on public.hub_documents (household_id, document_type);

create index if not exists hub_document_files_document_idx
  on public.hub_document_files (document_id, page_number);

create index if not exists hub_document_links_record_idx
  on public.hub_document_links (source_app, record_type, record_id);

create index if not exists hub_document_links_document_idx
  on public.hub_document_links (document_id);

drop trigger if exists hub_documents_set_updated_at on public.hub_documents;
create trigger hub_documents_set_updated_at
before update on public.hub_documents
for each row execute function public.set_updated_at();

alter table public.hub_documents enable row level security;
alter table public.hub_document_files enable row level security;
alter table public.hub_document_links enable row level security;

drop policy if exists "Owners and editors can view hub documents" on public.hub_documents;
create policy "Owners and editors can view hub documents"
on public.hub_documents
for select
to authenticated
using (
  public.current_household_role(household_id) in ('owner', 'editor')
);

drop policy if exists "Owners and editors can add hub documents" on public.hub_documents;
create policy "Owners and editors can add hub documents"
on public.hub_documents
for insert
to authenticated
with check (
  public.current_household_role(household_id) in ('owner', 'editor')
  and created_by = auth.uid()
);

drop policy if exists "Owners and editors can update hub documents" on public.hub_documents;
create policy "Owners and editors can update hub documents"
on public.hub_documents
for update
to authenticated
using (
  public.current_household_role(household_id) in ('owner', 'editor')
)
with check (
  public.current_household_role(household_id) in ('owner', 'editor')
);

drop policy if exists "Owners and editors can delete hub documents" on public.hub_documents;
create policy "Owners and editors can delete hub documents"
on public.hub_documents
for delete
to authenticated
using (
  public.current_household_role(household_id) in ('owner', 'editor')
);

drop policy if exists "Owners and editors can view hub document files" on public.hub_document_files;
create policy "Owners and editors can view hub document files"
on public.hub_document_files
for select
to authenticated
using (
  exists (
    select 1
    from public.hub_documents document
    where document.id = hub_document_files.document_id
      and public.current_household_role(document.household_id) in ('owner', 'editor')
  )
);

drop policy if exists "Owners and editors can add hub document files" on public.hub_document_files;
create policy "Owners and editors can add hub document files"
on public.hub_document_files
for insert
to authenticated
with check (
  exists (
    select 1
    from public.hub_documents document
    where document.id = hub_document_files.document_id
      and public.current_household_role(document.household_id) in ('owner', 'editor')
  )
);

drop policy if exists "Owners and editors can update hub document files" on public.hub_document_files;
create policy "Owners and editors can update hub document files"
on public.hub_document_files
for update
to authenticated
using (
  exists (
    select 1
    from public.hub_documents document
    where document.id = hub_document_files.document_id
      and public.current_household_role(document.household_id) in ('owner', 'editor')
  )
)
with check (
  exists (
    select 1
    from public.hub_documents document
    where document.id = hub_document_files.document_id
      and public.current_household_role(document.household_id) in ('owner', 'editor')
  )
);

drop policy if exists "Owners and editors can delete hub document files" on public.hub_document_files;
create policy "Owners and editors can delete hub document files"
on public.hub_document_files
for delete
to authenticated
using (
  exists (
    select 1
    from public.hub_documents document
    where document.id = hub_document_files.document_id
      and public.current_household_role(document.household_id) in ('owner', 'editor')
  )
);

drop policy if exists "Owners and editors can view hub document links" on public.hub_document_links;
create policy "Owners and editors can view hub document links"
on public.hub_document_links
for select
to authenticated
using (
  exists (
    select 1
    from public.hub_documents document
    where document.id = hub_document_links.document_id
      and public.current_household_role(document.household_id) in ('owner', 'editor')
  )
);

drop policy if exists "Owners and editors can add hub document links" on public.hub_document_links;
create policy "Owners and editors can add hub document links"
on public.hub_document_links
for insert
to authenticated
with check (
  created_by = auth.uid()
  and exists (
    select 1
    from public.hub_documents document
    where document.id = hub_document_links.document_id
      and public.current_household_role(document.household_id) in ('owner', 'editor')
  )
);

drop policy if exists "Owners and editors can update hub document links" on public.hub_document_links;
create policy "Owners and editors can update hub document links"
on public.hub_document_links
for update
to authenticated
using (
  exists (
    select 1
    from public.hub_documents document
    where document.id = hub_document_links.document_id
      and public.current_household_role(document.household_id) in ('owner', 'editor')
  )
)
with check (
  exists (
    select 1
    from public.hub_documents document
    where document.id = hub_document_links.document_id
      and public.current_household_role(document.household_id) in ('owner', 'editor')
  )
);

drop policy if exists "Owners and editors can delete hub document links" on public.hub_document_links;
create policy "Owners and editors can delete hub document links"
on public.hub_document_links
for delete
to authenticated
using (
  exists (
    select 1
    from public.hub_documents document
    where document.id = hub_document_links.document_id
      and public.current_household_role(document.household_id) in ('owner', 'editor')
  )
);

insert into storage.buckets (
  id,
  name,
  public,
  file_size_limit,
  allowed_mime_types
)
values (
  'hub-documents',
  'hub-documents',
  false,
  26214400,
  array[
    'image/jpeg',
    'image/png',
    'image/webp',
    'image/heic',
    'image/heif',
    'application/pdf'
  ]
)
on conflict (id) do update set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "Owners and editors can view hub document storage" on storage.objects;
create policy "Owners and editors can view hub document storage"
on storage.objects
for select
to authenticated
using (
  bucket_id = 'hub-documents'
  and exists (
    select 1
    from public.household_members member
    where member.user_id = auth.uid()
      and member.household_id::text = (storage.foldername(name))[1]
      and member.role in ('owner', 'editor')
  )
);

drop policy if exists "Owners and editors can add hub document storage" on storage.objects;
create policy "Owners and editors can add hub document storage"
on storage.objects
for insert
to authenticated
with check (
  bucket_id = 'hub-documents'
  and exists (
    select 1
    from public.household_members member
    where member.user_id = auth.uid()
      and member.household_id::text = (storage.foldername(name))[1]
      and member.role in ('owner', 'editor')
  )
);

drop policy if exists "Owners and editors can update hub document storage" on storage.objects;
create policy "Owners and editors can update hub document storage"
on storage.objects
for update
to authenticated
using (
  bucket_id = 'hub-documents'
  and exists (
    select 1
    from public.household_members member
    where member.user_id = auth.uid()
      and member.household_id::text = (storage.foldername(name))[1]
      and member.role in ('owner', 'editor')
  )
)
with check (
  bucket_id = 'hub-documents'
  and exists (
    select 1
    from public.household_members member
    where member.user_id = auth.uid()
      and member.household_id::text = (storage.foldername(name))[1]
      and member.role in ('owner', 'editor')
  )
);

drop policy if exists "Owners and editors can delete hub document storage" on storage.objects;
create policy "Owners and editors can delete hub document storage"
on storage.objects
for delete
to authenticated
using (
  bucket_id = 'hub-documents'
  and exists (
    select 1
    from public.household_members member
    where member.user_id = auth.uid()
      and member.household_id::text = (storage.foldername(name))[1]
      and member.role in ('owner', 'editor')
  )
);

grant select, insert, update, delete on
  public.hub_documents,
  public.hub_document_files,
  public.hub_document_links
to authenticated;

commit;
