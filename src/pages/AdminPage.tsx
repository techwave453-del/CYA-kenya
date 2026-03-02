import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { useAdmin } from "@/hooks/useAdmin";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
// theme control moved to user profile settings; Admin controls background media
import { useTasks, Task } from "@/hooks/useTasks";
import { useActivities, Activity } from "@/hooks/useActivities";
import { Shield, Users, BookOpen, Plus, Trash2, RefreshCw, ArrowLeft, ListTodo, CalendarDays, Pencil, Gamepad2, Image } from "lucide-react";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { z } from "zod";
import AdminGameManagement from "@/components/games/AdminGameManagement";
import BrandingManagement from "@/components/admin/BrandingManagement";
import DailyStoryManagement from "@/components/admin/DailyStoryManagement";

const emailSchema = z.string().email("Invalid email address");
const passwordSchema = z.string().min(6, "Password must be at least 6 characters");

interface AdminEmail {
  id: string;
  email: string;
  created_at: string;
}

interface Profile {
  id: string;
  user_id: string;
  username: string;
  avatar_url: string | null;
}

interface BibleVerse {
  id: string;
  reference: string;
  text: string;
  day_of_year: number | null;
}

const AdminPage = () => {
  const navigate = useNavigate();
  const { user, loading: authLoading } = useAuth();
  const { isAdmin, loading: adminLoading } = useAdmin();
  const { toast } = useToast();
  const { tasks, fetchTasks, createTask, updateTask, deleteTask } = useTasks();
  const { activities, fetchActivities, createActivity, updateActivity, deleteActivity } = useActivities();

  // User Management State
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [adminEmails, setAdminEmails] = useState<AdminEmail[]>([]);
  const [newAdminEmail, setNewAdminEmail] = useState("");
  const [newUserEmail, setNewUserEmail] = useState("");
  const [newUserPassword, setNewUserPassword] = useState("");
  const [newUserUsername, setNewUserUsername] = useState("");
  const [resetPasswordEmail, setResetPasswordEmail] = useState("");
  const [loadingAction, setLoadingAction] = useState(false);

  // Bible Verse State
  const [verses, setVerses] = useState<BibleVerse[]>([]);
  const [newVerseReference, setNewVerseReference] = useState("");
  const [newVerseText, setNewVerseText] = useState("");

  // Task State
  const [newTaskTitle, setNewTaskTitle] = useState("");
  const [newTaskDescription, setNewTaskDescription] = useState("");
  const [newTaskDueDate, setNewTaskDueDate] = useState("");
  const [newTaskPriority, setNewTaskPriority] = useState<"low" | "medium" | "high">("medium");
  const [editingTask, setEditingTask] = useState<Task | null>(null);

  // Activity State
  const [newActivityTitle, setNewActivityTitle] = useState("");
  const [newActivityDate, setNewActivityDate] = useState("");
  const [newActivityLocation, setNewActivityLocation] = useState("");
  const [newActivityAttendees, setNewActivityAttendees] = useState("0");
  const [newActivityImageUrl, setNewActivityImageUrl] = useState("");
  const [editingActivity, setEditingActivity] = useState<Activity | null>(null);

  // Delete User Dialog State
  const [userToDelete, setUserToDelete] = useState<Profile | null>(null);

  useEffect(() => {
    if (!authLoading && !adminLoading) {
      if (!user) {
        navigate("/auth");
        return;
      }
      if (!isAdmin) {
        toast({
          title: "Access Denied",
          description: "You don't have admin privileges.",
          variant: "destructive",
        });
        navigate("/");
        return;
      }
      fetchData();
    }
  }, [authLoading, adminLoading, user, isAdmin, navigate]);

  const fetchData = async () => {
    // Fetch profiles
    const { data: profileData } = await supabase
      .from('profiles')
      .select('*')
      .order('created_at', { ascending: false });
    if (profileData) setProfiles(profileData);

    // Fetch admin emails
    const { data: adminData } = await supabase
      .from('admin_emails')
      .select('*')
      .order('created_at', { ascending: false });
    if (adminData) setAdminEmails(adminData);

    // Fetch bible verses
    const { data: verseData } = await supabase
      .from('bible_verses')
      .select('*')
      .order('day_of_year', { ascending: true });
    if (verseData) setVerses(verseData);

    // Fetch background setting if present
    const { data: bgData } = await supabase
      .from('app_settings')
      .select('value')
      .eq('key', 'background')
      .maybeSingle();
    if (bgData?.value) {
      try {
        const parsed = bgData.value as { imageUrl?: string; videoUrl?: string };
        setBackgroundImage(parsed.imageUrl || "");
        setBackgroundVideo(parsed.videoUrl || "");
      } catch {}
    }
  };

  const [backgroundImage, setBackgroundImage] = useState("");
  const [backgroundVideo, setBackgroundVideo] = useState("");
  const [previewVideoError, setPreviewVideoError] = useState<string | null>(null);

  const handleSaveBackground = async () => {
    setLoadingAction(true);
    const payload = { imageUrl: backgroundImage || null, videoUrl: backgroundVideo || null };
    const { error } = await supabase
      .from('app_settings')
      .upsert({ key: 'background', value: payload, updated_by: user?.id }, { onConflict: 'key' });

    if (error) {
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
    } else {
      toast({ title: 'Background updated' });
      try {
        const evt = new CustomEvent('app-background-updated', { detail: payload });
        window.dispatchEvent(evt);
      } catch {}
    }
    setLoadingAction(false);
  };

  const handleAddAdminEmail = async () => {
    try {
      emailSchema.parse(newAdminEmail);
    } catch {
      toast({ title: "Invalid email format", variant: "destructive" });
      return;
    }

    setLoadingAction(true);
    const { error } = await supabase
      .from('admin_emails')
      .insert({ email: newAdminEmail.toLowerCase().trim() });

    if (error) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    } else {
      toast({ title: "Admin email added successfully" });
      setNewAdminEmail("");
      fetchData();
    }
    setLoadingAction(false);
  };

  const handleRemoveAdminEmail = async (id: string) => {
    setLoadingAction(true);
    const { error } = await supabase
      .from('admin_emails')
      .delete()
      .eq('id', id);

    if (error) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    } else {
      toast({ title: "Admin email removed" });
      fetchData();
    }
    setLoadingAction(false);
  };

  const handleCreateUser = async () => {
    try {
      emailSchema.parse(newUserEmail);
      passwordSchema.parse(newUserPassword);
      if (!newUserUsername.trim()) throw new Error("Username required");
    } catch (err) {
      toast({ title: "Validation Error", description: err instanceof Error ? err.message : "Invalid input", variant: "destructive" });
      return;
    }

    setLoadingAction(true);
    
    const { data, error } = await supabase.functions.invoke('admin-create-user', {
      body: {
        email: newUserEmail.toLowerCase().trim(),
        password: newUserPassword,
        username: newUserUsername.trim()
      }
    });

    if (error) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    } else if (data?.error) {
      toast({ title: "Error", description: data.error, variant: "destructive" });
    } else {
      toast({ title: "User created successfully" });
      setNewUserEmail("");
      setNewUserPassword("");
      setNewUserUsername("");
      fetchData();
    }
    setLoadingAction(false);
  };

  const handleResetPassword = async () => {
    try {
      emailSchema.parse(resetPasswordEmail);
    } catch {
      toast({ title: "Invalid email format", variant: "destructive" });
      return;
    }

    setLoadingAction(true);
    const { error } = await supabase.auth.resetPasswordForEmail(
      resetPasswordEmail.toLowerCase().trim(),
      { redirectTo: `${window.location.origin}/auth` }
    );

    if (error) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    } else {
      toast({ title: "Password reset email sent" });
      setResetPasswordEmail("");
    }
    setLoadingAction(false);
  };

  const handleDeleteUser = async () => {
    if (!userToDelete) return;

    setLoadingAction(true);
    
    const { data, error } = await supabase.functions.invoke('admin-delete-user', {
      body: { userId: userToDelete.user_id }
    });

    if (error) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    } else if (data?.error) {
      toast({ title: "Error", description: data.error, variant: "destructive" });
    } else {
      toast({ title: "User deleted successfully" });
      fetchData();
    }
    setUserToDelete(null);
    setLoadingAction(false);
  };

  

  const handleAddVerse = async () => {
    if (!newVerseReference.trim() || !newVerseText.trim()) {
      toast({ title: "Please fill in both reference and text", variant: "destructive" });
      return;
    }

    setLoadingAction(true);
    const nextDayOfYear = verses.length > 0 ? Math.max(...verses.map(v => v.day_of_year || 0)) + 1 : 1;

    const { error } = await supabase
      .from('bible_verses')
      .insert({
        reference: newVerseReference.trim(),
        text: newVerseText.trim(),
        day_of_year: nextDayOfYear
      });

    if (error) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    } else {
      toast({ title: "Verse added successfully" });
      setNewVerseReference("");
      setNewVerseText("");
      fetchData();
    }
    setLoadingAction(false);
  };

  const handleDeleteVerse = async (id: string) => {
    setLoadingAction(true);
    const { error } = await supabase
      .from('bible_verses')
      .delete()
      .eq('id', id);

    if (error) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    } else {
      toast({ title: "Verse deleted" });
      fetchData();
    }
    setLoadingAction(false);
  };

  // Task handlers
  const handleAddTask = async () => {
    if (!newTaskTitle.trim()) {
      toast({ title: "Task title is required", variant: "destructive" });
      return;
    }

    setLoadingAction(true);
    try {
      await createTask({
        title: newTaskTitle.trim(),
        description: newTaskDescription.trim() || null,
        due_date: newTaskDueDate || null,
        completed: false,
        priority: newTaskPriority,
      });
      toast({ title: "Task added successfully" });
      setNewTaskTitle("");
      setNewTaskDescription("");
      setNewTaskDueDate("");
      setNewTaskPriority("medium");
    } catch (error) {
      toast({ title: "Error", description: "Failed to add task", variant: "destructive" });
    }
    setLoadingAction(false);
  };

  const handleUpdateTask = async () => {
    if (!editingTask) return;

    setLoadingAction(true);
    try {
      await updateTask(editingTask.id, {
        title: editingTask.title,
        description: editingTask.description,
        due_date: editingTask.due_date,
        completed: editingTask.completed,
        priority: editingTask.priority,
      });
      toast({ title: "Task updated successfully" });
      setEditingTask(null);
    } catch (error) {
      toast({ title: "Error", description: "Failed to update task", variant: "destructive" });
    }
    setLoadingAction(false);
  };

  const handleDeleteTask = async (id: string) => {
    setLoadingAction(true);
    try {
      await deleteTask(id);
      toast({ title: "Task deleted" });
    } catch (error) {
      toast({ title: "Error", description: "Failed to delete task", variant: "destructive" });
    }
    setLoadingAction(false);
  };

  // Activity handlers
  const handleAddActivity = async () => {
    if (!newActivityTitle.trim() || !newActivityDate.trim()) {
      toast({ title: "Title and date are required", variant: "destructive" });
      return;
    }

    setLoadingAction(true);
    try {
      await createActivity({
        title: newActivityTitle.trim(),
        date: newActivityDate.trim(),
        location: newActivityLocation.trim() || null,
        attendees: parseInt(newActivityAttendees) || 0,
        image_url: newActivityImageUrl.trim() || null,
      });
      toast({ title: "Activity added successfully" });
      setNewActivityTitle("");
      setNewActivityDate("");
      setNewActivityLocation("");
      setNewActivityAttendees("0");
      setNewActivityImageUrl("");
    } catch (error) {
      toast({ title: "Error", description: "Failed to add activity", variant: "destructive" });
    }
    setLoadingAction(false);
  };

  const handleUpdateActivity = async () => {
    if (!editingActivity) return;

    setLoadingAction(true);
    try {
      await updateActivity(editingActivity.id, {
        title: editingActivity.title,
        date: editingActivity.date,
        location: editingActivity.location,
        attendees: editingActivity.attendees,
        image_url: editingActivity.image_url,
      });
      toast({ title: "Activity updated successfully" });
      setEditingActivity(null);
    } catch (error) {
      toast({ title: "Error", description: "Failed to update activity", variant: "destructive" });
    }
    setLoadingAction(false);
  };

  const handleDeleteActivity = async (id: string) => {
    setLoadingAction(true);
    try {
      await deleteActivity(id);
      toast({ title: "Activity deleted" });
    } catch (error) {
      toast({ title: "Error", description: "Failed to delete activity", variant: "destructive" });
    }
    setLoadingAction(false);
  };

  if (authLoading || adminLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <div className="container py-6">
        <div className="flex items-center gap-4 mb-6">
          <Button variant="ghost" size="icon" onClick={() => navigate("/")}>
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div className="flex items-center gap-2">
            <Shield className="h-6 w-6 text-primary" />
            <h1 className="text-2xl font-bold text-foreground">Admin Dashboard</h1>
          </div>
        </div>

        <Tabs defaultValue="users" className="space-y-6">
          <TabsList className="bg-card border border-border flex-wrap h-auto gap-1 p-1">
            <TabsTrigger value="users" className="gap-2">
              <Users className="h-4 w-4" />
              Users
            </TabsTrigger>
            <TabsTrigger value="tasks" className="gap-2">
              <ListTodo className="h-4 w-4" />
              Tasks
            </TabsTrigger>
            <TabsTrigger value="activities" className="gap-2">
              <CalendarDays className="h-4 w-4" />
              Activities
            </TabsTrigger>
            <TabsTrigger value="background" className="gap-2">
              <Image className="h-4 w-4" />
              Background
            </TabsTrigger>
            <TabsTrigger value="verses" className="gap-2">
              <BookOpen className="h-4 w-4" />
              Bible Verses
            </TabsTrigger>
            <TabsTrigger value="games" className="gap-2">
              <Gamepad2 className="h-4 w-4" />
              Games
            </TabsTrigger>
            <TabsTrigger value="branding" className="gap-2">
              <Image className="h-4 w-4" />
              Branding
            </TabsTrigger>
          </TabsList>

          <TabsContent value="users" className="space-y-6">
            {/* Reset Password */}
            <Card className="bg-card border-border">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <RefreshCw className="h-5 w-5" />
                  Reset User Password
                </CardTitle>
                <CardDescription>Send a password reset email to any user</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex gap-2">
                  <Input
                    type="email"
                    placeholder="User email address"
                    value={resetPasswordEmail}
                    onChange={(e) => setResetPasswordEmail(e.target.value)}
                    className="flex-1"
                  />
                  <Button onClick={handleResetPassword} disabled={loadingAction}>
                    Send Reset Email
                  </Button>
                </div>
              </CardContent>
            </Card>

            {/* Create User */}
            <Card className="bg-card border-border">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Plus className="h-5 w-5" />
                  Create New User
                </CardTitle>
                <CardDescription>Create a new account manually</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div className="space-y-2">
                    <Label>Username</Label>
                    <Input
                      placeholder="Username"
                      value={newUserUsername}
                      onChange={(e) => setNewUserUsername(e.target.value)}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Email</Label>
                    <Input
                      type="email"
                      placeholder="Email"
                      value={newUserEmail}
                      onChange={(e) => setNewUserEmail(e.target.value)}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Password</Label>
                    <Input
                      type="password"
                      placeholder="Password"
                      value={newUserPassword}
                      onChange={(e) => setNewUserPassword(e.target.value)}
                    />
                  </div>
                </div>
                <Button onClick={handleCreateUser} disabled={loadingAction}>
                  <Plus className="h-4 w-4 mr-2" />
                  Create User
                </Button>
              </CardContent>
            </Card>

            {/* Admin Emails */}
            <Card className="bg-card border-border">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Shield className="h-5 w-5" />
                  Admin Email Addresses
                </CardTitle>
                <CardDescription>Users with these emails will automatically become admins when they sign up</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex gap-2">
                  <Input
                    type="email"
                    placeholder="Add admin email"
                    value={newAdminEmail}
                    onChange={(e) => setNewAdminEmail(e.target.value)}
                    className="flex-1"
                  />
                  <Button onClick={handleAddAdminEmail} disabled={loadingAction}>
                    <Plus className="h-4 w-4 mr-2" />
                    Add
                  </Button>
                </div>
                <div className="space-y-2">
                  {adminEmails.map((admin) => (
                    <div key={admin.id} className="flex items-center justify-between p-3 bg-secondary/50 rounded-lg">
                      <span className="text-foreground">{admin.email}</span>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => handleRemoveAdminEmail(admin.id)}
                        disabled={loadingAction}
                        className="text-destructive hover:text-destructive"
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  ))}
                  {adminEmails.length === 0 && (
                    <p className="text-muted-foreground text-sm">No admin emails configured</p>
                  )}
                </div>
              </CardContent>
            </Card>

            {/* User List */}
            <Card className="bg-card border-border">
              <CardHeader>
                <CardTitle>Registered Users ({profiles.length})</CardTitle>
                <CardDescription>Manage all registered users. Deleting a user will permanently remove their account and all associated data.</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-2 overflow-x-auto">
                  {profiles.map((profile) => (
                    <div key={profile.id} className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 sm:gap-3 p-2 sm:p-3 bg-secondary/50 rounded-lg">
                      <div className="flex items-center gap-2 sm:gap-3 min-w-0">
                        {profile.avatar_url ? (
                          <img src={profile.avatar_url} alt="" className="w-5 h-5 min-w-5 min-h-5 rounded-full object-cover flex-shrink-0" />
                        ) : (
                          <div className="w-5 h-5 min-w-5 min-h-5 rounded-full bg-primary/20 flex items-center justify-center flex-shrink-0">
                            <Users className="h-2.5 w-2.5 text-primary" />
                          </div>
                        )}
                        <div className="min-w-0">
                          <p className="text-foreground font-medium truncate text-sm sm:text-base">{profile.username}</p>
                          {profile.user_id === user?.id && (
                            <span className="text-xs text-muted-foreground">(You)</span>
                          )}
                        </div>
                      </div>
                      {profile.user_id !== user?.id && (
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => setUserToDelete(profile)}
                          disabled={loadingAction}
                          className="text-destructive hover:text-destructive hover:bg-destructive/10 h-8 w-8 flex-shrink-0"
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      )}
                    </div>
                  ))}
                  {profiles.length === 0 && (
                    <p className="text-muted-foreground text-sm">No users registered</p>
                  )}
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Tasks Tab */}
          <TabsContent value="tasks" className="space-y-6">
            <Card className="bg-card border-border">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Plus className="h-5 w-5" />
                  Add New Task
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Title *</Label>
                    <Input
                      placeholder="Task title"
                      value={newTaskTitle}
                      onChange={(e) => setNewTaskTitle(e.target.value)}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Due Date</Label>
                    <Input
                      type="date"
                      value={newTaskDueDate}
                      onChange={(e) => setNewTaskDueDate(e.target.value)}
                    />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label>Description</Label>
                  <Textarea
                    placeholder="Task description..."
                    value={newTaskDescription}
                    onChange={(e) => setNewTaskDescription(e.target.value)}
                    rows={2}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Priority</Label>
                  <Select value={newTaskPriority} onValueChange={(v) => setNewTaskPriority(v as "low" | "medium" | "high")}>
                    <SelectTrigger className="w-[180px]">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="low">Low</SelectItem>
                      <SelectItem value="medium">Medium</SelectItem>
                      <SelectItem value="high">High</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <Button onClick={handleAddTask} disabled={loadingAction}>
                  <Plus className="h-4 w-4 mr-2" />
                  Add Task
                </Button>
              </CardContent>
            </Card>

            <Card className="bg-card border-border">
              <CardHeader>
                <CardTitle>Tasks ({tasks.length})</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {tasks.map((task) => (
                    <div key={task.id} className="p-4 bg-secondary/50 rounded-lg space-y-2">
                      {editingTask?.id === task.id ? (
                        <div className="space-y-3">
                          <Input
                            value={editingTask.title}
                            onChange={(e) => setEditingTask({ ...editingTask, title: e.target.value })}
                          />
                          <Textarea
                            value={editingTask.description || ""}
                            onChange={(e) => setEditingTask({ ...editingTask, description: e.target.value })}
                            rows={2}
                          />
                          <div className="flex gap-2 items-center">
                            <Input
                              type="date"
                              value={editingTask.due_date || ""}
                              onChange={(e) => setEditingTask({ ...editingTask, due_date: e.target.value })}
                              className="w-auto"
                            />
                            <Select
                              value={editingTask.priority}
                              onValueChange={(v) => setEditingTask({ ...editingTask, priority: v as "low" | "medium" | "high" })}
                            >
                              <SelectTrigger className="w-[120px]">
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="low">Low</SelectItem>
                                <SelectItem value="medium">Medium</SelectItem>
                                <SelectItem value="high">High</SelectItem>
                              </SelectContent>
                            </Select>
                            <div className="flex items-center gap-2">
                              <Checkbox
                                checked={editingTask.completed}
                                onCheckedChange={(c) => setEditingTask({ ...editingTask, completed: !!c })}
                              />
                              <Label>Completed</Label>
                            </div>
                          </div>
                          <div className="flex gap-2">
                            <Button size="sm" onClick={handleUpdateTask} disabled={loadingAction}>
                              Save
                            </Button>
                            <Button size="sm" variant="outline" onClick={() => setEditingTask(null)}>
                              Cancel
                            </Button>
                          </div>
                        </div>
                      ) : (
                        <>
                          <div className="flex items-start justify-between">
                            <div>
                              <div className="flex items-center gap-2">
                                <span className={`text-xs px-2 py-1 rounded ${
                                  task.priority === 'high' ? 'bg-destructive/20 text-destructive' :
                                  task.priority === 'medium' ? 'bg-primary/20 text-primary' :
                                  'bg-muted text-muted-foreground'
                                }`}>
                                  {task.priority}
                                </span>
                                {task.completed && (
                                  <span className="text-xs bg-green-500/20 text-green-500 px-2 py-1 rounded">
                                    Completed
                                  </span>
                                )}
                              </div>
                              <h4 className="font-semibold text-foreground mt-1">{task.title}</h4>
                              {task.description && (
                                <p className="text-sm text-muted-foreground">{task.description}</p>
                              )}
                              {task.due_date && (
                                <p className="text-xs text-muted-foreground mt-1">Due: {task.due_date}</p>
                              )}
                            </div>
                            <div className="flex gap-1">
                              <Button
                                variant="ghost"
                                size="icon"
                                onClick={() => setEditingTask(task)}
                                disabled={loadingAction}
                              >
                                <Pencil className="h-4 w-4" />
                              </Button>
                              <Button
                                variant="ghost"
                                size="icon"
                                onClick={() => handleDeleteTask(task.id)}
                                disabled={loadingAction}
                                className="text-destructive hover:text-destructive"
                              >
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            </div>
                          </div>
                        </>
                      )}
                    </div>
                  ))}
                  {tasks.length === 0 && (
                    <p className="text-muted-foreground text-sm">No tasks added yet</p>
                  )}
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Activities Tab */}
          <TabsContent value="activities" className="space-y-6">
            <Card className="bg-card border-border">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Plus className="h-5 w-5" />
                  Add New Activity
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Title *</Label>
                    <Input
                      placeholder="Activity title"
                      value={newActivityTitle}
                      onChange={(e) => setNewActivityTitle(e.target.value)}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Date *</Label>
                    <Input
                      placeholder="e.g., December 21, 2025 or Every Wednesday"
                      value={newActivityDate}
                      onChange={(e) => setNewActivityDate(e.target.value)}
                    />
                  </div>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Location</Label>
                    <Input
                      placeholder="Event location"
                      value={newActivityLocation}
                      onChange={(e) => setNewActivityLocation(e.target.value)}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Attendees Count</Label>
                    <Input
                      type="number"
                      placeholder="0"
                      value={newActivityAttendees}
                      onChange={(e) => setNewActivityAttendees(e.target.value)}
                    />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label>Image URL (optional)</Label>
                  <Input
                    placeholder="https://..."
                    value={newActivityImageUrl}
                    onChange={(e) => setNewActivityImageUrl(e.target.value)}
                  />
                </div>
                <Button onClick={handleAddActivity} disabled={loadingAction}>
                  <Plus className="h-4 w-4 mr-2" />
                  Add Activity
                </Button>
              </CardContent>
            </Card>

            <Card className="bg-card border-border">
              <CardHeader>
                <CardTitle>Activities ({activities.length})</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {activities.map((activity) => (
                    <div key={activity.id} className="p-4 bg-secondary/50 rounded-lg space-y-2">
                      {editingActivity?.id === activity.id ? (
                        <div className="space-y-3">
                          <Input
                            placeholder="Title"
                            value={editingActivity.title}
                            onChange={(e) => setEditingActivity({ ...editingActivity, title: e.target.value })}
                          />
                          <Input
                            placeholder="Date"
                            value={editingActivity.date}
                            onChange={(e) => setEditingActivity({ ...editingActivity, date: e.target.value })}
                          />
                          <Input
                            placeholder="Location"
                            value={editingActivity.location || ""}
                            onChange={(e) => setEditingActivity({ ...editingActivity, location: e.target.value })}
                          />
                          <div className="flex gap-2">
                            <Input
                              type="number"
                              placeholder="Attendees"
                              value={editingActivity.attendees}
                              onChange={(e) => setEditingActivity({ ...editingActivity, attendees: parseInt(e.target.value) || 0 })}
                              className="w-[120px]"
                            />
                            <Input
                              placeholder="Image URL"
                              value={editingActivity.image_url || ""}
                              onChange={(e) => setEditingActivity({ ...editingActivity, image_url: e.target.value })}
                              className="flex-1"
                            />
                          </div>
                          <div className="flex gap-2">
                            <Button size="sm" onClick={handleUpdateActivity} disabled={loadingAction}>
                              Save
                            </Button>
                            <Button size="sm" variant="outline" onClick={() => setEditingActivity(null)}>
                              Cancel
                            </Button>
                          </div>
                        </div>
                      ) : (
                        <>
                          <div className="flex items-start justify-between">
                            <div>
                              <h4 className="font-semibold text-foreground">{activity.title}</h4>
                              <p className="text-sm text-muted-foreground">{activity.date}</p>
                              {activity.location && (
                                <p className="text-sm text-muted-foreground">{activity.location}</p>
                              )}
                              <p className="text-xs text-muted-foreground mt-1">{activity.attendees} attending</p>
                            </div>
                            <div className="flex gap-1">
                              <Button
                                variant="ghost"
                                size="icon"
                                onClick={() => setEditingActivity(activity)}
                                disabled={loadingAction}
                              >
                                <Pencil className="h-4 w-4" />
                              </Button>
                              <Button
                                variant="ghost"
                                size="icon"
                                onClick={() => handleDeleteActivity(activity.id)}
                                disabled={loadingAction}
                                className="text-destructive hover:text-destructive"
                              >
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            </div>
                          </div>
                        </>
                      )}
                    </div>
                  ))}
                  {activities.length === 0 && (
                    <p className="text-muted-foreground text-sm">No activities added yet</p>
                  )}
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="background" className="space-y-6">
            <Card className="bg-card border-border">
              <CardHeader>
                <CardTitle>Background Media</CardTitle>
                <CardDescription>Set a background image or a background video for the app (applies to global app settings).</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label>Background Image URL</Label>
                  <Input placeholder="https://...jpg" value={backgroundImage} onChange={(e) => setBackgroundImage(e.target.value)} />
                </div>
                <div className="space-y-2">
                  <Label>Background Video URL (mp4)</Label>
                  <Input placeholder="https://...mp4" value={backgroundVideo} onChange={(e) => setBackgroundVideo(e.target.value)} />
                </div>
                <div className="space-y-2">
                  <Label>Preview</Label>
                  <div className="rounded-lg overflow-hidden bg-secondary/20 p-2">
                    {backgroundVideo ? (
                      <>
                        <video
                          src={backgroundVideo}
                          controls
                          playsInline
                          muted
                          loop
                          preload="metadata"
                          className="w-full max-h-60 object-cover"
                          onError={() => setPreviewVideoError('Unable to load video. Check URL, format (mp4/webm), or CORS.')}
                          onLoadedData={() => setPreviewVideoError(null)}
                        />
                        {previewVideoError && (
                          <p className="text-xs text-destructive mt-2">{previewVideoError}</p>
                        )}
                      </>
                    ) : backgroundImage ? (
                      // eslint-disable-next-line jsx-a11y/media-has-caption
                      <img src={backgroundImage} alt="Background preview" className="w-full max-h-60 object-cover" />
                    ) : (
                      <p className="text-muted-foreground">No background set</p>
                    )}
                  </div>
                </div>
                <div className="flex gap-2">
                  <Button onClick={handleSaveBackground} disabled={loadingAction}>Save Background</Button>
                  <Button variant="outline" onClick={() => { setBackgroundImage(''); setBackgroundVideo(''); }}>
                    Clear
                  </Button>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="verses" className="space-y-6">
            <DailyStoryManagement adminUserId={user?.id} />
            <Card className="bg-card border-border">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Plus className="h-5 w-5" />
                  Add New Verse
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label>Reference (e.g., John 3:16)</Label>
                  <Input
                    placeholder="Book Chapter:Verse"
                    value={newVerseReference}
                    onChange={(e) => setNewVerseReference(e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Verse Text</Label>
                  <Textarea
                    placeholder="Enter the verse text..."
                    value={newVerseText}
                    onChange={(e) => setNewVerseText(e.target.value)}
                    rows={3}
                  />
                </div>
                <Button onClick={handleAddVerse} disabled={loadingAction}>
                  <Plus className="h-4 w-4 mr-2" />
                  Add Verse
                </Button>
              </CardContent>
            </Card>

            <Card className="bg-card border-border">
              <CardHeader>
                <CardTitle>Memory Verses ({verses.length})</CardTitle>
                <CardDescription>These verses rotate daily on the homepage</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {verses.map((verse, index) => (
                    <div key={verse.id} className="p-4 bg-secondary/50 rounded-lg space-y-2">
                      <div className="flex items-start justify-between">
                        <div className="flex items-center gap-2">
                          <span className="text-xs text-muted-foreground bg-primary/20 px-2 py-1 rounded">
                            Day {index + 1}
                          </span>
                          <span className="font-semibold text-primary">{verse.reference}</span>
                        </div>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => handleDeleteVerse(verse.id)}
                          disabled={loadingAction}
                          className="text-destructive hover:text-destructive"
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                      <p className="text-sm text-foreground/80">{verse.text}</p>
                    </div>
                  ))}
                  {verses.length === 0 && (
                    <p className="text-muted-foreground text-sm">No verses added yet</p>
                  )}
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="games" className="space-y-6">
            <Card className="bg-card border-border">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Gamepad2 className="h-5 w-5" />
                  Manage Bible Games
                </CardTitle>
                <CardDescription>Add, edit, or remove Bible trivia questions and other games</CardDescription>
              </CardHeader>
              <CardContent>
                <AdminGameManagement />
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="branding" className="space-y-6">
            <BrandingManagement />
          </TabsContent>
        </Tabs>
      </div>

      {/* Delete User Confirmation Dialog */}
      <AlertDialog open={!!userToDelete} onOpenChange={(open) => !open && setUserToDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete User</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete <span className="font-semibold text-foreground">{userToDelete?.username}</span>? This action cannot be undone and will permanently remove their account and all associated data.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={loadingAction}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDeleteUser}
              disabled={loadingAction}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {loadingAction ? "Deleting..." : "Delete User"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};

export default AdminPage;
