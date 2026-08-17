# Phillis & Ruby Travel Journal

Travel Journal is Scott and Kayla's private travel companion.

## Version 0.50.2

- Treats a minus-signed Open Roads **Total Paid** charge as the positive amount spent.
- Makes saved Open Roads pricing directly editable without uploading the screenshot again.
- Separates **Edit pricing** from **Replace screenshot** so each action does exactly what it says.
- Prevents the saved Open Roads screenshot card and helper text from crowding or covering nearby fields.

## Version 0.50.1

- Keeps Open Roads settlement controls hidden unless **Open Roads** is selected.

## Version 0.50.0

- Adds an optional **Discount Program** choice to existing fuel entries; normal fuel remains the default and unchanged.
- Marks Open Roads pump purchases as **Pricing Pending** until the later Transaction Details screenshot is reviewed.
- Stores the original pump receipt and the Open Roads settlement separately on the same fuel stop.
- Uses confirmed Open Roads **Total Paid** for fuel costs while preserving pump price, pump total, gallons, TRIP, ODO, trip linking, and MPG calculations.
- Warns before attaching a settlement when its date, gallons, unit price, or subtotal does not match the open fuel stop.
- Requires `database-add-open-roads.sql` and the updated `extract-document` Supabase Edge Function.

## Version 0.49.5

- Makes **Read bill** immediately upload and open the secure reader for a brand-new electric bill too.
- Keeps the new bill as a temporary private draft until the reviewed values are saved.
- Removes an unused bill draft automatically when the entry is cancelled.

## Version 0.49.4

- Makes **Read bill** immediately upload and open the secure reader when adding a scan to an existing electric bill.
- Makes the queued next step explicit for a brand-new bill with a highlighted **Save & read bill** action.
- Keeps the full electric-bill image by default so automatic perspective correction cannot twist the page; manual crop remains available.

## Version 0.49.3

- Restores automatic paper-edge detection and perspective cropping for fuel and DEF receipt photos.
- Uses the largest connected light document area so nearby table surfaces and reflections are less likely to become receipt corners.
- Keeps Adjust crop available whenever the automatic boundary needs a quick correction.

## Version 0.49.2

- Makes Everyday Ruby a true no-trip fuel entry with no trip or trip-meter requirement.
- Keeps trip-meter and MPG fields only when an actual trip is selected.
- Shortens the everyday fuel/DEF form and moves optional time and street-address fields under More receipt details.
- Stops date changes from unexpectedly assigning an Everyday Ruby purchase to a trip.
- Waits for both gallons and total before calculating price per gallon and keeps empty MPG values blank.

## Version 0.49.0

- Extends the existing fuel scanner and form to support Fuel, DEF, and Fuel + DEF purchases.
- A combined receipt is scanned once and linked to separate fuel and DEF records.
- DEF never enters fuel gallons, towing distance, or MPG calculations.
- Adds DEF gallons, price, total, odometer, optional trip association, receipt history, and useful DEF totals.
- Updates the secure reader so purchase type and separate DEF values can be reviewed and corrected before saving.
- Requires `database-add-def-purchases.sql` and the updated `extract-document` Supabase Edge Function.

## Version 0.48.5

- Gives electric-bill scans the same Cancel, Use document, and Read bill choices as fuel receipts.
- Use document attaches the page or PDF without making an AI request.
- Read bill starts the secure reader automatically after the completed multi-page bill is saved.
- Replacing or adding bill pages clears stale extraction results so the updated document can be read accurately.

## Version 0.48.4

- Gives fuel-receipt scans three clear choices: Cancel, Use photo, or Read receipt.
- Use photo securely attaches the optimized receipt while leaving all fuel fields available for manual entry.
- Read receipt attaches the same photo and then starts the optional AI reader.

## Version 0.48.3

- Keeps the scanner open with a clear saving message instead of dropping back
  to the fuel form during the upload handoff.
- Starts the receipt reader immediately after **Use photo & read receipt**;
  manual re-reads still require confirmation.
- Reduces fuel-receipt image size slightly while preserving text readability.
- Shortens cloud preparation by saving independent pieces together and lets
  the secure reader use a short-lived private image link instead of rebuilding
  the receipt as a large encoded request.

## Version 0.48.2

- Polishes the faster fuel-receipt camera and photo-picker prompts.
- Ensures installed copies fetch the final streamlined scanner files.

