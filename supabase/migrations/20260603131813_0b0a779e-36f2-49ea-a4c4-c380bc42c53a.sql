-- Dedupe any existing collisions, keeping earliest row
DELETE FROM public.match_rosters a
USING public.match_rosters b
WHERE a.ctid > b.ctid
  AND a.match_id = b.match_id
  AND a.side = b.side
  AND a.jersey_number = b.jersey_number;

ALTER TABLE public.match_rosters
  ADD CONSTRAINT match_rosters_match_side_num_uniq UNIQUE (match_id, side, jersey_number);