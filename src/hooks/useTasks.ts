import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { getAll, putAll, put, remove as removeFromDb, addToSyncQueue } from "@/lib/offlineDb";

export interface Task {
  id: string;
  title: string;
  description: string | null;
  due_date: string | null;
  completed: boolean;
  priority: "low" | "medium" | "high";
  created_at: string;
  updated_at: string;
}

const STORE_NAME = 'tasks';

export const useTasks = () => {
  const [tasks, setTasks] = useState<Task[]>([]);
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

  const fetchTasks = async () => {
    setLoading(true);

    try {
      if (isOnline) {
        const { data, error } = await supabase
          .from("tasks")
          .select("*")
          .order("due_date", { ascending: true });

        if (error) {
          throw error;
        }

        const serverTasks = (data || []) as Task[];
        setTasks(serverTasks);
        await putAll(STORE_NAME, serverTasks);
      } else {
        const cachedTasks = await getAll<Task>(STORE_NAME);
        setTasks(cachedTasks.sort((a, b) => {
          if (!a.due_date) return 1;
          if (!b.due_date) return -1;
          return new Date(a.due_date).getTime() - new Date(b.due_date).getTime();
        }));
      }
    } catch (error) {
      console.error("Error fetching tasks:", error);
      const cachedTasks = await getAll<Task>(STORE_NAME);
      setTasks(cachedTasks);
    }

    setLoading(false);
  };

  useEffect(() => {
    fetchTasks();
  }, [isOnline]);

  // Listen for sync complete
  useEffect(() => {
    const handleSyncComplete = () => {
      if (isOnline) fetchTasks();
    };
    window.addEventListener('sync-complete', handleSyncComplete);
    return () => window.removeEventListener('sync-complete', handleSyncComplete);
  }, [isOnline]);

  const createTask = async (task: Omit<Task, "id" | "created_at" | "updated_at">) => {
    const newTask: Task = {
      ...task,
      id: crypto.randomUUID(),
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };

    setTasks(prev => [...prev, newTask]);
    await put(STORE_NAME, newTask);

    if (isOnline) {
      const { error } = await supabase.from("tasks").insert(task);
      if (error) throw error;
      await fetchTasks();
    } else {
      await addToSyncQueue({ table: 'tasks', action: 'insert', data: newTask });
    }
  };

  const updateTask = async (id: string, updates: Partial<Task>) => {
    setTasks(prev => prev.map(t => t.id === id ? { ...t, ...updates, updated_at: new Date().toISOString() } : t));
    
    const existing = tasks.find(t => t.id === id);
    if (existing) {
      await put(STORE_NAME, { ...existing, ...updates, updated_at: new Date().toISOString() });
    }

    if (isOnline) {
      const { error } = await supabase.from("tasks").update(updates).eq("id", id);
      if (error) throw error;
      await fetchTasks();
    } else {
      await addToSyncQueue({ table: 'tasks', action: 'update', data: { id, ...updates } });
    }
  };

  const deleteTask = async (id: string) => {
    setTasks(prev => prev.filter(t => t.id !== id));
    await removeFromDb(STORE_NAME, id);

    if (isOnline) {
      const { error } = await supabase.from("tasks").delete().eq("id", id);
      if (error) throw error;
    } else {
      await addToSyncQueue({ table: 'tasks', action: 'delete', data: { id } });
    }
  };

  return { tasks, loading, fetchTasks, createTask, updateTask, deleteTask };
};
