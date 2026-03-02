import { useEffect, useMemo, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import type { Json } from "@/integrations/supabase/types";
import { useToast } from "@/hooks/use-toast";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Loader2, RefreshCw, Save, Sparkles, Trash2, Upload } from "lucide-react";

interface DailyStoryPost {
  id: string;
  title: string | null;
  description: string | null;
  image_url: string | null;
  created_at: string;
}

interface DailyStoryImageConfig {
  images?: string[];
}

interface FeaturedDailyStoryConfig {
  postId?: string | null;
}

interface DailyStoryManagementProps {
  adminUserId?: string;
}

const DAILY_STORY_HASHTAG = "#DailyBibleStory";
const FEATURED_DAILY_STORY_KEY = "featured_daily_story";
const AUTO_STORY_VALUE = "__AUTO__";
const WEBSITE_TITLE_LIMIT = 70;
const MAX_IMAGE_SIZE_BYTES = 3 * 1024 * 1024;
const ALLOWED_IMAGE_TYPES = new Set(["image/jpeg", "image/png"]);

const storyImageSettingKey = (storyId: string) => `daily_story_images:${storyId}`;

const uniqueUrls = (urls: string[]): string[] =>
  Array.from(new Set(urls.map((url) => url.trim()).filter(Boolean)));

const parseStoryImages = (value: Json): string[] => {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return [];
  }

  const images = (value as DailyStoryImageConfig).images;
  if (!Array.isArray(images)) {
    return [];
  }

  return uniqueUrls(images.filter((item): item is string => typeof item === "string"));
};

const parseFeaturedStoryId = (value: Json): string | null => {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return null;
  }

  const postId = (value as FeaturedDailyStoryConfig).postId;
  return typeof postId === "string" && postId.length > 0 ? postId : null;
};

const getTodayUtcRange = () => {
  const todayStart = new Date();
  todayStart.setUTCHours(0, 0, 0, 0);
  const tomorrowStart = new Date(todayStart);
  tomorrowStart.setUTCDate(tomorrowStart.getUTCDate() + 1);
  return { todayStart, tomorrowStart };
};

const pickDefaultStory = (stories: DailyStoryPost[]): DailyStoryPost | null => {
  if (stories.length === 0) return null;

  const { todayStart, tomorrowStart } = getTodayUtcRange();
  const todayStory = stories.find((item) => {
    const createdAt = new Date(item.created_at);
    return createdAt >= todayStart && createdAt < tomorrowStart;
  });

  return todayStory ?? stories[0];
};

