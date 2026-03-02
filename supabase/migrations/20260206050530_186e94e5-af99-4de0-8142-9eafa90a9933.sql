-- Enable required extensions for cron jobs
CREATE EXTENSION IF NOT EXISTS pg_cron;
CREATE EXTENSION IF NOT EXISTS pg_net;

-- Create function to delete old bible game questions (older than 3 days)
CREATE OR REPLACE FUNCTION public.delete_old_bible_questions()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  DELETE FROM public.bible_games
  WHERE created_at < NOW() - INTERVAL '3 days';
END;
$$;

-- Schedule the cleanup to run daily at midnight
SELECT cron.schedule(
  'delete-old-bible-questions',
  '0 0 * * *',  -- Run at midnight every day
  'SELECT public.delete_old_bible_questions();'
);