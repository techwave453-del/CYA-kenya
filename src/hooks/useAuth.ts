import { useState, useEffect } from "react";
import { User, Session } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";
import { saveAuthSession, getAuthSession, clearAuthSession, put, getById } from "@/lib/offlineDb";

interface Profile {
  id: string;
  user_id: string;
  username: string;
  avatar_url: string | null;
}

export const useAuth = () => {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
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
    const initAuth = async () => {
      if (isOnline) {
        // Set up auth state listener FIRST
        const { data: { subscription } } = supabase.auth.onAuthStateChange(
          async (event, session) => {
            setSession(session);
            setUser(session?.user ?? null);
            
            if (session?.user) {
              // Cache session for offline use
              await saveAuthSession({
                id: 'current',
                user: session.user,
                access_token: session.access_token,
                refresh_token: session.refresh_token,
                expires_at: session.expires_at || 0,
              });
              
              // Defer profile fetch
              setTimeout(() => {
                fetchProfile(session.user.id);
              }, 0);
            } else {
              setProfile(null);
              await clearAuthSession();
            }
          }
        );

        // THEN check for existing session
        const { data: { session } } = await supabase.auth.getSession();
        setSession(session);
        setUser(session?.user ?? null);
        
        if (session?.user) {
          await fetchProfile(session.user.id);
        }
        
        setLoading(false);

        return () => subscription.unsubscribe();
      } else {
        // Offline - try to restore from cache
        try {
          const cachedSession = await getAuthSession();
          if (cachedSession && cachedSession.expires_at * 1000 > Date.now()) {
            setUser(cachedSession.user as User);
            // Try to get cached profile
            const cachedProfile = await getById<Profile>('profiles', 'current');
            if (cachedProfile) {
              setProfile(cachedProfile);
            }
          }
        } catch (e) {
          console.log("Failed to restore offline session:", e);
        }
        setLoading(false);
      }
    };

    initAuth();
  }, [isOnline]);

  const fetchProfile = async (userId: string) => {
    try {
      if (isOnline) {
        const { data, error } = await supabase
          .from("profiles")
          .select("*")
          .eq("user_id", userId)
          .maybeSingle();

        if (!error && data) {
          setProfile(data);
          // Cache profile for offline use
          await put('profiles', { ...data, id: 'current' });
        }
      } else {
        const cachedProfile = await getById<Profile>('profiles', 'current');
        if (cachedProfile) {
          setProfile(cachedProfile);
        }
      }
    } catch (e) {
      console.error("Error fetching profile:", e);
    }
  };

  const signOut = async () => {
    await supabase.auth.signOut();
    setUser(null);
    setSession(null);
    setProfile(null);
    await clearAuthSession();
  };

  return {
    user,
    session,
    profile,
    loading,
    signOut,
    isAuthenticated: !!session || !!user,
  };
};
