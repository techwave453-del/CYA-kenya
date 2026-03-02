import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { getAll, putAll, put, remove as removeFromDb, addToSyncQueue } from "@/lib/offlineDb";

export interface Activity {
  id: string;
  title: string;
  date: string;
  location: string | null;
  attendees: number;
  image_url: string | null;
  created_at: string;
  updated_at: string;
}

const STORE_NAME = 'activities';

export const useActivities = () => {
  const [activities, setActivities] = useState<Activity[]>([]);
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

  const fetchActivities = async () => {
    setLoading(true);

    try {
      if (isOnline) {
        const { data, error } = await supabase
          .from("activities")
          .select("*")
          .order("created_at", { ascending: false });

        if (error) {
          throw error;
        }

        const serverActivities = (data || []) as Activity[];
        setActivities(serverActivities);
        await putAll(STORE_NAME, serverActivities);
      } else {
        const cachedActivities = await getAll<Activity>(STORE_NAME);
        setActivities(cachedActivities.sort((a, b) => 
          new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
        ));
      }
    } catch (error) {
      console.error("Error fetching activities:", error);
      const cachedActivities = await getAll<Activity>(STORE_NAME);
      setActivities(cachedActivities);
    }

    setLoading(false);
  };

  useEffect(() => {
    fetchActivities();
  }, [isOnline]);

  // Listen for sync complete
  useEffect(() => {
    const handleSyncComplete = () => {
      if (isOnline) fetchActivities();
    };
    window.addEventListener('sync-complete', handleSyncComplete);
    return () => window.removeEventListener('sync-complete', handleSyncComplete);
  }, [isOnline]);

  const createActivity = async (activity: Omit<Activity, "id" | "created_at" | "updated_at">) => {
    const newActivity: Activity = {
      ...activity,
      id: crypto.randomUUID(),
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };

    setActivities(prev => [newActivity, ...prev]);
    await put(STORE_NAME, newActivity);

    if (isOnline) {
      const { error } = await supabase.from("activities").insert(activity);
      if (error) throw error;
      await fetchActivities();
    } else {
      await addToSyncQueue({ table: 'activities', action: 'insert', data: newActivity });
    }
  };

  const updateActivity = async (id: string, updates: Partial<Activity>) => {
    setActivities(prev => prev.map(a => a.id === id ? { ...a, ...updates, updated_at: new Date().toISOString() } : a));
    
    const existing = activities.find(a => a.id === id);
    if (existing) {
      await put(STORE_NAME, { ...existing, ...updates, updated_at: new Date().toISOString() });
    }

    if (isOnline) {
      const { error } = await supabase.from("activities").update(updates).eq("id", id);
      if (error) throw error;
      await fetchActivities();
    } else {
      await addToSyncQueue({ table: 'activities', action: 'update', data: { id, ...updates } });
    }
  };

  const deleteActivity = async (id: string) => {
    setActivities(prev => prev.filter(a => a.id !== id));
    await removeFromDb(STORE_NAME, id);

    if (isOnline) {
      const { error } = await supabase.from("activities").delete().eq("id", id);
      if (error) throw error;
    } else {
      await addToSyncQueue({ table: 'activities', action: 'delete', data: { id } });
    }
  };

  return { activities, loading, fetchActivities, createActivity, updateActivity, deleteActivity };
};
