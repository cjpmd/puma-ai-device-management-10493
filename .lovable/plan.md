## Goal

Make Player Spotlight (and the rest of Cinema) show **real shirt numbers and player names** from the Origin Sports squad import, instead of internal track IDs like `#8044`. Tighten the OCR pipeline so identification rate is higher.

The OCR pipeline already runs on the GPU, but two things are missing:

1. Nothing converts confirmed jersey numbers into `track_player_mapping` rows — so the UI can never look up a player.
2. `PlayerSpotlightPanel` ignores the jersey number even when it's written to `player_match_stats.jersey_number`.

On top of that, the OCR itself can be sharpened now that we have per-team rosters from the squad import.

---

## 1. Auto-link tracks to roster players (callback side)

In `supabase/functions/analysis-callback/index.ts`, after we upsert `player_match_stats`:

- Load `match_rosters` for the match (we already have it for OCR rosters).
- For each `(track_id, jersey_number, team)` in `player_metrics`:
  - Find the roster row where `jersey_number` matches and `side` matches the track's team (A→home / B→away, using `matches.is_home` to flip if needed).
  - Insert into `track_player_mapping(match_id, track_id, player_id, jersey_number, confidence, source='ocr')`.
- Upsert on `(match_id, track_id)` so re-runs overwrite.

No new tables — `track_player_mapping` already exists. Add a `source` column + `confidence numeric` if missing (migration).

## 2. UI: show jersey + name everywhere we currently show `#<track_id>`

In `src/components/Matches/Cinema/PlayerSpotlightPanel.tsx`:

- Extend the mapping fetch to also pull `player_match_stats(track_id, jersey_number, team)` for the match — so even when `track_player_mapping` is missing (no roster match), pills still read `#9` instead of `#8044`.
- `labelFor(id)` priority: `mapping[id].squad_number` → `player_match_stats[id].jersey_number` → fall back to `Track {id}` (not `#{id}`, so users stop confusing internal IDs with shirt numbers).
- `nameFor(id)`: roster name → "Unknown #N" → `Track {id}`.
- Same fix in `PassNetworkPanel` and `ClipsPanel` if they format `#track_id`.

## 3. Tighten OCR (`gpu-server/jersey_ocr.py` + `gpu-server/handler.py`)

Three changes, all low-risk:

- **Per-team rosters after team assignment.** Currently `process-video` sends one union set and OCR snaps to that. After `team_assignment` runs in `handler.py`, call `jersey_tracker.set_rosters({"A": home_or_away_set, "B": the_other_set})` once we know which detected team corresponds to home/away (using jersey colour vs. the team's primary colour, or majority vote of confirmed reads). Snapping to a 11-number set is far more accurate than to a ~22-number union.
- **Better small-crop OCR.** Lower `OCR_EVERY_N_FAR` from 24 → 12, raise `UPSCALE_TARGET_H` from 96 → 128, and add a second OCR pass on the horizontally-flipped crop (helps with back-number variants). Keep voting thresholds the same.
- **Surface "best guess" alongside confirmed.** Expose `best_guess_identities()` returning the top candidate per track even if it didn't hit `CONFIRM_VOTE_SCORE`, plus its confidence. Merge into `player_metrics` as `jersey_number_guess` + `jersey_confidence`. The callback uses `jersey_number` only for `track_player_mapping`; the guess is shown in UI with a "?" badge.

## 4. Re-run processing for this match

The existing job pre-dates the squad import and used no roster snap. After (1)–(3) ship, re-trigger via Developer Controls so this match gets real numbers/names.

---

## Technical details

**Files**

- `supabase/functions/analysis-callback/index.ts` — add roster→track_player_mapping write block.
- `supabase/migrations/<new>.sql` — add `source text` and `confidence numeric` to `track_player_mapping` if not present, plus a UNIQUE `(match_id, track_id)` constraint for the upsert.
- `src/components/Matches/Cinema/PlayerSpotlightPanel.tsx` — extra query, new `labelFor` / `nameFor`.
- `src/components/Matches/Cinema/PassNetworkPanel.tsx`, `ClipsPanel.tsx` — same label helper (extract into a small hook `useTrackLabels(matchId)` so all panels share it).
- `gpu-server/jersey_ocr.py` — tweak constants, add flipped pass, add `best_guess_identities`.
- `gpu-server/handler.py` — call `set_rosters` per team after team assignment; merge best-guess into `player_metrics`.

**Out of scope**

- Manual "assign track → player" UI (good follow-up, not needed yet).
- Re-identifying players across sessions/matches (jersey OCR is per-match for now).
- Opposition roster import.

```text
events ──► track_id  ──►  track_player_mapping  ──► player.name + squad_number
                  └──►  player_match_stats.jersey_number  (fallback for label)
```
