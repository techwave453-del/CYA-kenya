ALTER TABLE public.bible_games
DROP CONSTRAINT IF EXISTS bible_games_game_type_check;

ALTER TABLE public.bible_games
ADD CONSTRAINT bible_games_game_type_check
CHECK (
  game_type IN (
    'trivia',
    'guess_character',
    'fill_blank',
    'memory_verse',
    'choose_path',
    'journey_jerusalem',
    'character_missions',
    'old_testament',
    'new_testament'
  )
);
