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
import { Label } from "@/components/ui/label";
import { toast } from "@/hooks/use-toast";
import { Camera, Loader2, User, X } from "lucide-react";
import { useTheme, themes } from "@/contexts/ThemeContext";

interface EditProfileDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  userId: string;
  currentUsername: string;
  currentAvatarUrl: string | null;
  currentLocalChurch: string | null;
  onProfileUpdated: () => void;
}

const EditProfileDialog = ({
  open,
  onOpenChange,
  userId,
  currentUsername,
  currentAvatarUrl,
  currentLocalChurch,
  onProfileUpdated,
}: EditProfileDialogProps) => {
  const [username, setUsername] = useState(currentUsername);
  const [localChurch, setLocalChurch] = useState(currentLocalChurch || "");
  const [avatarFile, setAvatarFile] = useState<File | null>(null);
  const [avatarPreview, setAvatarPreview] = useState<string | null>(currentAvatarUrl);
  const [loading, setLoading] = useState(false);
  const { setTheme, currentTheme } = useTheme();
  const [selectedTheme, setSelectedTheme] = useState<string>(() => {
    try {
      const saved = localStorage.getItem('app-theme');
      if (saved) return JSON.parse(saved).name;
    } catch {}
    return currentTheme?.name || '';
  });
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleAvatarSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (file.size > 2 * 1024 * 1024) {
        toast({
          title: "File too large",
          description: "Please select an image under 2MB.",
          variant: "destructive",
        });
        return;
      }

      setAvatarFile(file);
      const reader = new FileReader();
      reader.onloadend = () => {
        setAvatarPreview(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!username.trim() || username.length < 2) {
      toast({
        title: "Invalid username",
        description: "Username must be at least 2 characters.",
        variant: "destructive",
      });
      return;
    }

    setLoading(true);

    try {
      let avatarUrl = currentAvatarUrl;

      // Upload new avatar if selected
      if (avatarFile) {
        const fileExt = avatarFile.name.split(".").pop();
        const fileName = `${userId}/avatar.${fileExt}`;

        // Delete old avatar if exists
        if (currentAvatarUrl) {
          const oldPath = currentAvatarUrl.split("/").pop();
          if (oldPath) {
            await supabase.storage.from("post-images").remove([`${userId}/${oldPath}`]);
          }
        }

        const { error: uploadError } = await supabase.storage
          .from("post-images")
          .upload(fileName, avatarFile, { upsert: true });

        if (uploadError) {
          throw uploadError;
        }

        const { data: urlData } = supabase.storage
          .from("post-images")
          .getPublicUrl(fileName);

        avatarUrl = urlData.publicUrl;
      }

      // Update profile
      const { error: updateError } = await supabase
        .from("profiles")
        .update({
          username: username.trim(),
          avatar_url: avatarUrl,
          local_church: localChurch.trim() || null,
        })
        .eq("user_id", userId);

      if (updateError) {
        throw updateError;
      }

      // Update username in existing posts
      const { error: postsError } = await supabase
        .from("posts")
        .update({ username: username.trim() })
        .eq("user_id", userId);

      if (postsError) {
        console.error("Failed to update posts username:", postsError);
      }

      toast({
        title: "Profile updated!",
        description: "Your changes have been saved.",
      });

      onOpenChange(false);
      onProfileUpdated();
      // Apply and persist selected theme for this user on this device
      try {
        const themeObj = themes.find(t => t.name === selectedTheme);
        if (themeObj) {
          setTheme(themeObj);
          localStorage.setItem('app-theme', JSON.stringify(themeObj));
        }
      } catch (err) {
        // ignore
      }
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message || "Failed to update profile.",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="bg-card border-border text-foreground w-full max-w-[420px] sm:max-w-md max-h-[80vh] overflow-y-auto p-4 sm:p-6">
        <DialogHeader>
          <DialogTitle className="font-heading text-xl">Edit Profile</DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Avatar Upload */}
          <div className="flex flex-col items-center gap-4">
            <div className="relative">
              <div className="w-20 h-20 sm:w-24 sm:h-24 rounded-full bg-secondary flex items-center justify-center overflow-hidden">
                {avatarPreview ? (
                  <img
                    src={avatarPreview}
                    alt="Avatar preview"
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <User className="w-12 h-12 text-muted-foreground" />
                )}
              </div>
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="absolute bottom-0 right-0 p-2 bg-primary rounded-full text-primary-foreground hover:bg-primary/90 transition-colors"
              >
                <Camera className="w-4 h-4" />
              </button>
            </div>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              onChange={handleAvatarSelect}
              className="hidden"
            />
            <p className="text-xs text-muted-foreground">
              Click the camera icon to change avatar
            </p>
          </div>

          {/* Username */}
          <div className="space-y-2">
            <Label htmlFor="username" className="text-foreground">
              Username
            </Label>
            <Input
              id="username"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              placeholder="Enter username"
              className="bg-secondary border-border text-foreground"
              required
              minLength={2}
              maxLength={30}
            />
          </div>

          {/* Local Church */}
          <div className="space-y-2">
            <Label htmlFor="localChurch" className="text-foreground">
              Local Church
            </Label>
            <Input
              id="localChurch"
              value={localChurch}
              onChange={(e) => setLocalChurch(e.target.value)}
              placeholder="Enter your local church"
              className="bg-secondary border-border text-foreground"
              maxLength={100}
            />
            <p className="text-xs text-muted-foreground">
              Your local church will be visible to other members
            </p>
          </div>

          {/* Actions */}
          {/* Theme Picker */}
          <div className="space-y-2">
            <Label className="text-foreground">Theme</Label>
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
              {themes.map((theme) => (
                <button
                  key={theme.name}
                  type="button"
                  onClick={() => setSelectedTheme(theme.name)}
                  className={`p-3 rounded-lg border-2 transition-all text-left ${
                    selectedTheme === theme.name ? 'border-primary ring-2 ring-primary/50' : 'border-border'
                  }`}
                >
                  <div className="flex gap-2 mb-2">
                    <div className="w-5 h-5 rounded-full" style={{ backgroundColor: `hsl(${theme.primary})` }} />
                    <div className="w-5 h-5 rounded-full" style={{ backgroundColor: `hsl(${theme.background})` }} />
                  </div>
                  <div className="text-sm text-foreground font-medium">{theme.label}</div>
                </button>
              ))}
            </div>
          </div>
          <div className="flex flex-col sm:flex-row gap-3">
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              className="flex-1"
            >
              Cancel
            </Button>
            <Button
              type="submit"
              className="flex-1 bg-primary text-primary-foreground hover:bg-primary/90"
              disabled={loading}
            >
              {loading ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Saving...
                </>
              ) : (
                "Save Changes"
              )}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
};

export default EditProfileDialog;
