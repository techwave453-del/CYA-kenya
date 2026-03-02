-- Add local_church column to profiles table
ALTER TABLE public.profiles 
ADD COLUMN local_church TEXT;

-- Add an index for church name searches
CREATE INDEX idx_profiles_local_church ON public.profiles(local_church);