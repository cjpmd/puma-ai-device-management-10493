Client-side gate the player track list so legacy/un-gated jobs don't dump 6000+ fragments into the picker.

**`src/components/Matches/Cinema/PlayerSpotlightPanel.tsx`** — replace `trackIds` derivation:

1. From `playerMetrics`, keep only entries where `team` is `A`/`B`, AND (`minutes_played > 0` OR `distance_m >= 5`).
2. Sort by `minutes_played` desc (tiebreak `distance_m` desc).
3. Cap to top 30.
4. Only fall back to event-derived IDs when `playerMetrics` is null/empty.

No backend/GPU changes.