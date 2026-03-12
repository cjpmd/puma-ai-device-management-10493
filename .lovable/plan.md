

# Fix: Event Filtering and Recording Setup Access

## Problems Found

1. **Upcoming events appearing in "Recent"**: The filter on line 93 of `Matches.tsx` requires `!e.match_id` for upcoming events. So any future event that already has a linked match gets excluded from "Upcoming" and falls into "Recent" (line 96 uses `e.date < today || e.match_id`). The "Video Analysis Test" on 27/02 likely has a `match_id`, so it lands in "Recent" despite being in the future.

2. **"Set Up Recording" button disappears**: In `EventCard.tsx`, the button is only rendered when `!hasMatch`. Once a match is linked, there is no way to navigate to the recording setup from the event card.

## Changes

### 1. `src/pages/Matches.tsx` -- Fix filtering logic

Change the event categorization to be **purely date-based**:
- **Upcoming**: `e.date >= today` (regardless of `match_id`)
- **Recent**: `e.date < today`

This ensures future events always appear under "Upcoming", whether or not they have a linked match.

### 2. `src/components/Matches/EventCard.tsx` -- Always show action button

Instead of hiding the button when a match exists, change the button behavior:
- **No match linked**: Show "Set Up Recording" button (creates a new match and navigates to it -- current behavior)
- **Match already linked**: Show "Open Recording" button that navigates to `/matches/{match_id}` (so users can access the recording setup they already created)

This ensures every event card has an actionable button regardless of state.

## Technical Details

### Files to modify:
1. **`src/pages/Matches.tsx`** lines 92-98: Remove `!e.match_id` from the upcoming filter and remove `|| e.match_id` from the recent filter
2. **`src/components/Matches/EventCard.tsx`** lines 87-90: Replace the conditional hide with a conditional button label/action, add `useNavigate` for the "Open Recording" navigation

### No database changes needed
### No new dependencies needed

