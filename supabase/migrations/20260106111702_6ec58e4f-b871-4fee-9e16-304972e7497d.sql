-- Create group_admins table to track who is admin in each group
CREATE TABLE public.group_admins (
    id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    conversation_id UUID NOT NULL REFERENCES public.conversations(id) ON DELETE CASCADE,
    user_id UUID NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    UNIQUE(conversation_id, user_id)
);

-- Enable Row Level Security
ALTER TABLE public.group_admins ENABLE ROW LEVEL SECURITY;

-- Policies for group_admins
CREATE POLICY "Group participants can view admins"
ON public.group_admins
FOR SELECT
TO authenticated
USING (public.is_conversation_participant(conversation_id, auth.uid()));

CREATE POLICY "Group admins can add admins"
ON public.group_admins
FOR INSERT
TO authenticated
WITH CHECK (
    EXISTS (
        SELECT 1 FROM public.group_admins ga
        WHERE ga.conversation_id = conversation_id
        AND ga.user_id = auth.uid()
    )
    OR public.is_conversation_creator(conversation_id, auth.uid())
);

CREATE POLICY "Group admins can remove admins"
ON public.group_admins
FOR DELETE
TO authenticated
USING (
    EXISTS (
        SELECT 1 FROM public.group_admins ga
        WHERE ga.conversation_id = conversation_id
        AND ga.user_id = auth.uid()
    )
    OR public.is_conversation_creator(conversation_id, auth.uid())
);

-- Create function to check if user is group admin
CREATE OR REPLACE FUNCTION public.is_group_admin(_conversation_id uuid, _user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
    SELECT EXISTS (
        SELECT 1
        FROM public.group_admins
        WHERE conversation_id = _conversation_id
        AND user_id = _user_id
    )
    OR EXISTS (
        SELECT 1
        FROM public.conversations
        WHERE id = _conversation_id
        AND created_by = _user_id
    )
$$;

-- Allow group admins to delete participants
CREATE POLICY "Group admins can remove participants"
ON public.conversation_participants
FOR DELETE
TO authenticated
USING (
    public.is_group_admin(conversation_id, auth.uid())
    AND user_id != auth.uid()
);

-- Allow group admins to add participants
CREATE POLICY "Group admins can add participants"
ON public.conversation_participants
FOR INSERT
TO authenticated
WITH CHECK (
    public.is_group_admin(conversation_id, auth.uid())
    OR (
        public.is_conversation_creator(conversation_id, auth.uid())
        AND user_id = auth.uid()
    )
);

-- Allow message senders to delete their own messages
CREATE POLICY "Users can delete their own messages"
ON public.messages
FOR DELETE
TO authenticated
USING (sender_id = auth.uid());

-- Allow group admins to delete any message in their group
CREATE POLICY "Group admins can delete messages"
ON public.messages
FOR DELETE
TO authenticated
USING (public.is_group_admin(conversation_id, auth.uid()));

-- Allow group creator to delete the conversation
CREATE POLICY "Group creator can delete conversation"
ON public.conversations
FOR DELETE
TO authenticated
USING (created_by = auth.uid());