## Version 0.48.1

- Moves **Take or add receipt** to the top of the fuel-stop form while keeping
  the saved receipt at the bottom of the completed record.
- Removes fuel time, street address, and receipt-number entry and review fields;
  fuel location is now just city and state.
- Uses a faster full-image optimization path for fuel receipts because it read
  the complete receipt more reliably in real use. Manual **Adjust crop** remains
  available when a picture genuinely needs trimming.

## Version 0.48.0

- Reuses the Higgins Hub scanner for fuel receipts, including camera capture,
  cleanup, cropping, enhancement, preview, private storage, and secure AI
  reading.
- Extracts printed station, date, location, fuel, gallons, price, and total
  fields plus only the handwritten TRIP and ODO labels.
- Highlights uncertain suggestions before they can populate the fuel stop.
- Calculates the first stop's trip MPG and later stops' tank miles and tank MPG
  using only earlier fuel stops from the same trip.
- Requires `database-add-fuel-receipt-scanner.sql` and the updated
  `extract-document` Supabase Edge Function before the web files are published.

## Version 0.47.1

- Keeps Mom's view-only account completely read-only during startup and refresh.
- Prevents cached browser data or background migrations from attempting a cloud
  save when private vehicle and seasonal-site records are intentionally hidden.

## Version 0.47.0

- Corrects the installed iPad layout after rotating into landscape so the app
  shell and bottom navigation remain inside the visible screen.
- Allows the installed Journal to use either portrait or landscape orientation.
- Displays campground stays, fuel stops, plans and reservations, seasonal
  documents, and other dated record histories newest first.

## Version 0.46.1

- Lets every travel year remain collapsed at the same time.
- Stops the newest year from automatically reopening when the last open year is
  closed.
- Keeps year searching and individual expand/collapse controls unchanged.

## Version 0.46.0

- Adds a complete digital campground-book form inside every campground or host
  visit.
- Keeps permanent facility information with the campground while preserving
  campsite, local-area, connectivity, rating, and return notes for each visit.
- Reuses the stay's dates, site information, cost, photos, and existing notes.
- Adds clear Not Started, Draft, and Completed states throughout the Campground
  Log.
- Keeps all detailed campground-book information private to owners and
  full-access editors.

## Version 0.45.0

- Adds a Trips / Campground Log switch without changing the bottom navigation.
- Builds a searchable collection of the 42 campgrounds and hosts already linked
  to the Journal's 52 stays.
- Shows each place's location, most recent visit, visit count, photos, and
  complete stay history.
- Establishes one reusable campground profile plus visit-specific journal data,
  ready for the detailed digital campground-book form.
- Keeps the Campground Log private to owners and full-access editors.

## Version 0.44.2

- Keeps the current trip as the navigation parent when opening one of its
  campground stays, fuel stops, plans, or linked notes.
- Closing, cancelling, or backing out of the inner record now returns to that
  same trip instead of dropping back to the complete trip list.

## Version 0.44.1

- Corrects trip and yearly distance/MPG totals by treating Ruby's trip meter as
  a cumulative trip reading instead of adding every fuel-stop reading together.
- Shows a useful trip-MPG estimate while entering fuel.
- Safely removes a deleted season's payments, electric bills, documents, and
  stored receipt files together.
- Gives narrow-phone countdown cards enough room to prevent overlapping text.
- Updates the in-app history link to the current release.

## Version 0.44.0

- Adds a compact Seasonal documents section inside every Lehigh Gorge year.
- Saves welcome letters, registration forms, and other yearly paperwork as
  reusable Higgins Documents linked to the season.
- Accepts camera scans, existing pictures, and intact PDFs, including
  multi-page documents without an arbitrary page limit.
- Keeps document cleanup local and does not trigger paid AI processing.

## Version 0.43.3

- Calculates electric usage automatically as current meter minus previous meter.
- Usage no longer depends on the paper bill printing a separate kWh value.

## Version 0.43.2

- Preserves automatic Site 39 and previous-meter values when the bill reader
  correctly returns no paper value for those fields.

## Version 0.43.1

- Treats Lehigh Gorge as Site 39 automatically instead of asking AI to find a
  site number that the bill never prints.
- Loads the previous meter from the prior electric-bill record instead of
  expecting it on the new paper bill.
