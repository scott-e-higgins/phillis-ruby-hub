# Phillis & Ruby Adventure Hub — Cloud Work Handoff

Prepared July 24, 2026.

## 1. Project status

Adventure Hub is a working, private, mobile-first progressive web app for Scott and Kayla’s RV travel records. It is live, connected to Supabase, installable on their iPhones, and syncing shared data between approved accounts.

- Current app version: `0.19.1`
- Production URL: `https://scott-e-higgins.github.io/phillis-ruby-hub/`
- GitHub repository: `https://github.com/scott-e-higgins/phillis-ruby-hub`
- Production branch: `main`
- Hosting: GitHub Pages
- Supabase organization: `Higgins Hub`
- Supabase project: `adventure-hub`
- Supabase project reference: `jaeuxlgqlbunaecdzofs`
- Supabase URL: `https://jaeuxlgqlbunaecdzofs.supabase.co`
- Frontend publishable key:
  `sb_publishable_l_ghjZrjNRycN8Rxc8L_CQ_gEG6CMnR`

Netlify is no longer the production host. It was abandoned after the free-team credit allowance blocked production deployments. Do not point authentication or deployment work back to the old Netlify URL.

## 2. Users and permissions

Authentication uses Supabase email/password accounts. Public self-registration has been removed from the app. Accounts are created privately in Supabase and then assigned to the Higgins household.

Known users:

- Scott: `scott.e.higgins@me.com` — owner/full access.
- Kayla: full access (`editor`). Her email and password are intentionally not recorded in the repository or this handoff.
- Kayla’s mother: `mjweidick@icloud.com` — `viewer`/Family Viewer.

Passwords are intentionally unknown to the codebase and must never be committed.

Roles:

- `owner`: full read/write access.
- `editor`: full read/write access.
- `viewer`: read-only access to current and upcoming trip itineraries only.

The Family Viewer can see current/upcoming trip names, dates, destinations, campground/host details, check-in/check-out times, and the applicable trip/stay photos. The viewer cannot see costs, fuel, Ruby or Phillis records, Lehigh Gorge finances/electric, past trips, shared Notes, or editing controls.

The current UI only offers Sign In. It says, “Accounts are created privately by Scott.” There is no public Create Account button and no active in-app invitation-code workflow.

## 3. Supabase work completed

### Authentication and URL configuration

- Email/password authentication is working.
- GitHub Pages is the current production origin.
- The intended Site URL/redirect URL is:
  `https://scott-e-higgins.github.io/phillis-ruby-hub/`
- Users can change their own password from the app.
- Password recovery handling exists in `cloud.js`.
- Authenticated users without a `household_members` record are stopped at an “awaiting access approval” screen.

### Household security

The production database includes:

- `households`
- `household_members`

Every shared top-level record is associated with the Higgins household. Row Level Security is enabled. Owners and editors can work with household data. Family Viewers use a restricted security-definer function instead of receiving broad table access.

The active viewer function is:

```sql
public.get_family_itinerary_v4()
```

It only returns trips where:

```sql
t.end_date >= current_date
```

The function includes current/upcoming trip data, campground/host data, check-in/check-out times, stay-photo paths, and the trip’s On the Road Again photo path. It does not return costs, fuel, maintenance, seasonal-site records, private notes, or past trips.

### Storage

Two private Supabase Storage buckets exist:

- `stay-photos`
- `trip-photos`

Storage object paths start with the household UUID:

```text
<household-id>/<record-id>/<filename>
```

All household members may read their household’s photos. Only owners/editors may insert, update, or delete them. The app creates signed URLs valid for seven days.

Phone photos are compressed in the browser to a maximum dimension of 1800 pixels and JPEG quality 0.84 when possible. The fallback upload limit is 12 MB. JPEG, PNG, WebP, HEIC, and HEIF are allowed by the buckets.

### Data migration

The historical Phillis Numbers/PDF data was imported successfully.

The last explicitly verified record counts were:

- `trips`: 24
- `campground_stays`: 45
- `trip_fuel`: 75
- `vehicles`: 2
- `maintenance`: 6
- `seasonal_sites`: 1
- `site_seasons`: 6
- `seasonal_payments`: 12
- `electric_bills`: 25

Those counts were verified before subsequent live testing, so the production totals may now be slightly higher.

The two primary vehicles are:

- Ruby — 2025 Ford F-250 Tremor, diesel, active.
- Phillis — 2026 Brinkley i265 travel trailer, active.

Lehigh Gorge Campground, Site 39, is a seasonal site with seasons, payments, and electric readings stored separately.

## 4. Database schema

