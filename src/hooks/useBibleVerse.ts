import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { getAll, putAll, put } from "@/lib/offlineDb";

interface BibleVerse {
  id: string;
  reference: string;
  text: string;
  day_of_year: number | null;
}

const STORE_NAME = 'bible_verses';
const BIBLE_API_URL = "https://bible-api.com";

// Fallback verses for offline mode when no cache exists
const fallbackVerses: BibleVerse[] = [
  { id: "1", reference: "John 3:16", text: "For God so loved the world that he gave his one and only Son, that whoever believes in him shall not perish but have eternal life.", day_of_year: 1 },
  { id: "2", reference: "Philippians 4:13", text: "I can do all this through him who gives me strength.", day_of_year: 2 },
  { id: "3", reference: "Jeremiah 29:11", text: "For I know the plans I have for you, declares the LORD, plans to prosper you and not to harm you, plans to give you hope and a future.", day_of_year: 3 },
  { id: "4", reference: "Psalm 23:1", text: "The LORD is my shepherd, I lack nothing.", day_of_year: 4 },
  { id: "5", reference: "Romans 8:28", text: "And we know that in all things God works for the good of those who love him, who have been called according to his purpose.", day_of_year: 5 },
  { id: "6", reference: "Proverbs 3:5-6", text: "Trust in the LORD with all your heart and lean not on your own understanding; in all your ways submit to him, and he will make your paths straight.", day_of_year: 6 },
  { id: "7", reference: "Isaiah 40:31", text: "But those who hope in the LORD will renew their strength. They will soar on wings like eagles; they will run and not grow weary, they will walk and not be faint.", day_of_year: 7 },
];

export const useBibleVerse = () => {
  const [verse, setVerse] = useState<BibleVerse | null>(null);
  const [loading, setLoading] = useState(true);
  const [isOnline, setIsOnline] = useState(navigator.onLine);

  useEffect(() => {
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  useEffect(() => {
    const getDayOfYear = () => {
      const now = new Date();
      const start = new Date(now.getFullYear(), 0, 0);
      const diff = now.getTime() - start.getTime();
      const oneDay = 1000 * 60 * 60 * 24;
      return Math.floor(diff / oneDay);
    };

    const getVerseFromCache = async (dayOfYear: number): Promise<BibleVerse | null> => {
      try {
        const cachedVerses = await getAll<BibleVerse>(STORE_NAME);
        if (cachedVerses.length > 0) {
          const index = dayOfYear % cachedVerses.length;
          return cachedVerses[index];
        }
      } catch (e) {
        console.log("Cache read failed:", e);
      }
      return null;
    };

    const fetchVerse = async () => {
      setLoading(true);
      const dayOfYear = getDayOfYear();
      
      try {
        if (isOnline) {
          // First try to get from database
          const { data: dbVerses, error } = await supabase
            .from('bible_verses')
            .select('*')
            .order('day_of_year', { ascending: true });

          if (!error && dbVerses && dbVerses.length > 0) {
            // Cache all verses
            await putAll(STORE_NAME, dbVerses);
            
            const index = dayOfYear % dbVerses.length;
            setVerse(dbVerses[index]);
            setLoading(false);
            return;
          }

          // If no database verses, try API
          try {
            const popularVerses = [
              "John 3:16", "Philippians 4:13", "Jeremiah 29:11",
              "Psalm 23:1", "Romans 8:28", "Proverbs 3:5-6", "Isaiah 40:31"
            ];
            const verseRef = popularVerses[dayOfYear % popularVerses.length];
            
            const response = await fetch(`${BIBLE_API_URL}/${encodeURIComponent(verseRef)}`);
            if (response.ok) {
              const data = await response.json();
              const apiVerse: BibleVerse = {
                id: data.reference,
                reference: data.reference,
                text: data.text.trim(),
                day_of_year: dayOfYear
              };
              
              // Cache the verse
              await put(STORE_NAME, apiVerse);
              
              setVerse(apiVerse);
              setLoading(false);
              return;
            }
          } catch (apiError) {
            console.log("API fetch failed, checking cache");
          }
        }

        // Offline or failed - try cache first
        const cachedVerse = await getVerseFromCache(dayOfYear);
        if (cachedVerse) {
          setVerse(cachedVerse);
          setLoading(false);
          return;
        }

        // Final fallback
        const fallbackIndex = dayOfYear % fallbackVerses.length;
        setVerse(fallbackVerses[fallbackIndex]);
      } catch (err) {
        console.error("Error fetching verse:", err);
        const fallbackIndex = dayOfYear % fallbackVerses.length;
        setVerse(fallbackVerses[fallbackIndex]);
      } finally {
        setLoading(false);
      }
    };

    fetchVerse();
  }, [isOnline]);

  return { verse, loading, isOnline };
};