- Removes unused billing-period and due-date review fields.
- Reads handwritten paid date, check number, and amount paid and presents them
  as reviewable suggestions before saving.

## Version 0.43.0

- Opens each saved electric bill in a reusable Higgins Documents viewer with a
  large preview, page/file rail, PDF support, file details, and processing
  status.
- Adds an explicit, paid “Read this bill” action. Capture, cleanup, preview,
  upload, storage, and ordinary viewing remain local/free of OpenAI calls.
- Sends private document bytes only through a signed-in Supabase Edge Function;
  the OpenAI key is never placed in browser code or GitHub.
- Returns structured bill suggestions with field-level review warnings and
  requires Scott or Kayla to review and save them before the electric record
  changes.
- Records the model, token usage, and estimated cost on the shared document so
  monthly AI stats can be calculated from Supabase.
- Adds an editable Amount Due field to preserve the printed bill total when it
  differs from a simple usage-times-rate calculation.

## Version 0.42.1

- Makes the four-step scanner indicator follow the actual choose, prepare,
  review, and add stages.
- Uses clearer electric-bill wording and an explicit “Save bill” action.
- Hides unnecessary ordering arrows when a bill has only one file.
- Explains when removal or reordering is pending until the bill is saved.
- Keeps all document storage and multi-page behavior unchanged.

## Version 0.42.0

- Lets one electric bill contain any practical number of scanned pages, images,
  and intact PDF files without an arbitrary page-count limit.
- Keeps every page or PDF under one reusable Higgins Documents record.
- Allows pages and files to be reordered or removed before saving.
- Continues cleaning and compressing scanned images locally while preserving
  PDFs without paid AI processing.
- Preserves existing single-page electric-bill scans and requires no database
  migration.

## Version 0.41.3

- Sorts Lehigh Gorge seasonal-site payments from newest to oldest.
- Sorts electric bills from newest to oldest within each season.
- Uses the same newest-first order in the season detail view.

## Version 0.41.2

- Combines activity pictures and PDF documents into one “Pictures & PDFs”
  attachment area.
- Uses one file picker that accepts pictures, PDFs, or a mixture of both.
- Keeps the phone-camera shortcut for taking a new picture.
- Shows saved pictures and PDFs together in the activity detail view while
  preserving their proper private storage behind the scenes.

## Version 0.41.1

- Allows up to six separate PDF documents on one trip activity or reservation.
- Lets each PDF be opened or removed individually without disturbing the others.
- Preserves every multi-page PDF intact and keeps existing single-PDF records working.
- Uses the existing private Higgins Documents storage with no database migration
  and no paid AI calls.

## Version 0.41.0

- Adds one private PDF attachment to every trip activity or reservation.
- Preserves the original PDF, including all of its pages, instead of
  converting it into pictures.
- Opens saved PDFs from the activity detail card in the phone or computer's
  normal PDF viewer.
- Stores activity PDFs in Higgins Documents so a future Filing Cabinet can
  display the same underlying document without copying it.
- Keeps the existing six confirmation pictures available alongside the PDF.
- Makes no paid AI calls.

## Version 0.40.0

- Adds the reusable Higgins Documents database foundation for Travel Journal,
  a future Finance app, and a future Filing Cabinet / File Box.
- Connects electric-bill attachments to the shared document catalog while
  preserving the existing receipt image as a safe fallback.
- Catalogs the existing July 2026 electric-bill scan without copying or moving
  the stored file.
- Adds the shared document bucket to storage-usage reporting.
- Keeps all document cleanup local and makes no paid AI calls.

## Version 0.39.3

- Simplified scanning to take or choose, automatic cleanup, review, and attach.
- Removed the duplicate empty-document panel after a file is selected.
- Kept rotation and precise four-corner cropping available only when needed.

## Version 0.39.2

- Made the four manual crop corners track touch and pointer movement reliably on iPhone and iPad.
- Clarified the preview when a manual crop has been applied.

## Version 0.39.1

- Tightened automatic document-edge crops so background slivers are less likely to remain.
- Added a four-corner manual crop editor for scans that need an exact paper boundary.

## Version 0.39.0

- Introduces the reusable Higgins Hub scanner inside Lehigh Gorge electric
  bills without changing the production database.
- Supports phone-camera capture, existing images, and PDF selection.
- Shows the original file before processing and supports replace, retake,
  rotate, remove, and final preview.
