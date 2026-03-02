import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

export interface BrandingImage {
  name: string;
  url: string;
  path: string;
}

export const useBranding = () => {
  const [images, setImages] = useState<BrandingImage[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const { toast } = useToast();

  const fetchImages = async () => {
    try {
      const { data, error } = await supabase.storage
        .from('branding')
        .list('', { limit: 100 });

      if (error) throw error;

      const imageList: BrandingImage[] = (data || []).map((file) => ({
        name: file.name,
        path: file.name,
        url: supabase.storage.from('branding').getPublicUrl(file.name).data.publicUrl,
      }));

      setImages(imageList);
    } catch (error) {
      console.error('Error fetching branding images:', error);
    } finally {
      setLoading(false);
    }
  };

  const uploadImage = async (file: File, customName?: string) => {
    setUploading(true);
    try {
      const fileName = customName || file.name;
      const filePath = fileName.includes('.') ? fileName : `${fileName}.${file.name.split('.').pop()}`;
      
      const { error: uploadError } = await supabase.storage
        .from('branding')
        .upload(filePath, file, { upsert: true });

      if (uploadError) throw uploadError;

      toast({ title: "Image uploaded successfully" });
      await fetchImages();
      return true;
    } catch (error) {
      console.error('Error uploading image:', error);
      toast({ 
        title: "Upload failed", 
        description: error instanceof Error ? error.message : "Failed to upload image",
        variant: "destructive" 
      });
      return false;
    } finally {
      setUploading(false);
    }
  };

  const deleteImage = async (path: string) => {
    try {
      const { error } = await supabase.storage
        .from('branding')
        .remove([path]);

      if (error) throw error;

      toast({ title: "Image deleted" });
      await fetchImages();
      return true;
    } catch (error) {
      console.error('Error deleting image:', error);
      toast({ 
        title: "Delete failed", 
        description: error instanceof Error ? error.message : "Failed to delete image",
        variant: "destructive" 
      });
      return false;
    }
  };

  useEffect(() => {
    fetchImages();
  }, []);

  return {
    images,
    loading,
    uploading,
    uploadImage,
    deleteImage,
    refreshImages: fetchImages,
  };
};
