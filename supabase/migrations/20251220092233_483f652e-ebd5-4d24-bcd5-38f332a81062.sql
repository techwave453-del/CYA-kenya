-- Drop the problematic policies
DROP POLICY IF EXISTS "Users can view their conversations" ON public.conversations;
DROP POLICY IF EXISTS "Users can view conversation participants" ON public.conversation_participants;
DROP POLICY IF EXISTS "Users can add participants" ON public.conversation_participants;
DROP POLICY IF EXISTS "Users can view messages in their conversations" ON public.messages;
DROP POLICY IF EXISTS "Users can send messages" ON public.messages;
DROP POLICY IF EXISTS "Participants can update conversation" ON public.conversations;

-- Create a security definer function to check if user is participant
CREATE OR REPLACE FUNCTION public.is_conversation_participant(_conversation_id uuid, _user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.conversation_participants
    WHERE conversation_id = _conversation_id
      AND user_id = _user_id
  )
$$;

-- Recreate policies using the function
CREATE POLICY "Users can view their conversations"
ON public.conversations FOR SELECT
USING (public.is_conversation_participant(id, auth.uid()));

CREATE POLICY "Participants can update conversation"
ON public.conversations FOR UPDATE
USING (public.is_conversation_participant(id, auth.uid()))
WITH CHECK (public.is_conversation_participant(id, auth.uid()));

-- For conversation_participants: users can see their own participation directly
CREATE POLICY "Users can view own participation"
ON public.conversation_participants FOR SELECT
USING (user_id = auth.uid());

-- Users can also view other participants of conversations they're in
CREATE POLICY "Users can view co-participants"
ON public.conversation_participants FOR SELECT
USING (public.is_conversation_participant(conversation_id, auth.uid()));

-- Conversation creator can add participants, OR user can add themselves
CREATE POLICY "Users can add participants"
ON public.conversation_participants FOR INSERT
WITH CHECK (
  user_id = auth.uid() 
  OR EXISTS (
    SELECT 1 FROM public.conversations
    WHERE id = conversation_id AND created_by = auth.uid()
  )
);

-- Messages: use the function
CREATE POLICY "Users can view messages in their conversations"
ON public.messages FOR SELECT
USING (public.is_conversation_participant(conversation_id, auth.uid()));

CREATE POLICY "Users can send messages"
ON public.messages FOR INSERT
WITH CHECK (
  auth.uid() = sender_id 
  AND public.is_conversation_participant(conversation_id, auth.uid())
);