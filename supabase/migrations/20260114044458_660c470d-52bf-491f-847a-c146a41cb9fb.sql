-- Create branding storage bucket
INSERT INTO storage.buckets (id, name, public)
VALUES ('branding', 'branding', true);

-- Allow public read access
CREATE POLICY "Branding images are publicly accessible"
ON storage.objects FOR SELECT
USING (bucket_id = 'branding');

-- Allow admins to upload branding images
CREATE POLICY "Admins can upload branding images"
ON storage.objects FOR INSERT
WITH CHECK (
  bucket_id = 'branding' 
  AND EXISTS (
    SELECT 1 FROM public.user_roles 
    WHERE user_id = auth.uid() 
    AND role = 'admin'
  )
);

-- Allow admins to update branding images
CREATE POLICY "Admins can update branding images"
ON storage.objects FOR UPDATE
USING (
  bucket_id = 'branding' 
  AND EXISTS (
    SELECT 1 FROM public.user_roles 
    WHERE user_id = auth.uid() 
    AND role = 'admin'
  )
);

-- Allow admins to delete branding images
CREATE POLICY "Admins can delete branding images"
ON storage.objects FOR DELETE
USING (
  bucket_id = 'branding' 
  AND EXISTS (
    SELECT 1 FROM public.user_roles 
    WHERE user_id = auth.uid() 
    AND role = 'admin'
  )
);