-- Add bible_story and testament columns to bible_games table
ALTER TABLE public.bible_games
ADD COLUMN bible_story TEXT,
ADD COLUMN testament TEXT CHECK (testament IN ('old', 'new'));

-- Create index on bible_story for faster filtering
CREATE INDEX idx_bible_games_story ON public.bible_games(bible_story);
CREATE INDEX idx_bible_games_testament ON public.bible_games(testament);

-- Add comment for documentation
COMMENT ON COLUMN public.bible_games.bible_story IS 'The Bible story this question is based on (e.g., "Creation", "David and Goliath")';
COMMENT ON COLUMN public.bible_games.testament IS 'The testament this story belongs to: "old" for Old Testament, "new" for New Testament, or NULL for random/mixed';
