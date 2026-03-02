-- Create role enum
CREATE TYPE public.app_role AS ENUM ('admin', 'moderator', 'user');

-- Create user_roles table (separate from profiles for security)
CREATE TABLE public.user_roles (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
    role app_role NOT NULL DEFAULT 'user',
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    UNIQUE (user_id, role)
);

-- Enable RLS
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

-- Create security definer function to check roles
CREATE OR REPLACE FUNCTION public.has_role(_user_id UUID, _role app_role)
RETURNS BOOLEAN
LANGUAGE SQL
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.user_roles
    WHERE user_id = _user_id
      AND role = _role
  )
$$;

-- RLS policies for user_roles
CREATE POLICY "Users can view their own roles"
ON public.user_roles
FOR SELECT
USING (auth.uid() = user_id);

CREATE POLICY "Admins can view all roles"
ON public.user_roles
FOR SELECT
USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can insert roles"
ON public.user_roles
FOR INSERT
WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can update roles"
ON public.user_roles
FOR UPDATE
USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can delete roles"
ON public.user_roles
FOR DELETE
USING (public.has_role(auth.uid(), 'admin'));

-- Create app_settings table for themes and other settings
CREATE TABLE public.app_settings (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    key TEXT NOT NULL UNIQUE,
    value JSONB NOT NULL DEFAULT '{}',
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    updated_by UUID REFERENCES auth.users(id)
);

-- Enable RLS on app_settings
ALTER TABLE public.app_settings ENABLE ROW LEVEL SECURITY;

-- Anyone can read app settings
CREATE POLICY "Anyone can view app settings"
ON public.app_settings
FOR SELECT
USING (true);

-- Only admins can modify app settings
CREATE POLICY "Admins can insert app settings"
ON public.app_settings
FOR INSERT
WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can update app settings"
ON public.app_settings
FOR UPDATE
USING (public.has_role(auth.uid(), 'admin'));

-- Create admin_emails table to store authorized admin emails
CREATE TABLE public.admin_emails (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    email TEXT NOT NULL UNIQUE,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.admin_emails ENABLE ROW LEVEL SECURITY;

-- Only admins can view/modify admin emails
CREATE POLICY "Admins can view admin emails"
ON public.admin_emails
FOR SELECT
USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can insert admin emails"
ON public.admin_emails
FOR INSERT
WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can delete admin emails"
ON public.admin_emails
FOR DELETE
USING (public.has_role(auth.uid(), 'admin'));

-- Create bible_verses table for storing memory verses
CREATE TABLE public.bible_verses (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    reference TEXT NOT NULL,
    text TEXT NOT NULL,
    day_of_year INTEGER,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.bible_verses ENABLE ROW LEVEL SECURITY;

-- Anyone can read verses
CREATE POLICY "Anyone can view bible verses"
ON public.bible_verses
FOR SELECT
USING (true);

-- Only admins can modify verses
CREATE POLICY "Admins can insert bible verses"
ON public.bible_verses
FOR INSERT
WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can update bible verses"
ON public.bible_verses
FOR UPDATE
USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can delete bible verses"
ON public.bible_verses
FOR DELETE
USING (public.has_role(auth.uid(), 'admin'));

-- Insert default theme setting
INSERT INTO public.app_settings (key, value) VALUES ('theme', '{"name": "default", "primary": "217 91% 60%", "secondary": "217 33% 17%"}');

-- Insert some default Bible verses
INSERT INTO public.bible_verses (reference, text, day_of_year) VALUES
('John 3:16', 'For God so loved the world that he gave his one and only Son, that whoever believes in him shall not perish but have eternal life.', 1),
('Philippians 4:13', 'I can do all this through him who gives me strength.', 2),
('Jeremiah 29:11', 'For I know the plans I have for you, declares the LORD, plans to prosper you and not to harm you, plans to give you hope and a future.', 3),
('Psalm 23:1', 'The LORD is my shepherd, I lack nothing.', 4),
('Romans 8:28', 'And we know that in all things God works for the good of those who love him, who have been called according to his purpose.', 5),
('Proverbs 3:5-6', 'Trust in the LORD with all your heart and lean not on your own understanding; in all your ways submit to him, and he will make your paths straight.', 6),
('Isaiah 40:31', 'But those who hope in the LORD will renew their strength. They will soar on wings like eagles; they will run and not grow weary, they will walk and not be faint.', 7),
('Joshua 1:9', 'Have I not commanded you? Be strong and courageous. Do not be afraid; do not be discouraged, for the LORD your God will be with you wherever you go.', 8),
('Psalm 46:10', 'Be still, and know that I am God; I will be exalted among the nations, I will be exalted in the earth.', 9),
('Matthew 11:28', 'Come to me, all you who are weary and burdened, and I will give you rest.', 10),
('Romans 12:2', 'Do not conform to the pattern of this world, but be transformed by the renewing of your mind.', 11),
('Galatians 5:22-23', 'But the fruit of the Spirit is love, joy, peace, forbearance, kindness, goodness, faithfulness, gentleness and self-control.', 12),
('Hebrews 11:1', 'Now faith is confidence in what we hope for and assurance about what we do not see.', 13),
('1 Corinthians 13:4', 'Love is patient, love is kind. It does not envy, it does not boast, it is not proud.', 14);

-- Function to auto-assign admin role based on email
CREATE OR REPLACE FUNCTION public.check_and_assign_admin_role()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    user_email TEXT;
BEGIN
    -- Get user email from auth.users
    SELECT email INTO user_email FROM auth.users WHERE id = NEW.user_id;
    
    -- Check if email is in admin_emails table
    IF EXISTS (SELECT 1 FROM public.admin_emails WHERE email = user_email) THEN
        INSERT INTO public.user_roles (user_id, role) 
        VALUES (NEW.user_id, 'admin')
        ON CONFLICT (user_id, role) DO NOTHING;
    END IF;
    
    RETURN NEW;
END;
$$;

-- Trigger to check admin status when profile is created
CREATE TRIGGER on_profile_created_check_admin
    AFTER INSERT ON public.profiles
    FOR EACH ROW
    EXECUTE FUNCTION public.check_and_assign_admin_role();