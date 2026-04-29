-- Add head_of_academy_user_id to academies table
-- Required by sync-external-academy step 4 which updates this column after matching users by email
ALTER TABLE academies ADD COLUMN IF NOT EXISTS head_of_academy_user_id uuid;
