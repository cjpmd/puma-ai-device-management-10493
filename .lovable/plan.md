## Goal

Phase 1 of the analytics roadmap: make per-player identity reliable enough that the cinema UI shows real shirt numbers (and names where the coach has supplied a roster), instead of ephemeral ByteTrack IDs. Heuristics-only — no model fine-tuning.

## Why current OCR misses

`gpu-server/jersey_ocr.py` runs EasyOCR on a fixed 25–55% slice of each bbox, accepts any 1–2 digit read, and requires 3 identical readings to confirm. On 4K-downscaled grassroots footage that means:
- Crops are tiny and blurry → most reads fail or return junk.
- EasyOCR confidence is ignored → noisy reads vote equally with strong ones.
- No roster constraint → a misread "8" beats a real "18".
- Once ByteTrack drops a track, the next track ID starts identity-less even though the same shirt is on screen.
- No way for a coach to correct an identity in the UI without re-running GPU.

## Changes

### 1. Roster table + entry UI
Add `match_rosters` (per match, per side):
```
match_id uuid, side text ('home'|'away'),
jersey_number int, player_id uuid null, player_name text null,
PRIMARY KEY (match_id, side, jersey_number)
```
With GRANTs + RLS scoped to match owner.

New cinema sub-panel "Roster" (small icon in `IconRail`) — coach picks home/away tab, types numbers + names (or picks from `players`). Saved per match. Optional but unlocks roster-constrained OCR.

### 2. Smarter jersey OCR (`gpu-server/jersey_ocr.py`)
- **Bigger, sharper crops:** y-band 18–60%, upscale crop to ≥96 px height with cubic, apply CLAHE + light unsharp mask before reading.
- **Two-band reads:** front (28–48%) and back (50–72%) — back numbers usually larger.
- **Use OCR confidence:** call `readtext(..., detail=1)`; keep `(number, confidence)`; reject confidence < 0.4.
- **Run OCR more often when crop is large** (bbox height > 120 px), less often when far away.
- **Weighted voting:** instead of "3 identical readings", score each candidate by `Σ confidence`; confirm when top score ≥ 1.5 AND beats runner-up by ≥ 0.5.
- **Roster constraint:** if roster supplied for a team, only count reads whose digit is in the roster set; if not in roster, fall back to nearest roster number within Levenshtein 1 ("13"↔"18"); discard otherwise.
- **Team-aware:** require a team label from kit-colour clustering before counting a read; numbers on the wrong team are dropped.

### 3. Track-ID merging across short gaps
After the ByteTrack loop, run a post-pass in `handler.py`:
- Group all tracks by `(team, confirmed_jersey)`; for each group, merge their segments into one virtual identity in `player_metrics`, summing distance/passes/etc.
- For tracks that never confirmed a number but spatially+temporally bridge two segments of the same confirmed identity (gap ≤ 2 s, position delta consistent with run speed), merge them too.
- Output a `track_id_aliases: {old_id: virtual_id}` map alongside metrics for downstream UI.

### 4. Pipeline output + DB wiring
- `analysis-callback` already accepts `player_metrics` — extend it to upsert `player_identities` rows when GPU sends `team_id + jersey + name`, and to write `player_identity_id` / `jersey_number` into `player_match_stats` using the merge map.
- New optional `player_metrics[*].track_id_aliases` consumed before upsert so multiple track IDs collapse to one row per identity.

### 5. Cinema UI — show + correct identity
- `PlayerTracksSummary` / `PlayerSpotlightPanel`: display `#JERSEY · Name` instead of `Track #ID` whenever available; fall back to track ID.
- Inline "reassign" affordance on each player row: pick a roster entry from a popover → writes the corrected `jersey_number` / `player_identity_id` to `player_match_stats` for that `track_id` (no GPU rerun). Stored as a coach override that always wins over OCR.
- Show small thumbnail (first decent frame crop) per player so coaches can visually verify before correcting. Use the same crop the OCR took, saved to a new `gpu-server` output `player_thumbnails: { track_id: base64_jpg }` (small, ~80×120, ≤ 5 KB each).

### 6. Eval harness update (`gpu-server/eval.py`)
Add jersey-identity score: for tagged events that include a `track_id`, compute % of those track IDs whose confirmed jersey matches the roster entry for the tagged team. Surfaces an identity F1 in the Accuracy panel.

## Out of scope

- Re-ID via embeddings / SoccerNet fine-tuning (roadmap Phase 4+).
- Face/name recognition.
- Live identity during recording (post-process only).
- Multi-camera identity stitching (single stitched feed only).

## Technical notes

- All GPU changes are in `gpu-server/` (`jersey_ocr.py`, `handler.py`); no new Python dependencies (CLAHE/unsharp = OpenCV, already present).
- One new migration: `match_rosters` table + GRANTs + RLS. `player_identities` already exists.
- UI work in `src/components/Matches/Cinema/` (new `RosterPanel`, additions to `PlayerSpotlightPanel`, `PlayerTracksSummary`, `IconRail`).
- Coach overrides are pure DB writes — no GPU rerun needed to fix mis-identified players.
- All thresholds (`OCR confidence ≥ 0.4`, vote score `≥ 1.5`, gap `≤ 2 s`) are constants near top of `jersey_ocr.py` so we can tune against the tagged benchmark match.

## Phasing within Phase 1

1. Migration + Roster panel (lets coach enter a roster today).
2. OCR rewrite + roster constraint + weighted voting.
3. Track-ID merging + thumbnails + callback wiring.
4. UI display + coach-override reassign.
5. Eval-harness identity metric; tune thresholds against benchmark match.
