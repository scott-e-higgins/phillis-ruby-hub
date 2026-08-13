# Higgins Hub shared scanner

## Purpose

The scanner should be a shared Higgins Hub service, not an electric-bill-only
feature. Travel Journal, a future Finance app, and a future filing-cabinet app
should all point to the same underlying document, expense, and payment records.

The first UI integration is Lehigh Gorge electric bills. Version 0.42.0
supports local capture and cleanup plus shared multi-file document saving. It
does not call a paid AI service.

## Current Travel Journal structure

- `electric_bills` stores the bill date, current meter reading, amount, rate,
  payment date, check number, and notes.
- Existing `receipt_photo_path` values remain as a compatibility fallback.
- New bill images and PDFs are stored through the shared Higgins Documents
  tables and linked back to the electric-bill record.
- The app derives the previous reading and usage from adjacent readings.
- The private `hub-documents` bucket accepts document images and PDFs.
- Ordinary app pictures are reduced to a 1,400-pixel maximum dimension at 78%
  JPEG quality.
- Owners and editors can access private receipt files. Family Viewers cannot.

Existing single-page bill images remain readable while records are moved into
the shared catalog.

## Shared document foundation

Three shared document tables are now installed. They do not change or remove
the existing receipt columns, so the Travel Journal remains fully compatible
while records are moved over gradually.

### `hub_documents`

One row per logical document.

- `id uuid primary key`
- `household_id uuid not null`
- `display_title text not null`
- `document_type text not null`
- `document_date date`
- `source_app text not null`
- `processing_status text not null default 'draft'`
- `ai_processing_status text not null default 'not_requested'`
- `extracted_text text`
- `extracted_data jsonb not null default '{}'`
- `user_corrections jsonb not null default '{}'`
- `review_fields jsonb not null default '[]'`
- `confidence numeric`
- `processing_cost_usd numeric not null default 0`
- `retention_status text not null default 'keep'`
- `created_by uuid` (preserved as null if that login is later removed)
- `uploaded_at timestamptz`
- `created_at timestamptz not null default now()`
- `updated_at timestamptz not null default now()`

### `hub_document_files`

One row per stored file or camera page. A PDF remains one unchanged file;
multi-page camera scans use one row per page.

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

### `hub_document_links`

A document can be connected to any number of Higgins Hub records without
duplicating the stored file. Record IDs are stored as text because existing
Travel Journal tables use a mixture of UUID and integer IDs.

- `id uuid primary key`
- `document_id uuid not null`
- `source_app text not null`
- `record_type text not null`
- `record_id text not null`
- `link_role text not null default 'supporting_document'`
- `is_primary boolean not null default false`
- `created_by uuid` (preserved as null if that login is later removed)
- `created_at timestamptz not null default now()`

Add a unique constraint on
`(document_id, source_app, record_type, record_id, link_role)`.

Examples:

- An electric bill can be linked as `travel-journal / electric_bill / <id>`.
- The same bill can later be linked as `finance / expense / <id>`.
- Filing Cabinet can display the document from the shared catalog without
  creating another copy or another link.

## Future Filing Cabinet / File Box

The Filing Cabinet will be a document-management view over `hub_documents`,
`hub_document_files`, and `hub_document_links`. Later additions can include:

- Folders and nested folders
- Tags
- Favorites
- Archive and retention rules
- Full-text and AI-assisted search
- Expiration reminders for registrations, policies, and warranties
- Sharing controls

Those features do not require a new upload system or moving existing files.

## Finance stage

`hub_expenses` and `hub_payments` will be added after shared document storage
is proven with electric bills. They will be linked through
`hub_document_links`, so Travel Journal and Finance display the same expense,
payment, and document rather than creating duplicates.

Electric-bill fields planned for the Finance stage remain:

- Billing-period start and end
- Previous meter reading
- Usage
- Due date
- Expense status and amount
- Payment status, account, check number, mailed date, and cleared date

## Storage

The private `hub-documents` bucket is the shared document store.

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

## Version 0.42.0 boundary

Included:

