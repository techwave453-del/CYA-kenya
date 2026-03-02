import { useState } from "react";
import { X, Send, Trash2 } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { usePostComments } from "@/hooks/usePostComments";
import { toast } from "sonner";
import { Link } from "react-router-dom";

interface CommentsDialogProps {
  postId: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  currentUserId?: string;
  currentUsername?: string;
}

const CommentsDialog = ({
  postId,
  open,
  onOpenChange,
  currentUserId,
  currentUsername,
}: CommentsDialogProps) => {
  const { comments, loading, addComment, deleteComment } = usePostComments(postId);
  const [newComment, setNewComment] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newComment.trim() || !currentUserId || !currentUsername) return;

    setSubmitting(true);
    try {
      await addComment(newComment.trim(), currentUserId, currentUsername);
      setNewComment("");
    } catch (error) {
      console.error("Failed to add comment:", error);
      toast.error("Failed to add comment");
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async (commentId: string) => {
    try {
      await deleteComment(commentId);
      toast.success("Comment deleted");
    } catch (error) {
      console.error("Failed to delete comment:", error);
      toast.error("Failed to delete comment");
    }
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="bg-card border-border max-w-md">
        <DialogHeader>
          <DialogTitle className="text-foreground">Comments</DialogTitle>
        </DialogHeader>

        <ScrollArea className="max-h-[400px] pr-4">
          {loading ? (
            <div className="text-center py-8 text-muted-foreground">Loading comments...</div>
          ) : comments.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              No comments yet. Be the first to comment!
            </div>
          ) : (
            <div className="space-y-4">
              {comments.map((comment) => (
                <div key={comment.id} className="bg-muted/30 rounded-lg p-3">
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        <Link
                          to={`/profile/${comment.user_id}`}
                          className="text-primary font-medium text-sm hover:underline"
                        >
                          {comment.username}
                        </Link>
                        <span className="text-muted-foreground text-xs">
                          {formatDate(comment.created_at)}
                        </span>
                      </div>
                      <p className="text-foreground text-sm">{comment.content}</p>
                    </div>
                    {currentUserId === comment.user_id && (
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-6 w-6 text-muted-foreground hover:text-destructive"
                        onClick={() => handleDelete(comment.id)}
                      >
                        <Trash2 className="h-3 w-3" />
                      </Button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </ScrollArea>

        {currentUserId ? (
          <form onSubmit={handleSubmit} className="flex gap-2 mt-4">
            <Input
              value={newComment}
              onChange={(e) => setNewComment(e.target.value)}
              placeholder="Write a comment..."
              className="flex-1 bg-muted/30 border-border"
              disabled={submitting}
            />
            <Button
              type="submit"
              size="icon"
              disabled={submitting || !newComment.trim()}
              className="shrink-0"
            >
              <Send className="h-4 w-4" />
            </Button>
          </form>
        ) : (
          <p className="text-center text-muted-foreground text-sm mt-4">
            <Link to="/auth" className="text-primary hover:underline">
              Sign in
            </Link>{" "}
            to comment
          </p>
        )}
      </DialogContent>
    </Dialog>
  );
};

export default CommentsDialog;
