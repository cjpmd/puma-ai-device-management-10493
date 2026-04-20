

The user wants to pull granular player attributes from Origin Sports (Technical/Physical/Mental/Goalkeeping subcategories) into the player detail screen, keeping the existing Physical card.

I need to:
1. Check what attributes Origin Sports stores
2. Plan a schema to hold them locally
3. Plan UI for the player detail screen

Let me check the cross_project for Origin Sports attribute structure first.

I'll inspect the Origin Sports project to find the attribute schema.

Based on FM-style attributes (which is what's being described — Aerial Reach, Corners, Crossing, Acceleration, Agility), the typical structure is:

**Technical** (outfield): Corners, Crossing, Dribbling, Finishing, First Touch, Free Kicks, Heading, Long Shots, Long Throws, Marking, Passing, Penalties, Tackling, Technique
**Mental**: Aggression, Anticipation, Bravery, Composure, Concentration, Decisions, Determination, Flair, Leadership, Off The Ball, Positioning, Teamwork, Vision, Work Rate
**Physical**: Acceleration, Agility, Balance, Jumping Reach, Natural Fitness, Pace, Stamina, Strength
**Goalkeeping** (GK only): Aerial Reach, Command of Area, Communication, Eccentricity, First Touch, Handling, Kicking, One on Ones, Passing, Punching, Reflexes, Rushing Out, Throwing

## Plan — Player attributes from Origin Sports

### 1. Schema
New table `player_attributes` (one row per player, sparse columns):
- `player_id` (uuid, FK-style, unique)
- `external_id` (text, for sync)
- All ~50 attribute columns as nullable `smallint` (1–20 scale)
- Grouped by category in code, but stored flat for simplicity
- `synced_at`, `updated_at`
- RLS: same pattern as `players` (authenticated read)

### 2. Sync extension
Extend `sync-external-data` edge function:
- New entity: `attributes` (also runs under `all`)
- For each external player, fetch from Origin Sports `player_attributes` table (or whatever they call it — I'll auto-detect by trying common names, same fallback pattern already used for memberships)
- Upsert into local `player_attributes` keyed on `external_id`
- Null-safe — only maps fields that exist

### 3. UI — PlayerDetailScreen
Inside the existing player detail (opened from Squad tab), keep the Physical card. **Add** below it:

- **Attribute radar** (Glass card): a small radar chart with 4 axes — Technical avg, Mental avg, Physical avg, Goalkeeping avg (GK only) — for at-a-glance shape
- **Four expandable Glass sections**: Technical, Mental, Physical, Goalkeeping
  - Each section header shows the category average (e.g. "Technical · 14")
  - Expanded: list of attribute name + bar (1–20 scale) + numeric value
  - Bars colour-coded: 1–7 red, 8–11 amber, 12–15 white, 16–20 purple
  - Goalkeeping section only shown if player has any GK values OR `position = 'GK'`
- Hide attributes that are null (so outfield players don't show GK bars unless populated)
- Empty state: "No attributes synced yet — pull to refresh" if all null

### 4. Files
**Migration (new)** — create `player_attributes` table + RLS

**Edge function** — `supabase/functions/sync-external-data/index.ts`: add `attributes` entity, run inside `all`

**New component** — `src/components/ios/AttributeBar.tsx` (small reusable bar + label + value)

**Edits**
- `src/pages/ios/SquadScreen.tsx` — extend `PlayerDetail` query + render attribute sections
- `src/integrations/supabase/types.ts` — auto-regenerated after migration

### Out of scope
- Editing attributes from this app (read-only sync)
- Historical attribute progression chart (future)
- Per-attribute sparkline trends

