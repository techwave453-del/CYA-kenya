-- Create a security definer function to check if user created the conversation
CREATE OR REPLACE FUNCTION public.is_conversation_creator(_conversation_id uuid, _user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.conversations
    WHERE id = _conversation_id
      AND created_by = _user_id
  )
$$;

-- Drop the existing INSERT policy
DROP POLICY IF EXISTS "Users can add participants" ON public.conversation_participants;

-- Create new INSERT policy using the security definer function
CREATE POLICY "Users can add participants"
ON public.conversation_participants
FOR INSERT
WITH CHECK (
  (user_id = auth.uid()) OR 
  is_conversation_creator(conversation_id, auth.uid())
);