- Performs document-image cleanup locally: best-effort paper-edge detection,
  perspective squaring, readability enhancement, resizing to a 2,400-pixel
  maximum dimension, and document-specific JPEG compression.
- Preserves PDFs as PDFs, previews them without conversion, and performs a
  best-effort check for existing selectable text.
- Does not call OpenAI or any other paid AI service.
- Keeps the existing electric-bill image-saving path working while the shared
  document, expense, and payment schema is reviewed.
- Documents the proposed reusable architecture in
  `HIGGINS_SCANNER_ARCHITECTURE.md`.

## Someday roadmap

- **Native Apple Calendar integration (preferred):** Add a future iPhone
  companion using Apple's EventKit framework so Travel Journal trips and
  campground stays and trip plans can be written directly to the existing
  shared Phillis calendar. Include dates, check-in and checkout times,
  locations, site and reservation details, notes, and a link back to the trip.
  Both Scott and Kayla
  would then see the events through the shared iCloud calendar. A private,
  read-only calendar subscription remains a fallback if a native companion is
  not pursued.

## Version 0.38.0

- Adds chronological **Plans & reservations** inside every trip.
- Stores activity type, reservation status, date and time, location, clickable
  address, confirmation code, cost, website or ticket link, and notes.
- Adds up to six automatically compressed pictures for confirmations, tickets,
  reservations, and supporting documents.
- Keeps costs, confirmation codes, private notes, links, and uploaded documents
  hidden from Family Viewer accounts.
- Shows Family Viewers the useful itinerary details: activity name, type,
  status, date, time, and location.

## Version 0.37.0

- Adds a reversible Archive/Restore option to shared notes.
- Removes archived notes from Home and the everyday Notes list.
- Keeps archived notes available in a separate collapsible archive.
- Continues showing archived notes inside any trip to which they are linked.
- Moves linked notes between Campgrounds & hosts and Fuel stops in trip details.

## Version 0.36.1

- Removes the completed one-time stored-picture optimizer from the More page.
- Keeps automatic optimization active for every newly added picture and
  receipt.

## Version 0.36.0

- Adds cloud-synced pinned notes.
- Sorts pinned notes above unpinned notes while keeping each group ordered by
  most recently edited.
- Guarantees every pinned note appears on Home, then fills the list to at least
  three notes with the latest unpinned notes.
- Adds an optional related-trip selection to notes and shows those notes inside
  the relevant trip card.
- Keeps all shared notes private to owners and editors, including trip-linked
  notes.

## Version 0.35.2

- Compresses future pictures and receipt images to a maximum 1,400-pixel
  dimension at 78% JPEG quality.
- Adds a safe stored-picture optimizer that keeps every image attached to its
  existing record and replaces it only when the optimized copy is smaller.

## Version 0.35.1

- Shows storage as usage out of the Supabase Free plan's 1 GB allowance.
- Shows Travel Journal record data out of the 500 MB database allowance.
- Adds percentage-used bars to both totals.

## Version 0.35.0

- Adds a Journal stats card near the update history.
- Shows uploaded storage usage, Travel Journal record-data size, current-month
  AI usage, receipt/document count, and travel/note picture count.
- Starts AI usage at zero and leaves the display ready for the future receipt
  reader.

## Version 0.34.2

- Sizes the installed iPhone app to the full device screen instead of Safari's
  shorter browser viewport.
- Removes the unused Safari-bar space below the bottom navigation while keeping
  the notch and Home-indicator safe areas.

## Version 0.34.1

- Anchors the app shell to all four edges of the installed iPhone viewport.
- Removes the empty strip that could appear beneath the bottom navigation.
- Fully hides the pull-to-refresh prompt until a downward gesture begins.

## Version 0.34.0

- Moves all page content into a dedicated scrolling region.
- Keeps the bottom navigation outside that region so iPhone and iPad Safari
  cannot reposition it in the middle of the screen.
- Preserves pull-to-refresh and resets the internal scroll position when
  changing sections.

## Version 0.33.9

- Stabilizes the fixed bottom navigation during iPad Safari and installed-app scrolling.
- Keeps the existing grass treatment while avoiding iOS fixed-layer rendering glitches.

## Version 0.33.8

- Replaces the generic green pickup emoji on Ruby's Upgrades row.
- Uses a custom Ruby-red pickup illustration that stays consistent across devices.

## Version 0.33.7

