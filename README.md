# Phillis & Ruby Travel Journal

Travel Journal is Scott and Kayla's private travel companion.

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
