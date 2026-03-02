-- Create bible_games table for storing game content managed by admins
CREATE TABLE public.bible_games (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  game_type TEXT NOT NULL CHECK (game_type IN ('trivia', 'guess_character', 'fill_blank', 'memory_verse')),
  question TEXT NOT NULL,
  options JSONB, -- For multiple choice: ["A", "B", "C", "D"]
  correct_answer TEXT NOT NULL,
  hint TEXT,
  difficulty TEXT NOT NULL DEFAULT 'medium' CHECK (difficulty IN ('easy', 'medium', 'hard')),
  bible_reference TEXT, -- e.g., "John 3:16"
  points INTEGER NOT NULL DEFAULT 10,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create game_scores table for leaderboard
CREATE TABLE public.game_scores (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  game_type TEXT NOT NULL,
  score INTEGER NOT NULL DEFAULT 0,
  games_played INTEGER NOT NULL DEFAULT 1,
  highest_streak INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(user_id, game_type)
);

-- Enable RLS
ALTER TABLE public.bible_games ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.game_scores ENABLE ROW LEVEL SECURITY;

-- Bible games are publicly readable (for offline caching)
CREATE POLICY "Bible games are publicly readable"
ON public.bible_games
FOR SELECT
USING (is_active = true);

-- Only admins can manage games
CREATE POLICY "Admins can manage bible games"
ON public.bible_games
FOR ALL
USING (public.has_role(auth.uid(), 'admin'))
WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- Game scores are publicly readable for leaderboard
CREATE POLICY "Game scores are publicly readable"
ON public.game_scores
FOR SELECT
USING (true);

-- Users can insert their own scores
CREATE POLICY "Users can insert their own scores"
ON public.game_scores
FOR INSERT
WITH CHECK (auth.uid() = user_id);

-- Users can update their own scores
CREATE POLICY "Users can update their own scores"
ON public.game_scores
FOR UPDATE
USING (auth.uid() = user_id);

-- Add timestamp trigger
CREATE TRIGGER update_bible_games_updated_at
BEFORE UPDATE ON public.bible_games
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_game_scores_updated_at
BEFORE UPDATE ON public.game_scores
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Insert some starter trivia questions
INSERT INTO public.bible_games (game_type, question, options, correct_answer, difficulty, bible_reference, points) VALUES
('trivia', 'How many days did God take to create the world?', '["5 days", "6 days", "7 days", "10 days"]', '6 days', 'easy', 'Genesis 1-2', 10),
('trivia', 'Who built the ark?', '["Moses", "Abraham", "Noah", "David"]', 'Noah', 'easy', 'Genesis 6-9', 10),
('trivia', 'What was the first miracle Jesus performed?', '["Walking on water", "Healing a blind man", "Turning water into wine", "Feeding 5000"]', 'Turning water into wine', 'medium', 'John 2:1-11', 15),
('trivia', 'How many plagues did God send on Egypt?', '["7", "10", "12", "5"]', '10', 'medium', 'Exodus 7-12', 15),
('trivia', 'Who was swallowed by a great fish?', '["Jonah", "Peter", "Paul", "Elijah"]', 'Jonah', 'easy', 'Jonah 1:17', 10),
('guess_character', 'I was thrown into a lions den but God protected me. Who am I?', '["David", "Daniel", "Joseph", "Moses"]', 'Daniel', 'easy', 'Daniel 6', 10),
('guess_character', 'I was sold by my brothers into slavery but later became second in command of Egypt. Who am I?', '["Moses", "Joseph", "Benjamin", "Jacob"]', 'Joseph', 'medium', 'Genesis 37-50', 15),
('fill_blank', 'For God so loved the ____ that he gave his one and only Son.', '["world", "church", "people", "believers"]', 'world', 'easy', 'John 3:16', 10),
('fill_blank', 'The Lord is my ____; I shall not want.', '["shepherd", "rock", "fortress", "light"]', 'shepherd', 'easy', 'Psalm 23:1', 10),
('memory_verse', 'Complete: "I can do all things through Christ who ____ me."', '["loves", "saves", "strengthens", "guides"]', 'strengthens', 'easy', 'Philippians 4:13', 10);