- Replaces the simplified line patterns with mockup-matched botanical textures.
- Uses layered oversized leaf skeletons and natural branching veins in the header.
- Uses fine meadow grass and delicate stems in the bottom navigation.
- Keeps both treatments dark, readable, and lightweight for phones.

## Version 0.33.6

- Adds oversized, flowing leaf veins to the forest-green header.
- Adds low-contrast grass silhouettes to the fixed bottom navigation.
- Keeps the branding, controls, and navigation labels clear and readable.
- Preserves the chunky pine-bark page canvas and existing card colors.

## Version 0.33.5

- Introduced the responsive botanical pattern assets used by the header and navigation.

## Version 0.33.4

- Replaced the fine bark grain with a real chunky pine-bark texture.
- Uses broad bark plates, deep vertical fissures, and dark brown tonal variation.
- Compresses the background asset and darkens it behind the interface for readability.
- Keeps the green header smooth, the card colors unchanged, and the header dots removed.

## Version 0.33.3

- Added a restrained vertical tree-bark grain to the brown page canvas.
- Used dark-on-dark variation so the texture remains behind the content.
- Kept the green header smooth, the card colors unchanged, and the header dots removed.

## Version 0.33.2

- Removed the embossed texture from the page and header.
- Returned to a smooth medium-brown canvas and a clean forest-green header.
- Preserved the distinct card colors, rounded corners, and dot-free header.

## Version 0.33.1

- Strengthened the leather grain so it remains visible on real phone and desktop screens.
- Added layered pebble embossing and cross-grain variation to the chocolate canvas.
- Carried a quieter version of the same texture into the forest-green header.
- Kept the decorative header dots removed and preserved all existing card colors.

## Version 0.33.0

- Replaced the flat green page canvas with a warm, medium-deep chocolate background.
- Added a subtle journal/leather grain to the brown canvas and forest-green header.
- Preserved the existing distinct gray, gold, green, and green-gray card colors.
- Removed the decorative pink and purple dot clusters from the right side of the header.

## Version 0.32.1

- Added a dedicated **Take photo** button to fuel receipts and electric bills.
- Added the same camera option to maintenance, upgrade, and seasonal-fee documents.
- Existing **Choose photo(s)** buttons remain available for pictures already on the phone.

## Version 0.32.0

- Adds **No trip · Everyday Ruby** to the fuel form for ordinary driving.
- Automatically selects the active trip while traveling and otherwise defaults
  to Everyday Ruby.
- Keeps Everyday Ruby fuel in Ruby's fuel history and recent records without
  adding it to any trip's mileage, MPG, or fuel-cost totals.
- Adds one optional receipt photo to fuel stops and electric bills.
- Ruby and Phillis maintenance, upgrades, and seasonal-fee payments can each
  hold up to six receipt or document pictures.
- Lets Scott and Kayla take a new picture or choose an existing receipt,
  invoice, work order, or bill from the phone's photo library.
- Compresses the pictures before storing them privately in Supabase.
- Shows a small tappable receipt thumbnail beneath the record details.
- Lets the receipt be replaced or removed while editing its record.
- Keeps all receipts unavailable to Family Viewer accounts.
- Removes an attached receipt from storage when its record is deleted.

Run these files in Supabase before publishing this version:

1. `database-allow-everyday-fuel.sql`
2. `database-add-record-receipts.sql`

## Version 0.31.2

- Makes every fuel stop listed inside a trip tappable, matching campground
  stays and other records.
- Opens a dedicated fuel-stop detail view instead of showing a separate Edit
  button in the trip list.
- Adds **Back to trip**, **Edit fuel stop**, and **Delete fuel stop** actions
  inside that detail view.

## Version 0.31.1

- Replaces the incorrect **Delete note** button in an edited fuel stop with
  **Delete fuel stop**.
- Deletes that exact fuel record from both the trip and shared cloud data.
- Keeps the Notes-specific delete action hidden for every other record type.

## Version 0.31.0

- Replaces the single fuel-stop location field with separate City and State
  fields.
- Uses the same 50-state abbreviation dropdown as campground stays.
- Separates existing `City, ST` fuel locations automatically, preserving all
  historical fuel records.
- Shows City and State as distinct rows in fuel-stop details.

## Version 0.30.4

- Adds Ruby's and Phillis II.0's license plates directly above their VINs on
  the Rig page.
