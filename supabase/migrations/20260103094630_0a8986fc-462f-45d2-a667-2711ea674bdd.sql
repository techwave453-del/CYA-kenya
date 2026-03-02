-- Create tasks table
CREATE TABLE public.tasks (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  title TEXT NOT NULL,
  description TEXT,
  due_date DATE,
  completed BOOLEAN NOT NULL DEFAULT false,
  priority TEXT NOT NULL DEFAULT 'medium' CHECK (priority IN ('low', 'medium', 'high')),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create activities table
CREATE TABLE public.activities (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  title TEXT NOT NULL,
  date TEXT NOT NULL,
  location TEXT,
  attendees INTEGER NOT NULL DEFAULT 0,
  image_url TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS on both tables
ALTER TABLE public.tasks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.activities ENABLE ROW LEVEL SECURITY;

-- Tasks RLS policies - Anyone can view, only admins can modify
CREATE POLICY "Anyone can view tasks" 
ON public.tasks 
FOR SELECT 
USING (true);

CREATE POLICY "Admins can insert tasks" 
ON public.tasks 
FOR INSERT 
TO authenticated
WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins can update tasks" 
ON public.tasks 
FOR UPDATE 
TO authenticated
USING (public.has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins can delete tasks" 
ON public.tasks 
FOR DELETE 
TO authenticated
USING (public.has_role(auth.uid(), 'admin'::app_role));

-- Activities RLS policies - Anyone can view, only admins can modify
CREATE POLICY "Anyone can view activities" 
ON public.activities 
FOR SELECT 
USING (true);

CREATE POLICY "Admins can insert activities" 
ON public.activities 
FOR INSERT 
TO authenticated
WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins can update activities" 
ON public.activities 
FOR UPDATE 
TO authenticated
USING (public.has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins can delete activities" 
ON public.activities 
FOR DELETE 
TO authenticated
USING (public.has_role(auth.uid(), 'admin'::app_role));

-- Add triggers for updated_at
CREATE TRIGGER update_tasks_updated_at
BEFORE UPDATE ON public.tasks
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_activities_updated_at
BEFORE UPDATE ON public.activities
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Insert sample data
INSERT INTO public.tasks (title, description, due_date, completed, priority) VALUES
('Prepare Sunday worship set', 'Select songs and practice with the team', '2025-12-21', false, 'high'),
('Community outreach planning', 'Coordinate with local churches', '2025-12-22', true, 'medium'),
('Youth camp registration', 'Open registration for January camp', '2025-12-25', false, 'medium');

INSERT INTO public.activities (title, date, location, attendees, image_url) VALUES
('CYA Bash Event', 'December 21, 2025', 'Nairobi Community Center', 156, NULL),
('Weekly Bible Study', 'Every Wednesday, 6 PM', 'Online & In-Person', 45, NULL),
('Community Service Day', 'December 28, 2025', 'Kibera Area', 78, NULL);