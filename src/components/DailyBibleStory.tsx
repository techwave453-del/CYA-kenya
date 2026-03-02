import { useDailyStory } from "@/hooks/useDailyStory";
import { BookOpen, ChevronDown, ChevronUp, Copy, Share2, Shuffle, Wifi, WifiOff } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { useEffect, useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { toast } from "@/hooks/use-toast";

const WEBSITE_TEXT_LIMIT = 280;
const WEBSITE_TEXT_WITH_LINK_LIMIT = 257;
const WEBSITE_TITLE_LIMIT = 70;

const shuffleArray = (items: string[]): string[] => {
  const shuffled = [...items];
  for (let i = shuffled.length - 1; i > 0; i -= 1) {
    const randomIndex = Math.floor(Math.random() * (i + 1));
    [shuffled[i], shuffled[randomIndex]] = [shuffled[randomIndex], shuffled[i]];
  }
  return shuffled;
};

const truncateText = (value: string, maxLength: number): string =>
  value.length <= maxLength ? value : `${value.slice(0, maxLength - 3)}...`;

const DailyBibleStory = () => {
  const { story, loading, isOnline } = useDailyStory();
  const [expanded, setExpanded] = useState(false);
  const [shuffledImages, setShuffledImages] = useState<string[]>([]);
  const [currentImageIndex, setCurrentImageIndex] = useState(0);

  const storyImages = useMemo(() => {
    if (story?.image_urls && story.image_urls.length > 0) {
      return story.image_urls;
    }
    return story?.image_url ? [story.image_url] : [];
  }, [story?.image_url, story?.image_urls]);

  useEffect(() => {
    setShuffledImages(shuffleArray(storyImages));
    setCurrentImageIndex(0);
  }, [story?.id, storyImages]);

  useEffect(() => {
    if (shuffledImages.length <= 1) {
      return;
    }

    const interval = setInterval(() => {
      setCurrentImageIndex((prev) => (prev + 1) % shuffledImages.length);
    }, 6000);

    return () => clearInterval(interval);
  }, [shuffledImages.length]);

  if (loading) {
    return (
      <div className="bg-gradient-to-br from-amber-50 via-card to-amber-50/50 dark:from-amber-950/20 dark:via-card dark:to-amber-950/10 border border-border rounded-xl overflow-hidden mb-6">
        <div className="p-6">
          <div className="flex items-center gap-2 mb-4">
            <BookOpen className="h-5 w-5 text-amber-600 dark:text-amber-400" />
            <Skeleton className="h-5 w-48" />
          </div>
          <Skeleton className="h-4 w-full mb-2" />
          <Skeleton className="h-4 w-3/4 mb-4" />
          <Skeleton className="h-48 w-full rounded-lg" />
        </div>
      </div>
    );
  }

  if (!story) {
    return null;
  }

  const isLongStory = story.description && story.description.length > 300;
  const displayedText = expanded
    ? story.description
    : story.description?.substring(0, 300) + (isLongStory ? "..." : "");

  const activeImage = shuffledImages[currentImageIndex];
  const canShuffle = shuffledImages.length > 1;
  const shareTitle = truncateText(story.title || "Daily Bible Story", WEBSITE_TITLE_LIMIT);
  const shareBody = story.description || "";
  const shareText = `${shareTitle}\n\n${truncateText(shareBody, WEBSITE_TEXT_LIMIT)}`;
  const shareTextWithLink = `${shareTitle}\n\n${truncateText(shareBody, WEBSITE_TEXT_WITH_LINK_LIMIT)}`;
  const shareUrl = window.location.href;

  const handleCopyStory = async () => {
    try {
      await navigator.clipboard.writeText(shareText);
      toast({ title: "Story copied" });
    } catch {
      toast({
        title: "Copy failed",
        description: "Your browser blocked clipboard access.",
        variant: "destructive",
      });
    }
  };

  const handleShareStory = async () => {
    try {
      if (navigator.share) {
        await navigator.share({
          title: shareTitle,
          text: shareTextWithLink,
          url: shareUrl,
        });
        return;
      }

      await navigator.clipboard.writeText(`${shareTextWithLink}\n\n${shareUrl}`);
      toast({
        title: "Share unavailable",
        description: "Story copied instead.",
      });
    } catch (error) {
      if (error instanceof Error && error.name === "AbortError") {
        return;
      }
      toast({
        title: "Share failed",
        description: "Please try again.",
        variant: "destructive",
      });
    }
  };

  return (
    <div className="relative overflow-hidden bg-gradient-to-br from-amber-50 via-card to-amber-50/50 dark:from-amber-950/20 dark:via-card dark:to-amber-950/10 border border-border rounded-xl mb-6 card-shadow animate-slide-up">
      {/* Decorative elements */}
      <div className="absolute top-0 right-0 w-32 h-32 bg-amber-200/10 dark:bg-amber-600/5 rounded-full -translate-y-1/2 translate-x-1/2" />
      <div className="absolute bottom-0 left-0 w-24 h-24 bg-amber-200/10 dark:bg-amber-600/5 rounded-full translate-y-1/2 -translate-x-1/2" />

      <div className="relative">
        {/* Header */}
        <div className="px-6 pt-6 pb-4">
          <div className="flex items-start justify-between mb-4">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-amber-100 dark:bg-amber-900/30 rounded-lg">
                <BookOpen className="h-5 w-5 text-amber-700 dark:text-amber-400" />
              </div>
              <div>
                <h3 className="text-sm font-medium text-muted-foreground">Daily Bible Story</h3>
                {story.title && (
                  <p className="text-lg font-semibold text-amber-900 dark:text-amber-300 line-clamp-2">
                    {story.title}
                  </p>
                )}
              </div>
            </div>
            <div className="flex items-center gap-1 text-xs text-muted-foreground">
              {isOnline ? (
                <Wifi className="h-3 w-3" />
              ) : (
                <WifiOff className="h-3 w-3" />
              )}
            </div>
          </div>

          {/* Image */}
          {activeImage && (
            <div className="relative rounded-lg overflow-hidden mb-4">
              <div className="relative w-full aspect-square sm:aspect-[1.91/1] bg-black/5 dark:bg-black/20">
                <img
                  src={activeImage}
                  alt={story.title || "Daily Bible Story"}
                  className="daily-story-image no-global-img-style absolute inset-0 w-full h-full object-contain object-center"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-black/30 via-transparent to-transparent" />
                <div className="absolute bottom-2 right-2 flex items-center gap-2">
                  <span className="text-[11px] px-2 py-1 rounded bg-black/60 text-white">
                    {currentImageIndex + 1} / {shuffledImages.length}
                  </span>
                  {canShuffle && (
                    <Button
                      type="button"
                      variant="secondary"
                      size="sm"
                      className="h-7 px-2 bg-black/60 text-white hover:bg-black/70"
                      onClick={() => {
                        setShuffledImages(shuffleArray(storyImages));
                        setCurrentImageIndex(0);
                      }}
                    >
                      <Shuffle className="h-3.5 w-3.5 mr-1" />
                      Shuffle
                    </Button>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* Story Text */}
          <div className="text-foreground/90 leading-relaxed text-sm mb-4">
            {displayedText}
          </div>

          {/* Expand/Collapse Button */}
          {isLongStory && (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setExpanded(!expanded)}
              className="text-amber-700 dark:text-amber-400 hover:bg-amber-100/50 dark:hover:bg-amber-900/30 px-0"
            >
              {expanded ? (
                <>
                  <ChevronUp className="h-4 w-4 mr-1" />
                  Show Less
                </>
              ) : (
                <>
                  <ChevronDown className="h-4 w-4 mr-1" />
                  Read More
                </>
              )}
            </Button>
          )}
        </div>

        {/* Footer metadata */}
        <div className="px-6 py-3 border-t border-border/30 flex items-center justify-between bg-background/40">
          <div className="text-xs text-muted-foreground">
            Posted {new Date(story.created_at).toLocaleDateString("en-US", {
              month: "short",
              day: "numeric",
              year: "numeric",
            })}
          </div>
          <div className="flex items-center gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="h-7 px-2 text-xs"
              onClick={() => void handleCopyStory()}
            >
              <Copy className="h-3.5 w-3.5 mr-1" />
              Copy
            </Button>
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="h-7 px-2 text-xs"
              onClick={() => void handleShareStory()}
            >
              <Share2 className="h-3.5 w-3.5 mr-1" />
              Share
            </Button>
            {story.hashtag && (
              <span className="hidden sm:inline text-xs font-medium text-amber-700 dark:text-amber-400">
                #{story.hashtag.replace("#", "")}
              </span>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default DailyBibleStory;
