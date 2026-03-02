-- Create a table to track which questions users have answered
CREATE TABLE public.user_answered_questions (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  question_id UUID NOT NULL REFERENCES public.bible_games(id) ON DELETE CASCADE,
  answered_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  was_correct BOOLEAN NOT NULL DEFAULT false,
  UNIQUE(user_id, question_id)
);

-- Enable RLS
ALTER TABLE public.user_answered_questions ENABLE ROW LEVEL SECURITY;

-- Users can view their own answered questions
CREATE POLICY "Users can view their own answered questions"
ON public.user_answered_questions
FOR SELECT
USING (auth.uid() = user_id);

-- Users can insert their own answered questions
CREATE POLICY "Users can insert their own answered questions"
ON public.user_answered_questions
FOR INSERT
WITH CHECK (auth.uid() = user_id);

-- Users can update their own answered questions
CREATE POLICY "Users can update their own answered questions"
ON public.user_answered_questions
FOR UPDATE
USING (auth.uid() = user_id);

-- Create index for faster lookups
CREATE INDEX idx_user_answered_questions_user_id ON public.user_answered_questions(user_id);
CREATE INDEX idx_user_answered_questions_question_id ON public.user_answered_questions(question_id);

-- Enable realtime for this table
ALTER PUBLICATION supabase_realtime ADD TABLE public.user_answered_questions;