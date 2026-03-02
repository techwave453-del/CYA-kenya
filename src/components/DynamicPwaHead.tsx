import { useEffect } from "react";
import { usePwaIcons } from "@/hooks/usePwaIcons";

/**
 * This component dynamically updates the PWA-related meta tags and link elements
 * to use custom icons from the branding storage bucket when available.
 */
const DynamicPwaHead = () => {
  const { icons, loading } = usePwaIcons();

  useEffect(() => {
    if (loading) return;

    // Update apple-touch-icon
    const appleTouchIcon = document.querySelector('link[rel="apple-touch-icon"]');
    if (appleTouchIcon) {
      appleTouchIcon.setAttribute('href', icons.appleTouchIcon);
    }

    // Create or update a dynamic manifest with custom icons
    updateDynamicManifest(icons);
  }, [icons, loading]);

  return null;
};

const updateDynamicManifest = async (icons: { icon192: string; icon512: string }) => {
  // Check if icons are custom (from storage) or default
  const isCustom192 = icons.icon192.includes('supabase');
  const isCustom512 = icons.icon512.includes('supabase');

  if (!isCustom192 && !isCustom512) {
    // No custom icons, use the default manifest
    return;
  }

  // Create a dynamic manifest blob with custom icons
  const manifest = {
    name: "CYA Kenya - Christian Youth in Action",
    short_name: "CYA Kenya",
    description: "Empowering Christian youth in Kenya through fellowship, worship, and community service.",
    theme_color: "#1a1a2e",
    background_color: "#1a1a2e",
    display: "standalone",
    orientation: "portrait",
    scope: "/",
    start_url: "/",
    icons: [
      {
        src: icons.icon192,
        sizes: "192x192",
        type: "image/png",
      },
      {
        src: icons.icon512,
        sizes: "512x512",
        type: "image/png",
      },
      {
        src: icons.icon512,
        sizes: "512x512",
        type: "image/png",
        purpose: "any maskable",
      },
    ],
  };

  const blob = new Blob([JSON.stringify(manifest)], { type: 'application/json' });
  const manifestUrl = URL.createObjectURL(blob);

  // Update the manifest link
  const manifestLink = document.querySelector('link[rel="manifest"]');
  if (manifestLink) {
    manifestLink.setAttribute('href', manifestUrl);
  }
};

export default DynamicPwaHead;