- Keeps license plates in the same owner/editor-only Supabase record as the
  VINs instead of embedding them in the public app source.
- Keeps Family Viewer accounts from receiving either private identifier.

## Version 0.30.3

- Styles state dropdowns to match the height, border, background, and spacing
  of the surrounding stay fields.
- Selecting Harvest Host, moochdocking, or boondocking still changes the cost
  to zero, but the cost remains editable afterward.

## Version 0.30.2

- Adds ZIP code to the popup trip-stay form and the standalone stay editor.
- Saves ZIP codes to the existing Supabase postal-code field.
- Replaces free-typed stay states with a dropdown containing all 50 two-letter
  state abbreviations.
- Keeps city, state, ZIP, site number, and cost clearly separated.

## Version 0.30.1

- Corrects the Harvest Host value sent to Supabase so it matches the database
  constraint.
- Recognizes both the database and app spellings when loading older records.
- Recovers a newly entered trip or stay that was kept in the browser after a
  cloud-sync failure, then retries the cloud save automatically.

## Version 0.30.0

- Opens each trip stay in a focused popup instead of stacking full stay forms
  inside the trip form.
- Returns every saved stop to the trip as a compact, clickable card.
- Prefills the first stay with the trip dates.
- Starts each additional stay on the prior stay's departure date and initially
  ends it on the trip's end date.
- Defaults check-in and check-out times to noon while keeping them editable.
- Automatically fills the site as `HH`, `MD`, or `BD` when Harvest Host,
  moochdocking, or boondocking is selected.
- Keeps free-stay costs at zero and all generated values editable.

## Version 0.29.0

- Turns every Rig menu item into an inline expanding section.
- Opens maintenance, upgrades, fuel history, and Lehigh Gorge records directly
  beneath the item that was tapped instead of placing them below the entire
  Phillis or Ruby card.
- Keeps each expanded section independently collapsible from its own header.

## Version 0.28.1

- Adds the VIN for Phillis II.0 and Ruby beneath each vehicle's identifying
  details on the Rig page.
- Stores VINs in a separate Supabase table restricted to owners and editors;
  they are not embedded in the public website source or exposed to Family
  Viewer accounts.
- Keeps the VIN visually secondary while making it easy to select and copy.

## Version 0.28.0

- Combines the separate Phillis and Ruby bottom navigation pages into one Rig
  page.
- Gives Phillis II.0 and Ruby distinct vehicle sections with their identifying
  year, make, model, and fuel details.
- Keeps every existing maintenance, upgrade, fuel, and Lehigh Gorge feature in
  its original section.
- Simplifies the bottom navigation to Home, Trips, Rig, and Notes.

## Version 0.27.0

- Identifies every Phillis maintenance, repair, and upgrade record by trailer.
- Assigns all 2026 records to Phillis II.0 and earlier records to Phillis.
- Shows the trailer on record lists, recent Home records, and record details.
- Adds a trailer selector when adding or editing Phillis records.
- Saves each record against the corresponding trailer already stored in
  Supabase.

## Version 0.26.0

- Replaces Home's two-card countdown with three compact trip cards.
- Shows the last completed trip in gray with days since it ended.
- Shows the next trip in gold and the following trip in forest green.
- Adds a full-width cranberry active-trip card above the three-card row whenever
  a trip is underway.
- Keeps every trip card clickable.

## Version 0.25.0

- Gives completed, planned, next-up, and current trip cards distinct colors.
- Uses muted slate for completed trips, forest green for planned trips, gold for
  the next trip, and cranberry for an active trip.
- Changes the next planned trip's label to `NEXT TRIP`.

## Version 0.24.0

- Limits Home's Recent Records section to the three newest records.
- Makes each recent fuel, Phillis maintenance, and Ruby maintenance card open
  directly into its full record details.

## Version 0.23.1

- Moves the Recent Updates card to the bottom of the More page.

## Version 0.23.0

- Adds a compact Recent Updates card to the More page.
- Shows the three newest versions and their most important changes.
- Links directly to this complete running update history on GitHub.

## Version 0.22.1

- Replaces the tall Trip Totals list with a compact four-item summary.
- Shows Stay cost, Fuel cost, Miles, and MPG.
- Automatically totals every campground and host stay linked to the trip.
- Removes gallons from the at-a-glance trip summary.

## Version 0.22.0

