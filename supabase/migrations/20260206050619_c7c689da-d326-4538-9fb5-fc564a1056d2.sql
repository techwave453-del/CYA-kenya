-- Update the cleanup function to read age from app_settings
CREATE OR REPLACE FUNCTION public.delete_old_bible_questions()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  cleanup_days INTEGER;
BEGIN
  -- Get cleanup age from app_settings, default to 3 days if not set
  SELECT COALESCE((value->>'days')::INTEGER, 3)
  INTO cleanup_days
  FROM public.app_settings
  WHERE key = 'bible_questions_cleanup_age';
  
  -- Use default if setting doesn't exist
  IF cleanup_days IS NULL THEN
    cleanup_days := 3;
  END IF;
  
  DELETE FROM public.bible_games
  WHERE created_at < NOW() - (cleanup_days || ' days')::INTERVAL;
END;
$$;