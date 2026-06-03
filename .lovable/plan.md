## Two bugs found

### 1. Cinema layout never renders

`MatchDetail.tsx:150` only mounts `<MatchCinemaLayout>` when `latestJob?.status === 'complete'`, but `analysis-callback` writes `status = 'completed'`. The two statuses are used interchangeably elsewhere in the app, but this gate is exact-match — so the whole cinema view (player + timeline + analytics panels) silently hides for every successfully completed job.

Fix: accept both values.

```tsx
{(latestJob?.status === 'complete' || latestJob?.status === 'completed') && (
  <MatchCinemaLayout matchId={id!} match={match} job={latestJob} />
)}
```

### 2. "View" in Outputs throws

`MatchOutputViewer.handleGetUrl` always calls the `get-output-url` edge function, which assumes `output_video_path` is a storage key it can sign. For this test job we stored a full Wasabi presigned URL there, so the edge function returns an error.

Fix: if `output_video_path` already looks like a fully-qualified URL, open it directly. Same passthrough we just added in `CinemaVideoPlayer`. Apply to `video` and `highlights` branches.

## Files

- `src/pages/MatchDetail.tsx` — widen status check
- `src/components/Matches/MatchOutputViewer.tsx` — URL passthrough in `handleGetUrl`

## Out of scope

- Normalising `status` values across the codebase (separate cleanup)
- Changing the edge function