All business tables use RLS. The original schema snapshot predates several later columns; the list below reflects the current application contract and the applied feature migrations.

### `households`

Top-level shared household.

Required application fields:

- `id uuid` primary key
- `name text`
- timestamps

### `household_members`

Joins a Supabase Auth user to a household.

Required application fields:

- `household_id uuid` → `households.id`
- `user_id uuid` → `auth.users.id`
- `role text` — `owner`, `editor`, or `viewer`
- timestamps as configured in production

### `vehicles`

- `id uuid` primary key, default `gen_random_uuid()`
- `household_id uuid` → `households.id`
- `name text not null`
- `vehicle_type text not null`
- `fuel_type text null`
- `year integer null`
- `make text null`
- `model text null`
- `notes text null`
- `is_active boolean not null default true`
- `created_at timestamptz not null default now()`
- `updated_at timestamptz not null default now()`

### `trips`

- `id uuid` primary key, default `gen_random_uuid()`
- `household_id uuid` → `households.id`
- `name text not null`
- `destination_name text not null`
- `start_date date not null`
- `end_date date not null`
- `status text not null default 'planned'`
- `notes text null`
- `tow_vehicle_id uuid null` → `vehicles.id`
- `rv_id uuid null` → `vehicles.id`
- `on_road_photo_path text null`
- `created_at timestamptz default now()`
- `updated_at timestamptz default now()`

Trip names are treated as unique by the UI without regard to capitalization. If a duplicate is entered, the app shows the existing trip and dates and asks the user to change the name.

### `campground_stays`

- `id uuid` primary key, default `gen_random_uuid()`
- `trip_id uuid not null` → `trips.id`
- `campground_name text not null`
- `arrival_date date not null`
- `checkout_date date not null`
- `check_in_time time null`
- `check_out_time time null`
- `site_number text null`
- `cost numeric null`
- `reservation_number text null`
- `address text null`
- `city text null`
- `state text null`
- `postal_code text null`
- `stay_type text not null`, with a safe default of `campground`
- `site_photo_path text null`
- `sign_photo_path text null`
- `notes text null`
- `created_at timestamptz not null default now()`
- `updated_at timestamptz not null default now()`

Canonical app stay-type values:

- `campground`
- `harvest-host`
- `moochdocking`
- `boondocking`

Important history: cloud saving once failed because `stay_type` was null while the database required a value. The database/default and app payload were corrected. Preserve the default and continue sending an explicit value.

### `trip_fuel`

- `id uuid` primary key, default `gen_random_uuid()`
- `trip_id uuid not null` → `trips.id`
- `fuel_date date not null`
- `station text null`
- `location text null`
- `city text null`
- `state text null`
- `odometer numeric null`
- `trip_meter numeric` (historical imported rows may be incomplete)
- `gallons numeric not null`
- `total_cost numeric not null`
- `fuel_type text not null`
- `notes text null`
- `created_at timestamptz not null default now()`
- `updated_at timestamptz not null default now()`

The app stores odometer and truck trip-meter readings. MPG and price per gallon are calculated, not stored. Historical trips include gasoline vehicles; do not assume every row is diesel. `location` is retained for backward compatibility, while current forms and displays use the separate `city` and `state` fields.

### `maintenance`

- `id bigint` primary key/identity as configured in production
- `vehicle_id uuid not null` → `vehicles.id`
- `date date not null`
- `odometer numeric null`
- `description text not null`
- `cost numeric not null`
- `vendor text null`
- `notes text null`
- `record_type text` — `maintenance` or `upgrade`
- `created_at timestamptz not null default now()`
- `updated_at timestamptz not null default now()`

One table serves Ruby and Phillis. `record_type` separates maintenance/repairs from upgrades. The UI intentionally uses a free-text description rather than maintenance categories.

### `seasonal_sites`

- `id uuid` primary key, default `gen_random_uuid()`
- `household_id uuid` → `households.id`
- `name text not null`
- `location text null`
- `site_number text null`
- `notes text null`
- `is_active boolean not null default true`
- `created_at timestamptz not null default now()`
- `updated_at timestamptz not null default now()`

The live record is Lehigh Gorge Campground, Site 39.

### `site_seasons`

- `id uuid` primary key, default `gen_random_uuid()`
- `seasonal_site_id uuid not null` → `seasonal_sites.id`
- `year integer not null`
- `annual_fee numeric`
- `start_date date null`
- `end_date date null`
- `notes text null`
- `created_at timestamptz not null default now()`
- `updated_at timestamptz not null default now()`

### `seasonal_payments`