- Phone camera selection
- Image or PDF selection
- Automatic local cleanup followed by review
- Local image edge estimation, perspective squaring when confidence is high,
  readability enhancement, resizing, and document-specific compression
- PDF preview, intact PDF saving, and a best-effort selectable-text check
- Rotate, replace, retake, and remove
- Flexible multi-page image/PDF documents for electric bills
- Page and file reordering with no arbitrary page-count limit
- Existing electric-bill image attachments remain compatible

Not included:

- AI/OCR calls
- Expense/payment creation

## Version 0.43.0 document review and AI boundary

The Travel Journal now has a reusable Higgins Documents viewer. It opens the
same shared document record used by electric bills today and can later be used
by Finance, Filing Cabinet / File Box, fuel receipts, warranties, and other
Higgins Hub apps.

The viewer includes:

- A large private image/PDF preview
- A page and file rail for multi-file documents
- File name, size, document title, date, and processing status
- An optional “Read this bill” action
- Editable structured suggestions and clear low-confidence review flags
- An explicit handoff into the existing electric-bill editor

The AI reader lives in the Supabase `extract-document` Edge Function. It:

- Requires an authenticated Higgins Hub owner/editor
- Reads files through existing household-scoped Supabase permissions
- Retrieves `OPENAI_API_KEY` only from Supabase secrets
- Uses the OpenAI Responses API with image/PDF inputs and strict structured
  output
- Saves extracted text, structured fields, confidence, review fields, model,
  token use, and estimated cost on the existing `hub_documents` row
- Never exposes the OpenAI key to the browser or GitHub

AI processing remains opt-in and paid. Local capture, edge cleanup, perspective
correction, rotation, compression, preview, upload, storage, and ordinary
document viewing never call OpenAI.

## Version 0.43.1 Lehigh Gorge bill rules

The first document reader now follows the campground's actual bill format:

- Site number is supplied by Travel Journal as Site 39.
- Previous meter comes from the preceding saved electric bill.
- Billing period and due date are not requested because the campground does
  not provide useful values for them.
- The AI reader checks both printed text and handwritten annotations for paid
  date, check number, and amount paid.
- Printed and handwritten values remain suggestions until Scott or Kayla
  reviews and saves the electric record.

## Version 0.48.0 fuel-receipt workflow

Fuel receipts use the same `document-scanner.js`, private `hub-documents`
storage, `hub-document-review.js`, and `extract-document` Edge Function as
electric bills. There is no second capture or cleanup interface.

The fuel profile extracts printed receipt date, station, city, state, fuel
type, gallons, price per gallon, and total cost. For handwriting it reads only values beside the explicit labels
`TRIP` and `ODO`; all other handwritten content is ignored.

Version 0.48.1 makes the full optimized receipt the default fuel workflow.
Automatic perspective cropping remains part of the shared scanner for other
documents, while fuel users can still choose **Adjust crop** manually. This
keeps the successful full-picture reading path and reduces processing time.

The scan is temporarily stored as an unlinked `fuel_receipt` document while
the owner/editor reviews the suggestions. Saving the fuel stop creates the
`fuel_stop` / `receipt_scan` link and records the user's corrections. Cancelling
the entry removes the unlinked draft.

MPG never crosses trip boundaries. The first saved stop in a trip uses trip
meter divided by gallons. Later stops use the difference between the current
and immediately preceding trip-meter values from that same trip.

## Version 0.49.0 DEF and combined receipts

The same fuel-receipt capture, cleanup, private storage, and review workflow now
supports Fuel, DEF, and Fuel + DEF purchases. A combined receipt creates one
`hub_documents` row and links it to both the `fuel_stop` and `def_purchase`
records. Removing either purchase removes only its link; the receipt survives
for the other record.

Fuel remains in `trip_fuel` and continues to be the only source for towing
distance, gallons, and MPG. DEF is stored in `def_purchases`, where trip meter
is intentionally absent. The DEF history can therefore report gallons, cost,
weighted average price, and odometer gaps without contaminating fuel math or
assuming that every purchase was recorded.
