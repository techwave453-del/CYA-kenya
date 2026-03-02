import { useState, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { toast } from "@/hooks/use-toast";
import { ImagePlus, X, Loader2, Hash, WifiOff } from "lucide-react";
import { put, addToSyncQueue } from "@/lib/offlineDb";

interface CreatePostDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  userId: string;
  username: string;
  onPostCreated: () => void;
  isOnline?: boolean;
}

const CreatePostDialog = ({
  open,
  onOpenChange,
  userId,
  username,
  onPostCreated,
  isOnline = navigator.onLine,
}: CreatePostDialogProps) => {
  const [hashtag, setHashtag] = useState("");
  const [description, setDescription] = useState("");
  const [title, setTitle] = useState("");
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleImageSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (file.size > 5 * 1024 * 1024) {
        toast({
          title: "File too large",
          description: "Please select an image under 5MB.",
          variant: "destructive",
        });
        return;
      }

      setImageFile(file);
      const reader = new FileReader();
      reader.onloadend = () => {
        setImagePreview(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  const removeImage = () => {
    setImageFile(null);
    setImagePreview(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!hashtag.trim()) {
      toast({
        title: "Missing hashtag",
        description: "Please add a hashtag for your post.",
        variant: "destructive",
      });
      return;
    }

    setLoading(true);

    try {
      let imageUrl: string | null = null;
      let imageDataUrl: string | null = null;

      // Upload image if present
      if (imageFile) {
        if (isOnline) {
          const fileExt = imageFile.name.split(".").pop();
          const fileName = `${userId}/${Date.now()}.${fileExt}`;

          const { error: uploadError } = await supabase.storage
            .from("post-images")
            .upload(fileName, imageFile);

          if (uploadError) {
            throw uploadError;
          }

          const { data: urlData } = supabase.storage
            .from("post-images")
            .getPublicUrl(fileName);

          imageUrl = urlData.publicUrl;
        } else {
          // Store image as data URL for offline
          imageDataUrl = imagePreview;
        }
      }

      const postId = crypto.randomUUID();
      const postData = {
        id: postId,
        user_id: userId,
        username: username,
        hashtag: hashtag.replace(/^#/, ""),
        description: description || null,
        title: title || null,
        image_url: imageUrl || imageDataUrl,
        likes_count: 0,
        comments_count: 0,
        created_at: new Date().toISOString(),
      };

      if (isOnline) {
        // Create post online
        const { error: postError } = await supabase.from("posts").insert({
          user_id: userId,
          username: username,
          hashtag: hashtag.replace(/^#/, ""),
          description: description || null,
          title: title || null,
          image_url: imageUrl,
        });

        if (postError) {
          throw postError;
        }
      } else {
        // Save to IndexedDB and queue for sync
        await put('posts', postData);
        await addToSyncQueue({
          table: 'posts',
          action: 'insert',
          data: {
            user_id: userId,
            username: username,
            hashtag: hashtag.replace(/^#/, ""),
            description: description || null,
            title: title || null,
            image_url: null, // Will need to upload image when online
          }
        });
      }

      toast({
        title: isOnline ? "Post created!" : "Post saved offline",
        description: isOnline 
          ? "Your post has been shared with the community."
          : "Your post will be synced when you're back online.",
      });

      // Reset form
      setHashtag("");
      setDescription("");
      setTitle("");
      removeImage();
      onOpenChange(false);
      onPostCreated();
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message || "Failed to create post.",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="bg-card border-border text-foreground max-w-md">
        <DialogHeader>
          <DialogTitle className="font-heading text-xl flex items-center gap-2">
            Create Post
            {!isOnline && (
              <span className="inline-flex items-center gap-1 text-xs font-normal text-muted-foreground bg-secondary px-2 py-0.5 rounded">
                <WifiOff className="h-3 w-3" /> Offline
              </span>
            )}
          </DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Hashtag */}
          <div className="space-y-2">
            <Label htmlFor="hashtag" className="text-foreground">
              Hashtag *
            </Label>
            <div className="relative">
              <Hash className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                id="hashtag"
                value={hashtag}
                onChange={(e) => setHashtag(e.target.value)}
                placeholder="YouthWorship"
                className="bg-secondary border-border text-foreground pl-9"
                required
              />
            </div>
          </div>

          {/* Title (optional) */}
          <div className="space-y-2">
            <Label htmlFor="title" className="text-foreground">
              Title (optional)
            </Label>
            <Input
              id="title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Event name or title"
              className="bg-secondary border-border text-foreground"
            />
          </div>

          {/* Description */}
          <div className="space-y-2">
            <Label htmlFor="description" className="text-foreground">
              Description
            </Label>
            <Textarea
              id="description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Share your thoughts with the community..."
              className="bg-secondary border-border text-foreground min-h-[100px] resize-none"
            />
          </div>

          {/* Image Upload */}
          <div className="space-y-2">
            <Label className="text-foreground">
              Image (optional)
              {!isOnline && imageFile && (
                <span className="text-xs text-muted-foreground ml-2">
                  (Will be uploaded when online)
                </span>
              )}
            </Label>
            
            {imagePreview ? (
              <div className="relative rounded-lg overflow-hidden">
                <img
                  src={imagePreview}
                  alt="Preview"
                  className="w-full h-40 object-cover"
                />
                <button
                  type="button"
                  onClick={removeImage}
                  className="absolute top-2 right-2 p-1 bg-background/80 rounded-full hover:bg-background transition-colors"
                >
                  <X className="w-4 h-4 text-foreground" />
                </button>
              </div>
            ) : (
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="w-full h-32 border-2 border-dashed border-border rounded-lg flex flex-col items-center justify-center gap-2 hover:border-primary hover:bg-primary/5 transition-all"
              >
                <ImagePlus className="w-8 h-8 text-muted-foreground" />
                <span className="text-sm text-muted-foreground">Click to upload image</span>
              </button>
            )}
            
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              onChange={handleImageSelect}
              className="hidden"
            />
          </div>

          {/* Submit */}
          <Button
            type="submit"
            className="w-full bg-primary text-primary-foreground hover:bg-primary/90"
            disabled={loading}
          >
            {loading ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                {isOnline ? "Posting..." : "Saving..."}
              </>
            ) : (
              <>{isOnline ? "Share Post" : "Save Post (Offline)"}</>
            )}
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
};

export default CreatePostDialog;
