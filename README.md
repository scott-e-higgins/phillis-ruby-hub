# Phillis & Ruby Adventure Hub

Adventure Hub is Scott and Kayla's private travel companion.

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
