-- Drop existing restrictive policies and recreate as permissive

-- Fix conversation_participants policies
DROP POLICY IF EXISTS "Users can add participants" ON public.conversation_participants;
DROP POLICY IF EXISTS "Users can view co-participants" ON public.conversation_participants;
DROP POLICY IF EXISTS "Users can view own participation" ON public.conversation_participants;

-- Create permissive INSERT policy for conversation_participants
CREATE POLICY "Users can add participants"
ON public.conversation_participants
FOR INSERT
TO authenticated
WITH CHECK (
  (user_id = auth.uid()) OR 
  is_conversation_creator(conversation_id, auth.uid())
);

-- Create permissive SELECT policies for conversation_participants
CREATE POLICY "Users can view participants in their conversations"
ON public.conversation_participants
FOR SELECT
TO authenticated
USING (is_conversation_participant(conversation_id, auth.uid()));

-- Fix conversations policies
DROP POLICY IF EXISTS "Users can create conversations" ON public.conversations;
DROP POLICY IF EXISTS "Users can view their conversations" ON public.conversations;
DROP POLICY IF EXISTS "Participants can update conversation" ON public.conversations;

-- Create permissive INSERT policy for conversations
CREATE POLICY "Users can create conversations"
ON public.conversations
FOR INSERT
TO authenticated
WITH CHECK (auth.uid() = created_by);

-- Create permissive SELECT policy for conversations
CREATE POLICY "Users can view their conversations"
ON public.conversations
FOR SELECT
TO authenticated
USING (is_conversation_participant(id, auth.uid()) OR created_by = auth.uid());

-- Create permissive UPDATE policy for conversations
CREATE POLICY "Participants can update conversation"
ON public.conversations
FOR UPDATE
TO authenticated
USING (is_conversation_participant(id, auth.uid()))
WITH CHECK (is_conversation_participant(id, auth.uid()));