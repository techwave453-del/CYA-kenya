import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Post } from "@/hooks/usePosts";

interface EditPostDialogProps {
  post: Post;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSave: (postId: string, updates: { title?: string; description?: string; hashtag?: string }) => Promise<void>;
}

const EditPostDialog = ({ post, open, onOpenChange, onSave }: EditPostDialogProps) => {
  const [title, setTitle] = useState(post.title || "");
  const [description, setDescription] = useState(post.description || "");
  const [hashtag, setHashtag] = useState(post.hashtag);
  const [saving, setSaving] = useState(false);

  const handleSave = async () => {
    if (!hashtag.trim()) return;
    
    setSaving(true);
    try {
      await onSave(post.id, {
        title: title.trim() || null,
        description: description.trim() || null,
        hashtag: hashtag.trim(),
      });
      onOpenChange(false);
    } catch (error) {
      console.error("Failed to update post:", error);
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="bg-card border-border max-w-md">
        <DialogHeader>
          <DialogTitle className="text-foreground">Edit Post</DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-4">
          <div className="space-y-2">
            <Label htmlFor="hashtag" className="text-foreground">
              Hashtag <span className="text-destructive">*</span>
            </Label>
            <Input
              id="hashtag"
              value={hashtag}
              onChange={(e) => setHashtag(e.target.value)}
              placeholder="Enter hashtag"
              className="bg-muted border-border"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="title" className="text-foreground">
              Title
            </Label>
            <Input
              id="title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Enter title (optional)"
              className="bg-muted border-border"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="description" className="text-foreground">
              Description
            </Label>
            <Textarea
              id="description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Enter description (optional)"
              className="bg-muted border-border min-h-[100px]"
            />
          </div>
        </div>

        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            className="border-border"
          >
            Cancel
          </Button>
          <Button
            onClick={handleSave}
            disabled={saving || !hashtag.trim()}
            className="bg-primary hover:bg-primary/90"
          >
            {saving ? "Saving..." : "Save Changes"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default EditPostDialog;