- Makes each campground, Harvest Host, boondocking, or moochdocking card
  clickable from inside a trip.
- Adds a dedicated stay-detail view with dates, check-in and checkout times,
  site number, complete map-linked address, photos, cost, and notes.
- Moves the Edit stay button into the stay-detail view.
- Adds a Back to trip control and preserves direct photo and map-link actions.

## Version 0.21.2

- Returns stay cards to their cleaner city-and-state display.
- Keeps the full street address behind the clickable location so Google Maps
  still opens the precise destination after confirmation.

## Version 0.21.1

- Keeps stay addresses clickable and preserves the Google Maps confirmation.
- Removes the extra “Open in Maps” text for a cleaner stay card.

## Version 0.21.0

- Shows each stay’s complete address in its trip listing.
- Makes the address tappable on phones and computers.
- Asks for confirmation before opening the location in Google Maps.
- Includes the map link in both the full-access and itinerary-only views.

## Version 0.20.9

- Shows the complete On the Road Again photo in the trip header instead of cropping faces.
- Keeps the framed thumbnail and caption treatment introduced in v0.20.8.

## Version 0.20.8

- Restores the On the Road Again caption below the trip-detail photo.
- Uses the same framed thumbnail treatment as the other journal photos.
- Makes the header photo slightly larger while keeping it centered beside the trip title.

## Version 0.20.7

- Centers the trip-detail photo beside the title and pulls it closer to the title block.
- Shows the full On the Road Again image without the forced crop.
- Removes the small caption from this compact header photo so it no longer competes with the picture.

## Version 0.20.6

- Places the trip dates and rig directly beneath the trip title.
- Reserves separate space for the close button so it no longer crowds the
  On the Road Again photo.
- Removes the awkward blank area between the title and trip information.

## Version 0.20.5

- Moves the On the Road Again photo into the trip-detail header, to the right
  of the trip title.
- Keeps the smaller header photo tappable so it can still be enlarged.

## Version 0.20.4

- Shows the truck and trailer pairing on countdown cards, upcoming trips,
  full trip cards, and trip details.
- Makes each era of the travel history easy to recognize at a glance:
  F-150 + Phillis, Spruce + Phillis, Spruce + Phillis II.0, and
  Ruby + Phillis II.0.

## Version 0.20.3

- Fuel stops now retain the tow vehicle assigned to their trip.
- Fuel type follows the assigned truck: gasoline for the F-150 and Spruce,
  diesel for Ruby.
- Trip and fuel saves preserve historical truck and trailer assignments.
- Fuel-history and trip-detail views show the truck and fuel type.

Run `database-add-fuel-vehicles.sql` in Supabase before publishing this version.

## Version 0.20.2

- Moves the complete Pictures section below the note text or checklist inside
  the Add/Edit Note screen.
- Keeps the editing order focused on the note first: title, note, pictures,
  then Save.

## Version 0.20.1

- Keeps the note itself as the primary content on every note card.
- Moves attached picture thumbnails below the note text or checklist on both the
  Notes page and Home screen.

## Version 0.20.0

- Adds up to six private pictures to every shared note.
- Shows note-picture thumbnails on the Notes page and Home's recent notes.
- Lets Scott and Kayla add, preview, enlarge, and remove note pictures.
- Compresses large phone photos before uploading them to secure Supabase
  Storage.
- Keeps note pictures hidden from Family Viewer accounts.

Run `database-add-note-photos.sql` in Supabase before publishing this version.

## Version 0.19.4

- Makes the document itself the explicit vertical scroll area.
- Removes scroll containment that could trap wheel gestures in an embedded
  browser.
- Preserves touch momentum and the existing phone pull-to-refresh behavior.

## Version 0.19.3

- Adds **Add note** beside the Home screen's trip and fuel shortcuts.
- Shows the three most recently updated shared notes on Home.
- Opens a recent note directly in the editor when its card is tapped.
- Keeps Notes and the new Home note shortcuts hidden from Family Viewers.

## Version 0.19.2

- Renamed the app to **Phillis & Ruby Travel Journal**.
- Updated the visible header, sign-in screen, browser title, installed-app
  name, manifest, and loading copy.
- Kept the existing website address, database, accounts, records, and technical
  identifiers unchanged.

## Version 0.19.1

