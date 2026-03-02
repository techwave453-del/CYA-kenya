import { useState, useRef } from "react";
import { useBranding } from "@/hooks/useBranding";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Image, Upload, Trash2, RefreshCw, Download } from "lucide-react";
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

const PWA_PRESETS = [
  { name: "pwa-192x192", label: "PWA Icon (192x192)", recommended: "192x192 PNG" },
  { name: "pwa-512x512", label: "PWA Icon (512x512)", recommended: "512x512 PNG" },
  { name: "favicon", label: "Favicon", recommended: "32x32 or 16x16 ICO/PNG" },
  { name: "app-logo", label: "App Logo", recommended: "SVG or high-res PNG" },
  { name: "splash-screen", label: "Splash Screen", recommended: "1242x2688 PNG" },
];

const BrandingManagement = () => {
  const { images, loading, uploading, uploadImage, deleteImage, refreshImages } = useBranding();
  const [selectedPreset, setSelectedPreset] = useState<string>("");
  const [imageToDelete, setImageToDelete] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const name = selectedPreset || undefined;
    await uploadImage(file, name);
    
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
    setSelectedPreset("");
  };

  const handleDeleteConfirm = async () => {
    if (imageToDelete) {
      await deleteImage(imageToDelete);
      setImageToDelete(null);
    }
  };

  const triggerUpload = (presetName?: string) => {
    setSelectedPreset(presetName || "");
    fileInputRef.current?.click();
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center p-8">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Info Banner */}
      <Card className="bg-primary/10 border-primary/30">
        <CardContent className="pt-4">
          <p className="text-sm text-foreground">
            <strong>✨ Auto-Apply:</strong> Uploaded PWA icons (192x192 and 512x512) are automatically applied to the app manifest. Users installing the app will see your custom icons!
          </p>
        </CardContent>
      </Card>

      {/* PWA Icon Presets */}
      <Card className="bg-card border-border">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Image className="h-5 w-5" />
            PWA Icons & App Branding
          </CardTitle>
          <CardDescription>
            Upload custom icons for your Progressive Web App. These will be used when users install the app on their devices.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {PWA_PRESETS.map((preset) => {
              const existingImage = images.find((img) => 
                img.name.startsWith(preset.name)
              );

              return (
                <div
                  key={preset.name}
                  className="border border-border rounded-lg p-4 space-y-3"
                >
                  <div className="flex justify-between items-start">
                    <div>
                      <h4 className="font-medium text-foreground">{preset.label}</h4>
                      <p className="text-xs text-muted-foreground">{preset.recommended}</p>
                    </div>
                  </div>

                  {existingImage ? (
                    <div className="space-y-2">
                      <div className="aspect-square bg-muted rounded-md overflow-hidden flex items-center justify-center max-w-[120px]">
                        <img
                          src={existingImage.url}
                          alt={preset.label}
                          className="w-full h-full object-contain"
                        />
                      </div>
                      <div className="flex gap-2">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => triggerUpload(preset.name)}
                          disabled={uploading}
                        >
                          <Upload className="h-3 w-3 mr-1" />
                          Replace
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => setImageToDelete(existingImage.path)}
                        >
                          <Trash2 className="h-3 w-3" />
                        </Button>
                      </div>
                    </div>
                  ) : (
                    <Button
                      variant="outline"
                      className="w-full"
                      onClick={() => triggerUpload(preset.name)}
                      disabled={uploading}
                    >
                      <Upload className="h-4 w-4 mr-2" />
                      Upload
                    </Button>
                  )}
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>

      {/* Custom Uploads */}
      <Card className="bg-card border-border">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Upload className="h-5 w-5" />
            Custom Branding Images
          </CardTitle>
          <CardDescription>
            Upload additional branding images for your app (banners, backgrounds, etc.)
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex gap-2">
            <Button
              onClick={() => triggerUpload()}
              disabled={uploading}
            >
              <Upload className="h-4 w-4 mr-2" />
              {uploading ? "Uploading..." : "Upload New Image"}
            </Button>
            <Button
              variant="outline"
              onClick={refreshImages}
              disabled={loading}
            >
              <RefreshCw className="h-4 w-4" />
            </Button>
          </div>

          {/* Existing Custom Images */}
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {images
              .filter((img) => !PWA_PRESETS.some((p) => img.name.startsWith(p.name)))
              .map((image) => (
                <div
                  key={image.path}
                  className="border border-border rounded-lg p-3 space-y-2"
                >
                  <div className="aspect-video bg-muted rounded-md overflow-hidden flex items-center justify-center">
                    <img
                      src={image.url}
                      alt={image.name}
                      className="w-full h-full object-contain"
                    />
                  </div>
                  <p className="text-sm text-foreground truncate" title={image.name}>
                    {image.name}
                  </p>
                  <div className="flex gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      asChild
                      className="flex-1"
                    >
                      <a href={image.url} target="_blank" rel="noopener noreferrer">
                        <Download className="h-3 w-3 mr-1" />
                        View
                      </a>
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setImageToDelete(image.path)}
                    >
                      <Trash2 className="h-3 w-3" />
                    </Button>
                  </div>
                </div>
              ))}
          </div>

          {images.filter((img) => !PWA_PRESETS.some((p) => img.name.startsWith(p.name))).length === 0 && (
            <p className="text-muted-foreground text-sm text-center py-4">
              No custom branding images uploaded yet.
            </p>
          )}
        </CardContent>
      </Card>

      {/* Hidden file input */}
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        onChange={handleFileChange}
        className="hidden"
      />

      {/* Delete Confirmation */}
      <AlertDialog open={!!imageToDelete} onOpenChange={(open) => !open && setImageToDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Image</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete this image? This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDeleteConfirm}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};

export default BrandingManagement;
