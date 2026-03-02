import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";

interface PwaIcons {
  icon192: string;
  icon512: string;
  appleTouchIcon: string;
}

const DEFAULT_ICONS: PwaIcons = {
  icon192: "/pwa-192x192.png",
  icon512: "/pwa-512x512.png",
  appleTouchIcon: "/pwa-192x192.png",
};

export const usePwaIcons = () => {
  const [icons, setIcons] = useState<PwaIcons>(DEFAULT_ICONS);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchCustomIcons = async () => {
      try {
        const { data: files } = await supabase.storage
          .from('branding')
          .list('', { limit: 100 });

        if (!files) {
          setLoading(false);
          return;
        }

        const customIcons: Partial<PwaIcons> = {};

        // Check for custom 192x192 icon
        const icon192File = files.find(f => f.name.startsWith('pwa-192x192'));
        if (icon192File) {
          const { data } = supabase.storage.from('branding').getPublicUrl(icon192File.name);
          customIcons.icon192 = data.publicUrl;
          customIcons.appleTouchIcon = data.publicUrl;
        }

        // Check for custom 512x512 icon
        const icon512File = files.find(f => f.name.startsWith('pwa-512x512'));
        if (icon512File) {
          const { data } = supabase.storage.from('branding').getPublicUrl(icon512File.name);
          customIcons.icon512 = data.publicUrl;
        }

        setIcons({ ...DEFAULT_ICONS, ...customIcons });
      } catch (error) {
        console.error('Error fetching custom PWA icons:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchCustomIcons();
  }, []);

  return { icons, loading };
};

// Utility to get icon URLs without hook (for manifest generation)
export const getCustomPwaIconUrls = async (): Promise<PwaIcons> => {
  try {
    const { data: files } = await supabase.storage
      .from('branding')
      .list('', { limit: 100 });

    if (!files) return DEFAULT_ICONS;

    const customIcons: Partial<PwaIcons> = {};

    const icon192File = files.find(f => f.name.startsWith('pwa-192x192'));
    if (icon192File) {
      const { data } = supabase.storage.from('branding').getPublicUrl(icon192File.name);
      customIcons.icon192 = data.publicUrl;
      customIcons.appleTouchIcon = data.publicUrl;
    }

    const icon512File = files.find(f => f.name.startsWith('pwa-512x512'));
    if (icon512File) {
      const { data } = supabase.storage.from('branding').getPublicUrl(icon512File.name);
      customIcons.icon512 = data.publicUrl;
    }

    return { ...DEFAULT_ICONS, ...customIcons };
  } catch {
    return DEFAULT_ICONS;
  }
};
