

# AI Analytics & Insights Engine

## What's Already Built (skip these)

| Layer | Status |
|---|---|
| Video Intelligence: YOLO ball + ByteTrack players | ✅ Done in `gpu-server/handler.py` |
| Tracking metadata stored in `processing_jobs` (ball_tracking_data, player_tracking_data, event_data JSONB) | ✅ Done |
| Match analytics dashboard tabs (Timeline, Players, Detection Stats) | ✅ Done in `MatchAnalyticsDashboard.tsx` |
| Play-switch event detection | ✅ Done (basis for "possession change") |
| Mobile recording, dual-camera stitch, Wasabi pipeline | ✅ Done |

## What's Missing (this plan covers)

The 5-layer prompt maps to four real gaps:

1. **Event detection** — passes/shots/tackles/possession changes from existing tracks
2. **Feature engineering & metrics** — team & player aggregates, xG proxy, heatmaps
3. **Performance divergence** — actual vs expected (xG, dominance, contribution scores)
4. **AI interpretation + UX** — LLM-generated insights, video overlay, click-to-jump timeline

We skip the "ML behaviour model" (Random Forest/XGBoost) for now — grassroots teams don't have enough historical data to train it usefully. We replace it with **rule-based xG and rolling averages**, which is explainable and works from match #1.

## Plan

### Part A — GPU handler: derive events from tracks (`gpu-server/handler.py`)

Add a new `EventDetector` class that runs **after** ball + player tracking and produces structured events. No new ML model needed — uses geometry on existing data:

- **Possession**: nearest player to ball within 80px = possessor. Possession change = possessor's track_id changes for 5+ consecutive frames.
- **Pass**: possession transfer between two players on the same inferred team within 3 seconds, ball travels >100px.
- **Shot**: ball trajectory enters goal zone (left/right 8% of pitch) with speed > 25px/frame.
- **Tackle**: possession change where new possessor was within 50px during transfer.
- **Tactical features**: average team positions, defensive line height, team shape per 10s window.

Outputs added to `metadata.json`:
```json
{
  "events": [{ "time": 12.3, "type": "pass", "player_track_id": 4, "from": [x,y], "to": [x,y], "outcome": "complete" }],
  "team_metrics": { "possession_pct": {...}, "pass_success": {...}, "shots": {...} },
  "player_metrics": { "<track_id>": { "passes": 12, "shots": 1, "distance_m": 4200, ... } },
  "heatmaps": { "<track_id>": [[x,y,intensity], ...] }
}
```

Team inference: cluster player jersey colours via dominant HSV in bounding box → 2 clusters = team A/B.

### Part B — Database (migration)

Two new JSONB columns on `processing_jobs`:
- `team_metrics` — possession %, xG, shots, pass success
- `divergence_metrics` — actual vs expected (xG gap, dominance score, player contribution)

Plus one new table `match_insights` for LLM-generated text:
- `match_id`, `summary`, `team_strengths`, `team_weaknesses`, `top_performers`, `coaching_focus`, `created_at`

### Part C — Edge function: `runpod-webhook` parses new fields

Extend the existing webhook to populate `events`, `team_metrics`, `player_metrics`, `heatmaps`, plus run the **divergence calculations** (pure math, no model):

- `goals_vs_xg`, `shot_efficiency`, `possession_vs_chances`, `dominance_score` (territory + shots + possession weighted)
- Per-player `contribution_score` (passes + shots + tackles weighted by outcome)

### Part D — New edge function: `generate-match-insights`

After the webhook completes, queue a Lovable AI call (`google/gemini-3-flash-preview`) that takes the metrics JSON and produces:
- 1-paragraph match summary
- 3 team strengths / 3 weaknesses
- Top 3 performers with reasoning
- 2 coaching focus suggestions

Saved to `match_insights` table. Uses tool calling for structured output.

### Part E — Frontend additions

Extend `MatchAnalyticsDashboard.tsx` with new tabs:
- **Match Stats** — possession %, xG, shots, pass success (cards + bar chart)
- **Players** *(extend existing)* — add metrics columns (passes, shots, xG contribution, distance)
- **Heatmaps** — per-player heatmap overlay on a pitch SVG
- **AI Insights** — render `match_insights` content with markdown (loading state while generating)

New component `MatchVideoPlayer.tsx` (replaces `MatchOutputViewer.tsx`):
- HTML5 video + clickable event timeline below
- Click event → seek to that timestamp
- Toggle: heatmap overlay, player ID labels
- Player name mapping: dropdown to link `track_id` → real `players.id` in DB (semi-manual mapping, persisted in a new `track_player_mapping` table)

### Part F — Player mapping table (migration)

```sql
CREATE TABLE track_player_mapping (
  id uuid PRIMARY KEY,
  match_id uuid REFERENCES matches(id),
  track_id integer NOT NULL,
  player_id uuid REFERENCES players(id),
  UNIQUE(match_id, track_id)
);
```
RLS: match owner can read/write.

## File changes summary

| File | Action |
|---|---|
| `gpu-server/handler.py` | Add `EventDetector`, `TeamClassifier`, metric aggregation, heatmap binning |
| Migration | Add columns + `match_insights` + `track_player_mapping` tables |
| `supabase/functions/runpod-webhook/index.ts` | Parse events/metrics, compute divergence, trigger insights |
| `supabase/functions/generate-match-insights/index.ts` | New — Lovable AI structured output |
| `src/components/Matches/MatchAnalyticsDashboard.tsx` | Add Match Stats, Heatmaps, AI Insights tabs |
| `src/components/Matches/MatchVideoPlayer.tsx` | New — clickable event timeline + overlays |
| `src/components/Matches/PlayerTracksSummary.tsx` | Extend with new metrics + name mapping |
| `src/components/Matches/HeatmapOverlay.tsx` | New |
| `src/components/Matches/AIInsightsPanel.tsx` | New |
| `src/pages/MatchDetail.tsx` | Wire new player + insights panel |

## Notes / deferred

- **No ML training** (Random Forest/XGBoost): rule-based xG (distance + angle lookup table) is explainable and works from match #1. We can add a learned model later once you have 50+ matches.
- **No betting/external data** — all derived from your videos only.
- **Team detection** uses jersey colour clustering — works for distinct kits, may need manual override for similar colours (covered by the mapping table).