const DailyStoryManagement = ({ adminUserId }: DailyStoryManagementProps) => {
  const { toast } = useToast();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [savingTitle, setSavingTitle] = useState(false);
  const [savingFeaturedStory, setSavingFeaturedStory] = useState(false);
  const [uploading, setUploading] = useState(false);

  const [availableStories, setAvailableStories] = useState<DailyStoryPost[]>([]);
  const [featuredSelection, setFeaturedSelection] = useState<string>(AUTO_STORY_VALUE);
  const [story, setStory] = useState<DailyStoryPost | null>(null);
  const [titleDraft, setTitleDraft] = useState("");
  const [customImages, setCustomImages] = useState<string[]>([]);
  const [lastResult, setLastResult] = useState<string | null>(null);

  const allImages = useMemo(() => {
    const baseImage = story?.image_url ? [story.image_url] : [];
    return uniqueUrls([...baseImage, ...customImages]);
  }, [story?.image_url, customImages]);

  const fetchStoryImages = async (storyId: string) => {
    const { data, error } = await supabase
      .from("app_settings")
      .select("value")
      .eq("key", storyImageSettingKey(storyId))
      .maybeSingle();

    if (error) throw error;
    return data?.value ? parseStoryImages(data.value) : [];
  };

  const persistStoryImages = async (storyId: string, images: string[]) => {
    const cleanImages = uniqueUrls(images);
    const { error } = await supabase
      .from("app_settings")
      .upsert(
        {
          key: storyImageSettingKey(storyId),
          value: { images: cleanImages },
          updated_by: adminUserId ?? null,
        },
        { onConflict: "key" }
      );

    if (error) throw error;
  };

  const setActiveStory = async (nextStory: DailyStoryPost | null) => {
    if (!nextStory) {
      setStory(null);
      setTitleDraft("");
      setCustomImages([]);
      return;
    }

    setStory(nextStory);
    setTitleDraft(nextStory.title ?? "");
    const images = await fetchStoryImages(nextStory.id);
    setCustomImages(images);
  };

  const loadCurrentStory = async () => {
    setLoading(true);
    try {
      const [{ data: storyData, error: storyError }, { data: featuredData, error: featuredError }] =
        await Promise.all([
          supabase
            .from("posts")
            .select("id,title,description,image_url,created_at")
            .eq("hashtag", DAILY_STORY_HASHTAG)
            .order("created_at", { ascending: false })
            .limit(50),
          supabase
            .from("app_settings")
            .select("value")
            .eq("key", FEATURED_DAILY_STORY_KEY)
            .maybeSingle(),
        ]);

      if (storyError) throw storyError;
      if (featuredError) throw featuredError;

      const stories = (storyData || []) as DailyStoryPost[];
      setAvailableStories(stories);

      const featuredStoryId = featuredData?.value ? parseFeaturedStoryId(featuredData.value) : null;
      const selectedStory = featuredStoryId
        ? stories.find((item) => item.id === featuredStoryId) ?? null
        : null;

      setFeaturedSelection(featuredStoryId ?? AUTO_STORY_VALUE);
      await setActiveStory(selectedStory ?? pickDefaultStory(stories));
    } catch (error) {
      toast({
        title: "Error loading daily story",
        description: error instanceof Error ? error.message : "Failed to load stories",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadCurrentStory();
  }, []);

  const handleGenerate = async () => {
    setGenerating(true);
    setLastResult(null);

    try {
      const { data, error } = await supabase.functions.invoke("generate-daily-story");
      if (error) throw error;
      if (data?.error) throw new Error(data.error);

      setLastResult(`Story created successfully. ${data?.imageGenerated ? "AI image included." : "No AI image generated."}`);
      toast({
        title: "Daily Story Generated",
        description: "Story generated. You can now choose it for the feed.",
      });
      await loadCurrentStory();
    } catch (error) {
      const message = error instanceof Error ? error.message : "Failed to generate story";
      setLastResult(`Error: ${message}`);
      toast({ title: "Generation Failed", description: message, variant: "destructive" });
    } finally {
      setGenerating(false);
    }
  };

  const handleStorySelectionChange = async (value: string) => {
    setFeaturedSelection(value);
    const selectedStory =
      value === AUTO_STORY_VALUE
        ? pickDefaultStory(availableStories)
        : availableStories.find((item) => item.id === value) ?? null;
    await setActiveStory(selectedStory);
  };

  const handleSaveFeaturedStory = async () => {
    const selectedPostId = featuredSelection === AUTO_STORY_VALUE ? null : featuredSelection;
    if (selectedPostId && !availableStories.some((item) => item.id === selectedPostId)) {
      toast({
        title: "Invalid story selection",
        description: "Please select a valid story.",
        variant: "destructive",
      });
      return;
    }

    setSavingFeaturedStory(true);
    try {
      const { error } = await supabase
        .from("app_settings")
        .upsert(
          {
            key: FEATURED_DAILY_STORY_KEY,
            value: { postId: selectedPostId },
            updated_by: adminUserId ?? null,
          },
          { onConflict: "key" }
        );
      if (error) throw error;

      toast({
        title: "Feed story updated",
        description: selectedPostId
          ? "Selected story will appear in Daily Bible Story feed."
          : "Daily feed is set to Auto (today's latest story).",
      });
    } catch (error) {
      toast({
        title: "Could not update feed story",
        description: error instanceof Error ? error.message : "Unknown error",
        variant: "destructive",
      });
    } finally {
      setSavingFeaturedStory(false);
    }
  };

  const handleSaveTitle = async () => {
    if (!story) return;

    const nextTitle = titleDraft.trim();
    if (!nextTitle) {
      toast({ title: "Title required", description: "Please enter a title before saving.", variant: "destructive" });
      return;
    }

    const normalizedTitle =
      nextTitle.length > WEBSITE_TITLE_LIMIT
        ? nextTitle.slice(0, WEBSITE_TITLE_LIMIT)
        : nextTitle;

    setSavingTitle(true);
    try {
      const { error } = await supabase.from("posts").update({ title: normalizedTitle }).eq("id", story.id);
      if (error) throw error;

      setStory((prev) => (prev ? { ...prev, title: normalizedTitle } : prev));
      setTitleDraft(normalizedTitle);
      toast({
        title: "Title updated",
        description:
          nextTitle.length > WEBSITE_TITLE_LIMIT
            ? `Title was trimmed to ${WEBSITE_TITLE_LIMIT} characters.`
            : undefined,
      });
    } catch (error) {
      toast({
        title: "Could not update title",
        description: error instanceof Error ? error.message : "Unknown error",
        variant: "destructive",
      });
    } finally {
      setSavingTitle(false);
    }
  };

  const uploadStoryImages = async (files: File[]) => {
    if (!story || files.length === 0) return;

    setUploading(true);
    try {
      const uploadedUrls: string[] = [];

      for (let i = 0; i < files.length; i += 1) {
        const file = files[i];
        if (!ALLOWED_IMAGE_TYPES.has(file.type)) {
          throw new Error(`"${file.name}" is not supported. Use JPG or PNG only.`);
        }
        if (file.size > MAX_IMAGE_SIZE_BYTES) {
          throw new Error(`"${file.name}" is larger than 3MB.`);
        }

        const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, "_");
        const filePath = `daily-story/${story.id}/${Date.now()}-${i}-${safeName}`;

        const { error: uploadError } = await supabase.storage
          .from("post-images")
          .upload(filePath, file, { upsert: false });
        if (uploadError) throw uploadError;

        const { data: publicUrlData } = supabase.storage.from("post-images").getPublicUrl(filePath);
        uploadedUrls.push(publicUrlData.publicUrl);
      }

      const nextCustomImages = uniqueUrls([...customImages, ...uploadedUrls]);
      await persistStoryImages(story.id, nextCustomImages);
      setCustomImages(nextCustomImages);

      if (!story.image_url && uploadedUrls.length > 0) {
        const firstImage = uploadedUrls[0];
        const { error: postUpdateError } = await supabase
          .from("posts")
          .update({ image_url: firstImage })
          .eq("id", story.id);
        if (postUpdateError) throw postUpdateError;

        setStory((prev) => (prev ? { ...prev, image_url: firstImage } : prev));
      }

      toast({
        title: "Images uploaded",
        description: `${uploadedUrls.length} image${uploadedUrls.length > 1 ? "s" : ""} added.`,
      });
    } catch (error) {
      toast({
        title: "Upload failed",
        description: error instanceof Error ? error.message : "Failed to upload images",
        variant: "destructive",
      });
    } finally {
      setUploading(false);
      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }
    }
  };

  const handleFileChange = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(event.target.files ?? []);
    await uploadStoryImages(files);
  };

  const handleRemoveCustomImage = async (url: string) => {
    if (!story) return;

    try {
      const nextImages = customImages.filter((item) => item !== url);
      await persistStoryImages(story.id, nextImages);
      setCustomImages(nextImages);
      toast({ title: "Image removed from story gallery" });
    } catch (error) {
      toast({
        title: "Could not remove image",
        description: error instanceof Error ? error.message : "Unknown error",
        variant: "destructive",
      });
    }
  };

  return (
    <Card className="bg-gradient-to-br from-amber-50/50 via-card to-amber-50/30 dark:from-amber-950/20 dark:via-card dark:to-amber-950/10 border-border">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Sparkles className="h-5 w-5 text-amber-600 dark:text-amber-400" />
          Daily Bible Story
        </CardTitle>
        <CardDescription>
          Generate, choose, and manage the story shown in the Daily Bible Story feed.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex flex-wrap gap-2">
          <Button onClick={handleGenerate} disabled={generating} className="gap-2">
            {generating ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                Generating...
              </>
            ) : (
              <>
                <Sparkles className="h-4 w-4" />
                Generate Today's Story
              </>
            )}
          </Button>
          <Button variant="outline" onClick={() => void loadCurrentStory()} disabled={loading} className="gap-2">
            <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
            Refresh
          </Button>
        </div>

        {lastResult && (
          <p className={`text-sm ${lastResult.startsWith("Error") ? "text-destructive" : "text-green-600 dark:text-green-400"}`}>
            {lastResult}
          </p>
        )}

        {loading ? (
          <p className="text-sm text-muted-foreground">Loading stories...</p>
        ) : !story ? (
          <p className="text-sm text-muted-foreground">No daily stories found yet. Generate one first.</p>
        ) : (
          <>
            <div className="space-y-2">
              <Label htmlFor="featured-story">Story shown in feed</Label>
              <div className="flex flex-col md:flex-row gap-2">
                <select
                  id="featured-story"
                  value={featuredSelection}
                  onChange={(event) => void handleStorySelectionChange(event.target.value)}
                  className="flex-1 h-10 rounded-md border border-input bg-background px-3 text-sm"
                >
                  <option value={AUTO_STORY_VALUE}>Auto (today&apos;s latest story)</option>
                  {availableStories.map((item) => {
                    const createdLabel = new Date(item.created_at).toLocaleDateString("en-US", {
                      month: "short",
                      day: "numeric",
                      year: "numeric",
                    });
                    const titleLabel = (item.title || "Untitled Story").slice(0, 60);
                    return (
                      <option key={item.id} value={item.id}>
                        {createdLabel} - {titleLabel}
                      </option>
                    );
                  })}
                </select>
                <Button onClick={() => void handleSaveFeaturedStory()} disabled={savingFeaturedStory} className="gap-2">
                  {savingFeaturedStory ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                  Apply
                </Button>
              </div>
              <p className="text-xs text-muted-foreground">
                This controls which story appears in the Daily Bible Story feed on the homepage.
              </p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="daily-story-title">Story Title</Label>
              <div className="flex gap-2">
                <Input
                  id="daily-story-title"
                  value={titleDraft}
                  onChange={(event) => setTitleDraft(event.target.value)}
                  placeholder="Enter story title"
                  maxLength={WEBSITE_TITLE_LIMIT}
                />
                <Button onClick={handleSaveTitle} disabled={savingTitle} className="gap-2">
                  {savingTitle ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                  Save
                </Button>
              </div>
            </div>

            <div className="space-y-2">
              <div className="text-sm text-muted-foreground">
                AI cover image: {story.image_url ? "Available" : "Not generated"}
              </div>
              <div className="text-sm text-muted-foreground">
                Gallery images (AI + uploaded): {allImages.length}
              </div>
            </div>

            <div className="space-y-2">
              <Label>Upload Story Images</Label>
              <p className="text-xs text-muted-foreground">
                If AI did not generate an image, upload one or more images here. These images are included in story shuffling on the homepage.
              </p>
              <Button
                type="button"
                variant="outline"
                className="gap-2"
                onClick={() => fileInputRef.current?.click()}
                disabled={uploading}
              >
                {uploading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
                {uploading ? "Uploading..." : "Upload Images"}
              </Button>
              <input
                ref={fileInputRef}
                type="file"
                accept="image/jpeg,image/png"
                multiple
                className="hidden"
                onChange={(event) => void handleFileChange(event)}
              />
            </div>

            {allImages.length > 0 && (
              <div className="space-y-2">
                <Label>Story Image Gallery</Label>
                <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                  {allImages.map((url) => {
                    const isCustomImage = customImages.includes(url);
                    return (
                      <div key={url} className="rounded-md border border-border overflow-hidden bg-secondary/20">
                        <img src={url} alt="Story gallery" className="w-full h-28 object-cover" />
                        <div className="p-2 flex items-center justify-between gap-2">
                          <span className="text-xs text-muted-foreground">{isCustomImage ? "Uploaded" : "AI Cover"}</span>
                          {isCustomImage && (
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-7 w-7 text-destructive hover:text-destructive"
                              onClick={() => void handleRemoveCustomImage(url)}
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </>
        )}
      </CardContent>
    </Card>
  );
};

export default DailyStoryManagement;