- Added an installed-app update check so Scott and Kayla receive new Hub behavior more reliably.
- The shared-account status now shows the active app version for easy troubleshooting.

## Version 0.19.0

- Added an optional checklist mode to shared notes.
- Checklist items can be checked, edited, added, and removed before saving.
- Tapping a note card now opens the editor immediately.
- Note deletion is available directly from the editor.

## Version 0.18.2

- Fixed note text saving and display by separating the Notes page from the form's note-text field.

## Version 0.18.1

- Fixed the shared Notes form so the Save button creates and updates notes correctly.

## Version 0.18.0

- Replaces the bottom More tab with private shared Notes for Scott and Kayla.
- Adds cloud-synced note creation, editing, deletion, and newest-first sorting.
- Keeps More available from the header menu.
- Hides shared Notes from Family Viewer accounts.

## Version 0.17.6

- Detects the installed iPhone Home Screen app directly.
- Applies a dedicated Dynamic Island clearance only in installed-app mode,
  without changing the correctly positioned Safari version.

## Version 0.17.5

- Uses the iPhone’s reserved status-bar area instead of drawing the header
  underneath the camera cutout.
- Retains safe-area padding for devices that report their inset correctly.

## Version 0.17.4

- Adds iPhone safe-area spacing so the header clears the camera cutout.
- Keeps form fields at an iPhone-friendly size to prevent automatic page zoom.
- Prevents accidental horizontal page expansion on narrow phone screens.

## Version 0.17.3

- Moves each trip’s On the Road Again thumbnail to the right of its title.
- Places Campsite and Sign thumbnails between the stay information and amount.
- Keeps all photo captions beneath the image and all thumbnails tap-to-enlarge.

## Version 0.17.2

- Moves the On the Road Again thumbnail beside each trip-card title.
- Places the label below the image so it no longer covers the photo.

## Version 0.17.1

- Renames stay-photo labels to “Campsite” and “Sign.”
- Restyles campsite, sign, and On the Road Again photos as smaller thumbnail
  cards with matching corners, borders, and comfortable spacing.

## Version 0.17.0

- Adds one shared “On the Road Again” cover photo to every trip.
- Lets Scott and Kayla add, replace, or remove the photo while editing a trip.
- Shows the cover prominently on trip cards and trip-detail pages.
- Makes the same photo visible to Family Viewer accounts for current and
  upcoming trips.
- Compresses and stores trip photos securely in a private Supabase bucket.

Run `database-add-trip-photos.sql` in Supabase before publishing this version.

## Version 0.16.0

- Adds two shared photo spots to every campground and Harvest Host stay:
  Ruby & Phillis at the site, and the campground or host sign.
- Shows tappable photo thumbnails directly in each trip's stay listings.
- Opens stay photos in a larger in-app viewer.
- Compresses phone photos before securely storing them in Supabase.
- Keeps Family Viewer access read-only while allowing current/upcoming stay
  photos to be viewed.
- Lays the photo and stay-card foundation for a future campground journal.

Run `database-add-stay-photos.sql` in Supabase before publishing this version.

## Version 0.15.1

- Makes the pull-down gesture shorter and easier to trigger on iPhone.
- Adds a one-tap refresh button beside the main menu as a dependable fallback.
- Uses the same cloud reload and completion message for both refresh methods.

## Version 0.15.0

- Adds pull-down-to-refresh on touch devices.
- Reloads shared cloud data without closing the installed app.
- Shows clear pull, release, refreshing, and completion feedback.

## Version 0.14.1

- Shows the next two trips as smaller side-by-side countdown cards.
- When a trip is active, it appears as a full-width cranberry card above the upcoming trips.
- Countdown cards remain tappable and open their trip details.

## Version 0.14.0

- Compact, clickable countdown cards
- Cranberry active-trip state with day progress
- Campground check-in and check-out times

- Stores shared records securely in Supabase.
- Keeps personal travel history out of the public website source.
- Supports full-access owner and editor accounts.
- Supports privately created Family Viewer accounts.
- Limits Family Viewers to a read-only view of current and upcoming itineraries.
- Excludes costs, fuel, maintenance, vehicle records, seasonal-site records,
  past trips, and editing controls from the Family Viewer experience.
- Includes a custom Ruby-and-Phillis app icon, installable-app metadata, and
  a more tailored visual identity.

The website is published through GitHub Pages. Supabase authentication and
row-level security protect all personal records.
