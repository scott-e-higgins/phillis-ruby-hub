# Higgins Hub shared scanner

## Purpose

The scanner should be a shared Higgins Hub service, not an electric-bill-only
feature. Travel Journal, a future Finance app, and a future filing-cabinet app
should all point to the same underlying document, expense, and payment records.

The first UI integration is Lehigh Gorge electric bills. Version 0.39.0 only
adds local capture, cleanup, and preview. It does not change the production
database and it does not call a paid AI service.

## Current Travel Journal structure

- `electric_bills` stores the bill date, current meter reading, amount, rate,
  payment date, check number, notes, and one `receipt_photo_path`.
- The app derives the previous reading and usage from adjacent readings.
- The private `record-receipts` bucket accepts images only.
- Ordinary app pictures are reduced to a 1,400-pixel maximum dimension at 78%
  JPEG quality.
- Owners and editors can access private receipt files. Family Viewers cannot.

That structure must remain working while the shared scanner is introduced.

## Smallest clean production schema change

The next database stage should add four shared tables and three nullable links
to `electric_bills`. Existing columns remain for backward compatibility.

### `hub_documents`

One row per logical document.

- `id uuid primary key`
- `household_id uuid not null`
- `display_title text not null`
- `document_type text not null`
- `document_date date`
- `source_app text not null`
- `related_record_type text`
- `related_record_id uuid`
- `processing_status text not null default 'draft'`
- `ai_processing_status text not null default 'not_requested'`
- `extracted_text text`
- `extracted_data jsonb not null default '{}'`
- `user_corrections jsonb not null default '{}'`
- `review_fields jsonb not null default '[]'`
- `confidence numeric`
- `processing_cost_usd numeric not null default 0`
- `retention_status text not null default 'keep'`
- `created_by uuid not null`
- `uploaded_at timestamptz`
- `created_at timestamptz not null default now()`
- `updated_at timestamptz not null default now()`

### `hub_document_files`

One row per stored file or camera page. A PDF is normally one unchanged file;
future multi-page camera scans can have one row per page.

- `id uuid primary key`
- `document_id uuid not null`
- `page_number integer not null default 1`
- `original_filename text not null`
- `mime_type text not null`
- `file_size_bytes bigint not null`
- `storage_bucket text not null default 'hub-documents'`
- `storage_path text not null`
- `sha256 text`
- `width integer`
- `height integer`
- `has_selectable_text boolean`
- `cleanup_metadata jsonb not null default '{}'`
- `created_at timestamptz not null default now()`

Add a unique constraint on `(document_id, page_number)`.

### `hub_expenses`

The one financial obligation that Travel and Finance both display.

- `id uuid primary key`
- `household_id uuid not null`
- `document_id uuid`
- `expense_date date`
- `payee text`
- `category text`
- `description text`
- `amount numeric not null`
- `status text not null default 'unpaid'`
- `source_app text not null`
- `related_record_type text`
- `related_record_id uuid`
- `notes text`
- `created_by uuid not null`
- `created_at timestamptz not null default now()`
- `updated_at timestamptz not null default now()`

### `hub_payments`

One expense may have zero, one, or multiple payments.

- `id uuid primary key`
- `household_id uuid not null`
- `expense_id uuid not null`
- `document_id uuid`
- `payment_status text not null default 'planned'`
- `amount numeric`
- `payment_method text`
- `payment_account text`
- `check_number text`
- `mailed_date date`
- `cleared_date date`
- `notes text`
- `created_by uuid not null`
- `created_at timestamptz not null default now()`
- `updated_at timestamptz not null default now()`

### Links from `electric_bills`

- `document_id uuid null references hub_documents(id)`
- `expense_id uuid null references hub_expenses(id)`
- `payment_id uuid null references hub_payments(id)`
- `billing_period_start date`
- `billing_period_end date`
- `previous_meter_reading numeric`
- `usage_kwh numeric`
- `due_date date`

For newly scanned bills, `hub_expenses.amount` and `hub_payments` are the
financial source of truth. Existing `electric_bills.amount`, `payment_date`,
and `check_number` remain readable during migration but should not create
separate Finance records.

## Storage

Create one private `hub-documents` bucket during the next database stage.

- Path: `<household-id>/<document-id>/<page-or-file-id>.<extension>`
- Allow JPEG, PNG, WebP, HEIC/HEIF, and PDF.
- Preserve a good PDF as uploaded.
- Use a document-specific image target: maximum 2,400 pixels on the long edge,
  JPEG quality around 86%, with a size guard rather than the ordinary travel
  picture settings.
- Owners and editors receive CRUD access through household-scoped storage
  policies. Family Viewers receive no direct document access.

## Processing stages

1. Capture or select a file.
2. Clean images locally; inspect PDFs without converting them.
3. Preview, rotate, replace, or remove.
4. Create a draft document and upload its file(s).
5. Optionally call a Supabase Edge Function for AI extraction.
6. Review extracted values.
7. Approve corrections.
8. Save/link the electric bill, shared expense, and optional payment.

The Edge Function will hold the OpenAI key as a Supabase secret. The browser
will never receive that key.

## Version 0.39.0 boundary

Included:

- Phone camera selection
- Image or PDF selection
- Raw preview before processing
- Local image edge estimation, perspective squaring when confidence is high,
  readability enhancement, resizing, and document-specific compression
- PDF preview and a best-effort selectable-text check
- Rotate, replace, retake, and remove
- Existing electric-bill image attachment remains compatible

Not included:

- New production tables or bucket
- PDF cloud saving
- Multi-page camera assembly
- AI/OCR calls
- Expense/payment creation

