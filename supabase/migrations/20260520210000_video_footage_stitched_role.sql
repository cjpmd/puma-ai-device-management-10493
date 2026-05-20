-- Allow camera_role = 'stitched' for the panoramic output row
ALTER TABLE public.video_footage
  DROP CONSTRAINT IF EXISTS video_footage_camera_role_check;

ALTER TABLE public.video_footage
  ADD CONSTRAINT video_footage_camera_role_check
  CHECK (camera_role IN ('left_donor', 'right_donor', 'stitched'));

-- Add unique constraint used by upsert onConflict in trigger-stitching and stitch-callback
CREATE UNIQUE INDEX IF NOT EXISTS uq_video_footage_match_camera_role
  ON public.video_footage (match_id, camera_role)
  WHERE camera_role IS NOT NULL;