- `id bigint` primary key/identity as configured in production
- `season_id uuid not null` → `site_seasons.id`
- `payment_date date not null`
- `amount numeric not null`
- `check_number text null`
- `notes text null`
- `created_at timestamptz not null default now()`
- `updated_at timestamptz not null default now()`

### `electric_bills`

- `id uuid` primary key, default `gen_random_uuid()`
- `season_id uuid not null` → `site_seasons.id`
- `bill_date date not null`
- `meter_reading numeric not null`
- `amount numeric not null`
- `rate numeric`
- `payment_date date null`
- `check_number text null`
- `notes text null`
- `created_at timestamptz not null`
- `updated_at timestamptz not null`

The app stores the current meter reading and calculates usage from the prior reading. It also stores the rate, calculated bill amount, payment date, and check number.

### `hub_notes`

- `id uuid` primary key, default `gen_random_uuid()`
- `household_id uuid not null` → `households.id` on delete cascade
- `title text not null`
- `body text null`
- `created_at timestamptz not null default now()`
- `updated_at timestamptz not null default now()`

Only owners and editors may select or modify shared Notes. Family Viewers cannot see the Notes tab or query this table.

Checklist notes are stored in the body as plain text:

```text
- [ ] Incomplete item
- [x] Completed item
```

This intentionally avoids a separate checklist-item table for now.

### Relationships

```text
households
├── household_members ── auth.users
├── vehicles
│   └── maintenance
├── trips
│   ├── campground_stays
│   └── trip_fuel
├── seasonal_sites
│   └── site_seasons
│       ├── seasonal_payments
│       └── electric_bills
└── hub_notes

trips.tow_vehicle_id ── vehicles.id
trips.rv_id ─────────── vehicles.id
```

## 5. Product and design decisions

### Identity and appearance

- Brand: `Phillis & Ruby Adventure Hub`
- Tone: personal adventure journal plus practical RV recordkeeping.
- Colors: dark forest green, cream/warm neutrals, cranberry red accents, restrained brass/gold.
- Cards were intentionally made more square than the early prototype, generally using 8–12 px corner radii.
- The logo/app icon is a cartoon-style side-angle depiction of Ruby towing Phillis, based on the provided photo.
- Phillis is a Brinkley i265 travel trailer, not a fifth wheel. Do not depict a fifth wheel in future artwork.

### Navigation

Bottom navigation:

```text
Home | Trips | Phillis | Ruby | Notes
```

`More` remains available through the header menu. Family Viewers do not see Notes and are kept in their restricted itinerary experience.

### Home screen

- The next two upcoming trips appear as compact side-by-side countdown cards.
- If a trip is active, it becomes a full-width cranberry card above the upcoming trips.
- Countdown/active cards are tappable and open trip details.
- Quick actions are intentionally limited to Add Trip and Add Fuel.
- There is pull-down-to-refresh plus a dependable refresh button in the header.

### Trips and fuel

- Trips are the organizing unit for travel records.
- Trips are listed by actual start date going backward from the furthest future.
- Home determines the next one or two trips by date.
- Add Fuel uses a trip dropdown and should automatically select the active/current trip when one exists.
- Campground/host stays live inside their trip rather than as a separate primary navigation area.
- Trip cards may show a small On the Road Again photo to the right of the title with its caption below the image.
- A trip detail page contains itinerary/stays, fuel stops, totals, notes, and photos.

### Campgrounds and hosts

Every stay may include:

- campground or host name
- arrival and checkout dates
- check-in and check-out times
- address/location
- site number
- stay type
- cost
- notes
- a small `Campsite` photo
- a small `Sign` photo

The two photo thumbnails appear between the campground/host information and the amount. They are intentionally small, match the card shape, have space between them, use captions below the images, and can be tapped to open larger.

The long-term direction is to turn each campground/host name into a rich campground-journal card that replaces Kayla’s physical campground book. That is not built yet.

### Phillis

Dedicated sections:

- maintenance and repairs
- upgrades
- Lehigh Gorge Site 39

Lehigh Gorge is its own mini-area because it is Phillis’s seasonal home base. Seasonal fees and electric are separate but grouped by season/year.

### Ruby

Dedicated sections:

- maintenance/service
- upgrades/modifications
- trip fuel history

Historical fuel data predates Ruby and includes gasoline tow vehicles.

### Notes

- Shared only between Scott and Kayla/full-access accounts.
- Notes are cloud-synced and newest-updated first.
- Tapping a note card opens the editor immediately; there is no second Edit step.
- Notes can be ordinary text or checklists.
- Notes can be deleted from the editor.
- Version `0.19.1` added an installed-app update check because Kayla’s Home Screen copy temporarily retained an older note behavior.

