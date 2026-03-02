import { Heart, MessageCircle, Share2, MoreVertical, Pencil, Trash2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { Link } from "react-router-dom";
import React, { useState } from "react";
import ReactMarkdown from 'react-markdown';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
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
import { Button } from "@/components/ui/button";
import { Post } from "@/hooks/usePosts";
import EditPostDialog from "./EditPostDialog";
import CommentsDialog from "./CommentsDialog";
import { usePostLikes } from "@/hooks/usePostLikes";
import { toast } from "sonner";
import { BiblePassageDialog } from '@/components/BiblePassageDialog';
import { enrichContentWithIcons, markdownLinkComponents } from '@/lib/markdown';

interface PostCardProps {
  post: Post;
  currentUserId?: string;
  currentUsername?: string;
  onDelete?: (postId: string) => Promise<void>;
  onEdit?: (postId: string, updates: { title?: string; description?: string; hashtag?: string }) => Promise<void>;
  className?: string;
  style?: React.CSSProperties;
}

// for passage dialog
interface PassageState {
  ref: string | null;
  open: boolean;
}

const PostCard = ({
  post,
  currentUserId,
  currentUsername,
  onDelete,
  onEdit,
  className,
  style,
}: PostCardProps) => {
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [commentsDialogOpen, setCommentsDialogOpen] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [passage, setPassage] = useState<PassageState>({ ref: null, open: false });
  
  const { isLiked, loading: likeLoading, toggleLike } = usePostLikes(post.id, currentUserId);

  const isOwner = currentUserId && post.user_id === currentUserId;

  const handleLike = async () => {
    if (!currentUserId) {
      toast.error("Please sign in to like posts");
      return;
    }
    await toggleLike();
  };

  const handleDelete = async () => {
    if (!onDelete) return;
    setDeleting(true);
    try {
      await onDelete(post.id);
      setDeleteDialogOpen(false);
    } catch (error) {
      console.error("Failed to delete post:", error);
    } finally {
      setDeleting(false);
    }
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
    });
  };

  const UsernameComponent = post.user_id ? (
    <Link 
      to={`/profile/${post.user_id}`}
      className="text-primary font-semibold text-lg hover:underline"
    >
      {post.username}
    </Link>
  ) : (
    <h3 className="text-primary font-semibold text-lg">{post.username}</h3>
  );

  return (
    <>
      <article
        style={style}
        className={cn(
          "bg-card rounded-lg overflow-hidden border-l-4 border-l-primary card-shadow animate-slide-up",
          className
        )}
      >
        <div className="p-4">
          <div className="flex items-start justify-between mb-2">
            <div>
              {UsernameComponent}
              <p className="text-muted-foreground text-sm">{formatDate(post.created_at)}</p>
            </div>
            
            {isOwner && (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground hover:text-foreground">
                    <MoreVertical className="h-4 w-4" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="bg-card border-border">
                  <DropdownMenuItem 
                    onClick={() => setEditDialogOpen(true)}
                    className="cursor-pointer"
                  >
                    <Pencil className="h-4 w-4 mr-2" />
                    Edit
                  </DropdownMenuItem>
                  <DropdownMenuItem 
                    onClick={() => setDeleteDialogOpen(true)}
                    className="cursor-pointer text-destructive focus:text-destructive"
                  >
                    <Trash2 className="h-4 w-4 mr-2" />
                    Delete
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            )}
          </div>
          
          <span className="inline-block text-foreground/90 font-medium mb-3">
            #{post.hashtag}
          </span>

          {post.description && (
            <div className="text-muted-foreground text-sm mb-3">
              <ReactMarkdown components={markdownLinkComponents((ref) => setPassage({ ref, open: true }))}>
                {enrichContentWithIcons(post.description)}
              </ReactMarkdown>
            </div>
          )}
          
          {post.image_url && (
            <div className="relative rounded-lg overflow-hidden mt-2">
              <img
                src={post.image_url}
                alt={post.title || "Post image"}
                className="w-full h-48 object-cover"
              />
              {post.title && (
                <div className="absolute inset-0 bg-gradient-to-t from-background/90 via-transparent to-transparent flex items-end p-4">
                  <h4 className="text-2xl font-heading font-bold text-foreground">
                    {post.title}
                  </h4>
                </div>
              )}
            </div>
          )}
        </div>
        
        <div className="flex items-center gap-6 px-4 py-3 border-t border-border/30">
          <button 
            onClick={handleLike}
            disabled={likeLoading}
            className={cn(
              "flex items-center gap-2 transition-colors",
              isLiked ? "text-red-500" : "text-muted-foreground hover:text-primary"
            )}
          >
            <Heart className={cn("w-5 h-5", isLiked && "fill-current")} />
            <span className="text-sm">{post.likes_count}</span>
          </button>
          <button 
            onClick={() => setCommentsDialogOpen(true)}
            className="flex items-center gap-2 text-muted-foreground hover:text-primary transition-colors"
          >
            <MessageCircle className="w-5 h-5" />
            <span className="text-sm">{post.comments_count}</span>
          </button>
          <button className="flex items-center gap-2 text-muted-foreground hover:text-primary transition-colors ml-auto">
            <Share2 className="w-5 h-5" />
          </button>
        </div>
      </article>

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent className="bg-card border-border">
          <AlertDialogHeader>
            <AlertDialogTitle className="text-foreground">Delete Post</AlertDialogTitle>
            <AlertDialogDescription className="text-muted-foreground">
              Are you sure you want to delete this post? This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="border-border">Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              disabled={deleting}
              className="bg-destructive hover:bg-destructive/90"
            >
              {deleting ? "Deleting..." : "Delete"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Edit Dialog */}
      {onEdit && (
        <EditPostDialog
          post={post}
          open={editDialogOpen}
          onOpenChange={setEditDialogOpen}
          onSave={onEdit}
        />
      )}

      {/* Comments Dialog */}
      <CommentsDialog
        postId={post.id}
        open={commentsDialogOpen}
        onOpenChange={setCommentsDialogOpen}
        currentUserId={currentUserId}
        currentUsername={currentUsername}
      />

      {/* Scripture passage pop-up */}
      <BiblePassageDialog
        reference={passage.ref ?? null}
        open={passage.open}
        onOpenChange={(open) => setPassage((p) => ({ ...p, open }))}
      />
    </>
  );
};

export default PostCard;
