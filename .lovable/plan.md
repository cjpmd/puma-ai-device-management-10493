## Player Spotlight — count + identification fixes

### 1. `src/components/Matches/Cinema/PlayerSpotlightPanel.tsx`
- Build `trackIds` from `playerMetrics` keys first; only fall back to event-derived IDs when `playerMetrics` is empty. Drops "6166 tracked" to the real ~22–30.
- Pass `playerMetrics` into `useTrackLabels`.

### 2. `src/components/Matches/Cinema/useTrackLabels.ts`
- Accept optional `playerMetrics`. When no confirmed mapping exists, fall back to `jersey_number_guess` + `jersey_confidence` from metrics.
- `labelFor`: `#9` confirmed, `~9` guess, `T<id>` fallback.
- Count "identified" = confirmed + guessed.

### 3. `gpu-server/jersey_ocr.py`
- `CONFIRM_MIN_FRAMES`: 30 → 12
- `CONFIRM_VOTE_SCORE`: 2.5 → 1.6
- `CONFIRM_VOTE_LEAD`: 1.0 → 0.6
- `OCR_EVERY_N_NEAR`: 8 → 4

### 4. `supabase/functions/analysis-callback/index.ts`
- Lower OCR confidence floor for `track_player_mapping` writes from 2.5 → 1.6.

Frontend changes (#1, #2) help the existing job immediately. GPU/callback (#3, #4) take effect on re-runs.