### iPhone/PWA behavior

- Installable from Safari with a custom Home Screen icon.
- Uses `viewport-fit=cover`.
- Includes Dynamic Island/status-bar safe-area corrections specifically for installed-app mode.
- Inputs are at least 16 px to prevent iPhone auto-zoom.
- Horizontal overflow is constrained.
- `version.json` is checked when the page is shown or becomes visible. If the version differs, the app reloads with a version query parameter.
- The connected-account status shows the current app version.
- There is currently no service worker; update reliability is handled with versioned assets, cache-control metadata, `version.json`, and the manifest start URL.

### Data reliability

- Supabase is the shared source of truth.
- A browser copy is retained as a safety backup.
- JSON Export Backup and Import Backup remain available.
- Do not remove browser fallback or backup features until a separate backup/restore strategy is deliberately approved.

## 6. Files in the current project

Core files:

- `index.html` — application shell, navigation, dialogs, authentication gate, PWA metadata.
- `styles.css` — responsive mobile UI, branding, safe-area fixes, viewer hiding rules, photo/note/checklist styling.
- `app.js` — rendering, forms, navigation, trip logic, active/upcoming countdowns, notes/checklists, local backup, refresh/update behavior.
- `cloud.js` — Supabase client, sign-in, password management/recovery, household membership lookup, role activation.
- `cloud-store.js` — Supabase load/save adapter, row mapping, photo upload/removal, viewer RPC loading.
- `supabase-config.js` — public Supabase URL and publishable key.
- `manifest.webmanifest` — installable PWA metadata and icon references.
- `version.json` — current release version for installed-app update checks.
- `README.md` — complete release history through the current version.
- `netlify.toml` — historical hosting configuration; not used by current GitHub Pages production.

Database delta files:

- `database-add-stay-times.sql`
- `database-add-stay-photos.sql`
- `database-add-trip-photos.sql`
- `database-add-hub-notes.sql`
- `database-add-fuel-city-state.sql`

Icons:

- `icons/adventure-hub-icon-1024.png`
- `icons/apple-touch-icon.png`
- `icons/favicon-32.png`
- `icons/icon-192.png`
- `icons/icon-512.png`

The remote GitHub repository also contains `.nojekyll` for GitHub Pages.

## 7. Credentials and configuration still needed for cloud development

Nothing secret is needed to run the already deployed frontend. The Supabase URL and publishable key are intentionally public and already committed in `supabase-config.js`.

For a new cloud Work conversation to make and publish code changes, it needs:

1. Read/write access to `scott-e-higgins/phillis-ruby-hub` on GitHub, or a user-approved workflow for Scott to merge/upload changes.
2. Supabase Dashboard access if production SQL, Auth users, RLS policies, RPCs, or Storage configuration must be inspected or changed.
3. If command-line Supabase administration is desired, a Supabase personal access token and project linking would be needed. None is currently committed.

Secrets deliberately not available:

- Supabase database password
- Supabase service-role key
- user passwords
- Auth user UUIDs
- the Higgins household UUID

Never place the service-role key, database password, or user passwords in frontend files or GitHub.

## 8. Important gaps and cautions

- The live production database is working, but the repository does not yet contain one consolidated, authoritative schema export covering the base tables, household security, all current columns, constraints, policies, functions, triggers, and storage configuration.
- The four SQL files in the repository are incremental feature migrations, not a complete disaster-recovery schema.
- Do not rebuild, drop, rename, or “clean up” production tables from the older pasted schema snapshot. Several columns were added later.
- Do not run destructive SQL without first obtaining a read-only export and comparing it with the current application mappings.
- The production data belongs to Scott and Kayla. Preserve all existing records and unrelated changes.
- GitHub Pages, not Netlify, is production.

## 9. Exact next step

Start the new cloud Work conversation with this instruction:

> Open `https://github.com/scott-e-higgins/phillis-ruby-hub` on `main` and verify that the baseline is Adventure Hub v0.19.1. Do not redesign or recreate the app. First, perform a read-only inventory/export of the live Supabase schema for project `jaeuxlgqlbunaecdzofs`, including tables, columns, defaults, constraints, foreign keys, indexes, RLS policies, functions, triggers, grants, and the two Storage buckets. Use that verified export to add `docs/database-schema.md` and a safe, idempotent consolidated schema/migration reference to the repository. Make no destructive production changes. Then validate the current app and wait for Scott’s next feature request.

This is the safest next move because the app itself is presently working. Capturing the actual live schema closes the largest remaining documentation/recovery gap before additional features are added.
