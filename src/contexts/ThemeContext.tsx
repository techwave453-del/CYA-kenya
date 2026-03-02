import React, { createContext, useContext, useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";

export interface Theme {
  name: string;
  label: string;
  primary: string;
  secondary: string;
  accent: string;
  background: string;
  foreground: string;
}

export const themes: Theme[] = [
  {
    name: "default",
    label: "Navy & Gold",
    primary: "45 100% 50%",
    secondary: "220 15% 20%",
    accent: "45 100% 50%",
    background: "220 25% 10%",
    foreground: "45 100% 96%"
  },
  {
    name: "ocean",
    label: "Ocean Blue",
    primary: "199 89% 48%",
    secondary: "200 50% 20%",
    accent: "199 89% 48%",
    background: "200 50% 8%",
    foreground: "200 20% 95%"
  },
  {
    name: "forest",
    label: "Forest Green",
    primary: "142 76% 36%",
    secondary: "140 30% 20%",
    accent: "142 76% 36%",
    background: "140 30% 8%",
    foreground: "140 20% 95%"
  },
  {
    name: "sunset",
    label: "Sunset Orange",
    primary: "25 95% 53%",
    secondary: "25 30% 20%",
    accent: "25 95% 53%",
    background: "25 30% 8%",
    foreground: "30 20% 95%"
  },
  {
    name: "royal",
    label: "Royal Purple",
    primary: "271 81% 56%",
    secondary: "270 30% 20%",
    accent: "271 81% 56%",
    background: "270 30% 8%",
    foreground: "270 20% 95%"
  },
  {
    name: "rose",
    label: "Rose Pink",
    primary: "346 77% 50%",
    secondary: "345 30% 20%",
    accent: "346 77% 50%",
    background: "345 30% 8%",
    foreground: "345 20% 95%"
  },
  {
    name: "light",
    label: "Light Mode",
    primary: "217 91% 60%",
    secondary: "217 20% 90%",
    accent: "217 91% 60%",
    background: "0 0% 100%",
    foreground: "217 33% 17%"
  }
  ,
  {
    name: "midnight",
    label: "Midnight",
    primary: "230 30% 12%",
    secondary: "230 20% 6%",
    accent: "200 80% 60%",
    background: "230 20% 6%",
    foreground: "220 20% 90%"
  },
  {
    name: "sunrise",
    label: "Sunrise",
    primary: "28 85% 56%",
    secondary: "25 30% 12%",
    accent: "45 95% 58%",
    background: "25 40% 8%",
    foreground: "30 20% 96%"
  },
  {
    name: "mint",
    label: "Mint Fresh",
    primary: "150 60% 48%",
    secondary: "150 20% 92%",
    accent: "150 60% 48%",
    background: "150 30% 10%",
    foreground: "150 20% 96%"
  }
];

interface ThemeContextType {
  currentTheme: Theme;
  setTheme: (theme: Theme) => void;
  isLoading: boolean;
}

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

export const ThemeProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [currentTheme, setCurrentTheme] = useState<Theme>(themes[0]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const fetchTheme = async () => {
      try {
        const { data, error } = await supabase
          .from('app_settings')
          .select('value')
          .eq('key', 'theme')
          .maybeSingle();

        if (error) {
          console.error('Error fetching theme:', error);
        } else if (data?.value) {
          const themeName = (data.value as { name: string }).name;
          const foundTheme = themes.find(t => t.name === themeName);
          if (foundTheme) {
            setCurrentTheme(foundTheme);
            applyTheme(foundTheme);
          }
        }
      } catch (err) {
        console.error('Error in theme fetch:', err);
      } finally {
        setIsLoading(false);
      }
    };

    // Fetch and apply background settings (image/video)
    const fetchBackground = async () => {
      try {
        const { data, error } = await supabase
          .from('app_settings')
          .select('value')
          .eq('key', 'background')
          .maybeSingle();
        if (!error && data?.value) {
          const payload = data.value as { imageUrl?: string | null; videoUrl?: string | null };
          applyBackground(payload);
        }
      } catch (err) {
        console.error('Error fetching background:', err);
      }
    };

    // Check local storage first for faster initial load
    const savedTheme = localStorage.getItem('app-theme');
    if (savedTheme) {
      const parsed = JSON.parse(savedTheme);
      const foundTheme = themes.find(t => t.name === parsed.name);
      if (foundTheme) {
        setCurrentTheme(foundTheme);
        applyTheme(foundTheme);
      }
    }

    fetchTheme();
    fetchBackground();

    // Listen for real-time theme changes
    const channel = supabase.channel('app-settings-changes')
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'app_settings',
        },
        (payload) => {
          try {
            const key = payload.new.key;
            if (key === 'theme') {
              const themeName = (payload.new.value as { name: string }).name;
              const foundTheme = themes.find(t => t.name === themeName);
              if (foundTheme) {
                setCurrentTheme(foundTheme);
                applyTheme(foundTheme);
                localStorage.setItem('app-theme', JSON.stringify(foundTheme));
              }
            }
            if (key === 'background') {
              const payloadVal = payload.new.value as { imageUrl?: string | null; videoUrl?: string | null };
              applyBackground(payloadVal);
            }
          } catch (err) {
            console.error('Error handling app_settings change:', err);
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  // Listen for immediate background updates from admin UI
  useEffect(() => {
    const handler = (e: any) => {
      try {
        const payload = e.detail as { imageUrl?: string | null; videoUrl?: string | null };
        applyBackground(payload);
      } catch (err) {
        console.error('Error applying background from event:', err);
      }
    };
    window.addEventListener('app-background-updated', handler as EventListener);
    return () => window.removeEventListener('app-background-updated', handler as EventListener);
  }, []);

  const applyTheme = (theme: Theme) => {
    const root = document.documentElement;
    root.style.setProperty('--primary', theme.primary);
    root.style.setProperty('--secondary', theme.secondary);
    root.style.setProperty('--accent', theme.accent);
    root.style.setProperty('--background', theme.background);
    root.style.setProperty('--foreground', theme.foreground);
    root.style.setProperty('--ring', theme.primary);

    // Helpers: parse HSL like "45 100% 50%" -> {h,s,l}
    const parseHsl = (hsl: string) => {
      const parts = hsl.split(/\s+/).map(p => p.trim());
      const h = parseFloat(parts[0]) || 0;
      const s = parseFloat(parts[1]?.replace('%','')) || 0;
      const l = parseFloat(parts[2]?.replace('%','')) || 0;
      return { h, s: s/100, l: l/100 };
    };

    // Convert HSL (h in degrees, s,l 0..1) to RGB 0..1
    const hslToRgb = (h:number, s:number, l:number) => {
      const c = (1 - Math.abs(2*l - 1)) * s;
      const hh = h / 60;
      const x = c * (1 - Math.abs(hh % 2 - 1));
      let r1=0,g1=0,b1=0;
      if (0 <= hh && hh < 1) { r1=c; g1=x; b1=0; }
      else if (1 <= hh && hh < 2) { r1=x; g1=c; b1=0; }
      else if (2 <= hh && hh < 3) { r1=0; g1=c; b1=x; }
      else if (3 <= hh && hh < 4) { r1=0; g1=x; b1=c; }
      else if (4 <= hh && hh < 5) { r1=x; g1=0; b1=c; }
      else { r1=c; g1=0; b1=x; }
      const m = l - c/2;
      return { r: r1 + m, g: g1 + m, b: b1 + m };
    };

    // Relative luminance from RGB 0..1
    const luminance = (rgb:{r:number,g:number,b:number}) => {
      const srgb = (v:number) => v <= 0.03928 ? v/12.92 : Math.pow((v+0.055)/1.055, 2.4);
      const R = srgb(rgb.r);
      const G = srgb(rgb.g);
      const B = srgb(rgb.b);
      return 0.2126*R + 0.7152*G + 0.0722*B;
    };

    const readableForegroundFor = (hslStr: string) => {
      try {
        const {h,s,l} = parseHsl(hslStr);
        const rgb = hslToRgb(h,s,l);
        const L = luminance(rgb);
        // If background is light, use dark text; otherwise use light text
        if (L > 0.5) return '217 33% 17%'; // dark text (navy-ish)
        return '0 0% 96%'; // light text (near white)
      } catch {
        return theme.foreground;
      }
    };

    // Update card/popover/border/input colors based on theme, ensuring readable foregrounds
    if (theme.name === 'light') {
      root.style.setProperty('--card', '0 0% 98%');
      root.style.setProperty('--card-foreground', '217 33% 17%');
      root.style.setProperty('--popover', '0 0% 98%');
      root.style.setProperty('--popover-foreground', '217 33% 17%');
      root.style.setProperty('--muted', '217 20% 92%');
      root.style.setProperty('--muted-foreground', '217 20% 40%');
      root.style.setProperty('--border', '217 20% 85%');
      root.style.setProperty('--input', '217 20% 85%');
    } else {
      // use secondary as card/background for components and compute readable foregrounds
      root.style.setProperty('--card', theme.secondary);
      root.style.setProperty('--card-foreground', readableForegroundFor(theme.secondary));
      root.style.setProperty('--popover', theme.secondary);
      root.style.setProperty('--popover-foreground', readableForegroundFor(theme.secondary));
      root.style.setProperty('--muted', theme.secondary);
      root.style.setProperty('--muted-foreground', readableForegroundFor(theme.secondary));
      // border and input use a darker version of background; compute readable foreground for input borders
      root.style.setProperty('--border', theme.background);
      root.style.setProperty('--input', theme.background);
    }
  };

  const setTheme = async (theme: Theme) => {
    setCurrentTheme(theme);
    applyTheme(theme);
    localStorage.setItem('app-theme', JSON.stringify(theme));
  };

  // Apply background image or video globally
  const applyBackground = (payload: { imageUrl?: string | null; videoUrl?: string | null } | null) => {
    try {
      const body = document.body;
      // remove existing video if any
      const existing = document.getElementById('app-bg-video');
      if (existing) {
        existing.remove();
      }
      if (!payload) {
        document.documentElement.style.setProperty('--app-bg-image', "'" + "" + "'");
        return;
      }

      const { imageUrl, videoUrl } = payload;
      if (videoUrl) {
        // create a fixed video element behind app content
        const video = document.createElement('video');
        video.id = 'app-bg-video';
        video.src = videoUrl;
        video.autoplay = true;
        video.muted = true;
        video.loop = true;
        video.playsInline = true;
        video.style.position = 'fixed';
        video.style.top = '0';
        video.style.left = '0';
        video.style.width = '100%';
        video.style.height = '100%';
        video.style.objectFit = 'cover';
        video.style.zIndex = '-1';
        video.style.pointerEvents = 'none';
        document.body.prepend(video);
        // clear CSS background image variable
        document.documentElement.style.setProperty('--app-bg-image', "''");
      } else if (imageUrl) {
        document.documentElement.style.setProperty('--app-bg-image', `url('${imageUrl}')`);
      } else {
        // clear
        document.documentElement.style.setProperty('--app-bg-image', "''");
      }
    } catch (err) {
      console.error('Error applying background:', err);
    }
  };

  return (
    <ThemeContext.Provider value={{ currentTheme, setTheme, isLoading }}>
      {children}
    </ThemeContext.Provider>
  );
};

export const useTheme = () => {
  const context = useContext(ThemeContext);
  if (context === undefined) {
    throw new Error('useTheme must be used within a ThemeProvider');
  }
  return context;
};
