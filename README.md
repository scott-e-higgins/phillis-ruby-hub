# Phillis & Ruby Adventure Hub

Adventure Hub is Scott and Kayla's private travel companion.

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
