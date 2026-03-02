-- Create table for saved Bible AI conversations
CREATE TABLE public.saved_bible_chats (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  title TEXT NOT NULL,
  messages JSONB NOT NULL DEFAULT '[]'::jsonb,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.saved_bible_chats ENABLE ROW LEVEL SECURITY;

-- Users can only view their own saved chats
CREATE POLICY "Users can view their own saved chats"
ON public.saved_bible_chats
FOR SELECT
USING (auth.uid() = user_id);

-- Users can create their own saved chats
CREATE POLICY "Users can create their own saved chats"
ON public.saved_bible_chats
FOR INSERT
WITH CHECK (auth.uid() = user_id);

-- Users can update their own saved chats
CREATE POLICY "Users can update their own saved chats"
ON public.saved_bible_chats
FOR UPDATE
USING (auth.uid() = user_id);

-- Users can delete their own saved chats
CREATE POLICY "Users can delete their own saved chats"
ON public.saved_bible_chats
FOR DELETE
USING (auth.uid() = user_id);

-- Add trigger for updated_at
CREATE TRIGGER update_saved_bible_chats_updated_at
BEFORE UPDATE ON public.saved_bible_chats
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();