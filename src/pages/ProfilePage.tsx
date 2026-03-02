import { useState, useEffect } from "react";
import { useParams, useNavigate, Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import Header from "@/components/Header";
import PostCard from "@/components/PostCard";
import EditProfileDialog from "@/components/EditProfileDialog";
import { Button } from "@/components/ui/button";
import { toast } from "@/hooks/use-toast";
import { ArrowLeft, Edit2, Loader2, User, Calendar, FileText, Church } from "lucide-react";
import { format } from "date-fns";

interface Profile {
  id: string;
  user_id: string;
  username: string;
  avatar_url: string | null;
  local_church: string | null;
  created_at: string;
}

import { Post } from "@/hooks/usePosts";

const ProfilePage = () => {
  const { userId } = useParams<{ userId: string }>();
  const navigate = useNavigate();
  const { user, profile: currentUserProfile } = useAuth();
  
  const [profile, setProfile] = useState<Profile | null>(null);
  const [posts, setPosts] = useState<Post[]>([]);
  const [loading, setLoading] = useState(true);
  const [editDialogOpen, setEditDialogOpen] = useState(false);

  const isOwnProfile = user?.id === userId;

  useEffect(() => {
    if (userId) {
      fetchProfileAndPosts();
    }
  }, [userId]);

  const fetchProfileAndPosts = async () => {
    setLoading(true);

    // Fetch profile
    const { data: profileData, error: profileError } = await supabase
      .from("profiles")
      .select("*")
      .eq("user_id", userId)
      .maybeSingle();

    if (profileError) {
      toast({
        title: "Error",
        description: "Failed to load profile.",
        variant: "destructive",
      });
      setLoading(false);
      return;
    }

    if (!profileData) {
      toast({
        title: "Profile not found",
        description: "This user doesn't exist.",
        variant: "destructive",
      });
      navigate("/");
      return;
    }

    setProfile(profileData);

    // Fetch user's posts
    const { data: postsData, error: postsError } = await supabase
      .from("posts")
      .select("*")
      .eq("user_id", userId)
      .order("created_at", { ascending: false });

    if (!postsError && postsData) {
      setPosts(postsData);
    }

    setLoading(false);
  };

  const handleProfileUpdate = () => {
    fetchProfileAndPosts();
  };

  const handleDeletePost = async (postId: string) => {
    const { error } = await supabase
      .from("posts")
      .delete()
      .eq("id", postId);

    if (error) {
      toast({
        title: "Error",
        description: "Failed to delete the post.",
        variant: "destructive",
      });
      throw error;
    }

    toast({
      title: "Post deleted",
      description: "Your post has been deleted successfully.",
    });
    
    setPosts((prev) => prev.filter((p) => p.id !== postId));
  };

  const handleEditPost = async (
    postId: string,
    updates: { title?: string; description?: string; hashtag?: string }
  ) => {
    const { error } = await supabase
      .from("posts")
      .update(updates)
      .eq("id", postId);

    if (error) {
      toast({
        title: "Error",
        description: "Failed to update the post.",
        variant: "destructive",
      });
      throw error;
    }

    toast({
      title: "Post updated",
      description: "Your post has been updated successfully.",
    });
    
    fetchProfileAndPosts();
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-background">
        <Header />
        <div className="flex items-center justify-center py-20">
          <Loader2 className="w-8 h-8 animate-spin text-primary" />
        </div>
      </div>
    );
  }

  if (!profile) {
    return (
      <div className="min-h-screen bg-background">
        <Header />
        <div className="flex flex-col items-center justify-center py-20 gap-4">
          <p className="text-muted-foreground">Profile not found</p>
          <Link to="/">
            <Button variant="outline">Go Home</Button>
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <Header />

      {/* Back Button */}
      <div className="container py-4">
        <button
          onClick={() => navigate(-1)}
          className="flex items-center gap-2 text-muted-foreground hover:text-foreground transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>Back</span>
        </button>
      </div>

      {/* Profile Header */}
      <div className="container pb-6">
        <div className="bg-card rounded-xl p-6 card-shadow">
          <div className="flex items-start gap-4">
            {/* Avatar */}
            <div className="w-20 h-20 rounded-full bg-secondary flex items-center justify-center overflow-hidden">
              {profile.avatar_url ? (
                <img
                  src={profile.avatar_url}
                  alt={profile.username}
                  className="w-full h-full object-cover"
                />
              ) : (
                <User className="w-10 h-10 text-muted-foreground" />
              )}
            </div>

            {/* Info */}
            <div className="flex-1">
              <div className="flex items-center gap-2">
                <h1 className="font-heading text-2xl font-bold text-primary">
                  {profile.username}
                </h1>
                {isOwnProfile && (
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => setEditDialogOpen(true)}
                    className="text-muted-foreground hover:text-primary"
                  >
                    <Edit2 className="w-4 h-4" />
                  </Button>
                )}
              </div>

              <div className="flex flex-wrap items-center gap-4 mt-2 text-sm text-muted-foreground">
                <div className="flex items-center gap-1">
                  <Calendar className="w-4 h-4" />
                  <span>Joined {format(new Date(profile.created_at), "MMM yyyy")}</span>
                </div>
                <div className="flex items-center gap-1">
                  <FileText className="w-4 h-4" />
                  <span>{posts.length} posts</span>
                </div>
                {profile.local_church && (
                  <div className="flex items-center gap-1">
                    <Church className="w-4 h-4 text-primary" />
                    <span className="text-primary">{profile.local_church}</span>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Posts Section */}
      <div className="container pb-8">
        <h2 className="font-heading text-lg font-semibold text-foreground mb-4 flex items-center gap-2">
          <span className="text-2xl">📝</span>
          Posts by {profile.username}
        </h2>

        {posts.length === 0 ? (
          <div className="bg-card rounded-lg p-8 text-center card-shadow">
            <p className="text-muted-foreground">
              {isOwnProfile
                ? "You haven't posted anything yet. Share your first idea!"
                : `${profile.username} hasn't posted anything yet.`}
            </p>
            {isOwnProfile && (
              <Link to="/">
                <Button className="mt-4 bg-primary text-primary-foreground">
                  Create Post
                </Button>
              </Link>
            )}
          </div>
        ) : (
          <div className="space-y-4">
            {posts.map((post, index) => (
              <PostCard
                key={post.id}
                post={post}
                currentUserId={user?.id}
                currentUsername={currentUserProfile?.username}
                onDelete={isOwnProfile ? handleDeletePost : undefined}
                onEdit={isOwnProfile ? handleEditPost : undefined}
                className="animate-slide-up"
                style={{ animationDelay: `${index * 0.1}s` }}
              />
            ))}
          </div>
        )}
      </div>

      {/* Edit Profile Dialog */}
      {isOwnProfile && user && (
        <EditProfileDialog
          open={editDialogOpen}
          onOpenChange={setEditDialogOpen}
          userId={user.id}
          currentUsername={profile.username}
          currentAvatarUrl={profile.avatar_url || null}
          currentLocalChurch={profile.local_church}
          onProfileUpdated={handleProfileUpdate}
        />
      )}
    </div>
  );
};

export default ProfilePage;
