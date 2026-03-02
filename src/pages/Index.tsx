import { useState } from "react";
import Header from "@/components/Header";
import TabNavigation from "@/components/TabNavigation";
import IdeasSection from "@/components/IdeasSection";
import PostCard from "@/components/PostCard";
import TaskCard from "@/components/TaskCard";
import ActivityCard from "@/components/ActivityCard";
import FloatingActionButton from "@/components/FloatingActionButton";
 import BibleAIButton from "@/components/BibleAIButton";
import CreatePostDialog from "@/components/CreatePostDialog";
import DailyBibleVerse from "@/components/DailyBibleVerse";
import DailyBibleStory from "@/components/DailyBibleStory";
import { useAuth } from "@/hooks/useAuth";
import { usePosts } from "@/hooks/usePosts";
import { useTasks } from "@/hooks/useTasks";
import { useActivities } from "@/hooks/useActivities";
import { toast } from "@/hooks/use-toast";
import { useNavigate } from "react-router-dom";
import { Loader2 } from "lucide-react";
import { format } from "date-fns";

const Index = () => {
  const [activeTab, setActiveTab] = useState("posts");
  const [createPostOpen, setCreatePostOpen] = useState(false);
  const { isAuthenticated, user, profile, loading: authLoading } = useAuth();
  const { posts, loading: postsLoading, refetch, deletePost, updatePost, isOnline } = usePosts();
  const { tasks, loading: tasksLoading } = useTasks();
  const { activities, loading: activitiesLoading } = useActivities();
  const navigate = useNavigate();

  const handleShareIdea = () => {
    if (!isAuthenticated) {
      toast({
        title: "Sign in required",
        description: "Please sign in to share your ideas.",
        variant: "destructive",
      });
      navigate("/auth");
      return;
    }
    setCreatePostOpen(true);
  };


  const handleDeletePost = async (postId: string) => {
    try {
      await deletePost(postId);
      toast({
        title: "Post deleted",
        description: "Your post has been deleted successfully.",
      });
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to delete the post. Please try again.",
        variant: "destructive",
      });
      throw error;
    }
  };

  const handleEditPost = async (
    postId: string,
    updates: { title?: string; description?: string; hashtag?: string }
  ) => {
    try {
      await updatePost(postId, updates);
      toast({
        title: "Post updated",
        description: "Your post has been updated successfully.",
      });
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to update the post. Please try again.",
        variant: "destructive",
      });
      throw error;
    }
  };

  const formatDueDate = (dateStr: string | null) => {
    if (!dateStr) return undefined;
    try {
      return format(new Date(dateStr), "MMM d, yyyy");
    } catch {
      return dateStr;
    }
  };

  return (
    <div className="min-h-screen bg-background">
      <Header />
      
      {/* Hero Stars Background */}
      <div className="relative h-12 bg-gradient-to-b from-background via-navy-light to-card overflow-hidden">
        <div className="absolute inset-0">
          {[...Array(20)].map((_, i) => (
            <div
              key={i}
              className="absolute w-0.5 h-0.5 bg-foreground/30 rounded-full animate-pulse"
              style={{
                left: `${Math.random() * 100}%`,
                top: `${Math.random() * 100}%`,
                animationDelay: `${Math.random() * 2}s`,
              }}
            />
          ))}
        </div>
      </div>
      
      <TabNavigation activeTab={activeTab} onTabChange={setActiveTab} />
      
      <main className="pb-24">
        {activeTab === "posts" && (
          <>
            <div className="px-4 pt-4">
              <DailyBibleVerse />
              <DailyBibleStory />
            </div>
            <IdeasSection onShareIdea={handleShareIdea} />
            
            <div className="px-4 py-4 space-y-4">
              {postsLoading ? (
                <div className="flex items-center justify-center py-8">
                  <Loader2 className="w-6 h-6 animate-spin text-primary" />
                </div>
              ) : posts.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  <p>No posts yet. Be the first to share an idea!</p>
                </div>
              ) : (
                posts.map((post, index) => (
                  <PostCard
                    key={post.id}
                    post={post}
                    currentUserId={user?.id}
                    currentUsername={profile?.username}
                    onDelete={handleDeletePost}
                    onEdit={handleEditPost}
                    className="animate-slide-up"
                    style={{ animationDelay: `${index * 0.1}s` }}
                  />
                ))
              )}
            </div>
          </>
        )}
        
        {activeTab === "tasks" && (
          <div className="px-4 py-4 space-y-4">
            <div className="flex items-center gap-2 mb-2">
              <span className="text-2xl">📋</span>
              <h2 className="font-heading text-lg font-semibold text-foreground">
                Your Tasks
              </h2>
            </div>
            {tasksLoading ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="w-6 h-6 animate-spin text-primary" />
              </div>
            ) : tasks.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                <p>No tasks yet.</p>
              </div>
            ) : (
              tasks.map((task, index) => (
                <TaskCard
                  key={task.id}
                  title={task.title}
                  description={task.description || undefined}
                  dueDate={formatDueDate(task.due_date)}
                  completed={task.completed}
                  priority={task.priority}
                  className="animate-slide-up"
                  style={{ animationDelay: `${index * 0.1}s` }}
                />
              ))
            )}
          </div>
        )}
        
        {activeTab === "activities" && (
          <div className="px-4 py-4 space-y-4">
            <div className="flex items-center gap-2 mb-2">
              <span className="text-2xl">🎯</span>
              <h2 className="font-heading text-lg font-semibold text-foreground">
                Upcoming Activities
              </h2>
            </div>
            {activitiesLoading ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="w-6 h-6 animate-spin text-primary" />
              </div>
            ) : activities.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                <p>No activities yet.</p>
              </div>
            ) : (
              activities.map((activity, index) => (
                <ActivityCard
                  key={activity.id}
                  title={activity.title}
                  date={activity.date}
                  location={activity.location || undefined}
                  attendees={activity.attendees}
                  image={activity.image_url || undefined}
                  className="animate-slide-up"
                  style={{ animationDelay: `${index * 0.1}s` }}
                />
              ))
            )}
          </div>
        )}
      </main>
      
      <FloatingActionButton />
     <BibleAIButton />

      {/* Create Post Dialog */}
      {user && profile && (
        <CreatePostDialog
          open={createPostOpen}
          onOpenChange={setCreatePostOpen}
          userId={user.id}
          username={profile.username}
          onPostCreated={refetch}
          isOnline={isOnline}
        />
      )}
    </div>
  );
};

export default Index;
