import { useBibleVerse } from "@/hooks/useBibleVerse";
import { useState } from 'react';
import { BookOpen, Wifi, WifiOff } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import ReactMarkdown from 'react-markdown';
import { BiblePassageDialog } from '@/components/BiblePassageDialog';
import { enrichContentWithIcons, markdownLinkComponents } from '@/lib/markdown';


const DailyBibleVerse = () => {
  const { verse, loading, isOnline } = useBibleVerse();
  const [passageRef, setPassageRef] = useState<string | null>(null);
  const [passageOpen, setPassageOpen] = useState(false);

  const openBibleRef = (ref: string) => {
    setPassageRef(ref);
    setPassageOpen(true);
  }

  if (loading) {
    return (
      <div className="bg-gradient-to-br from-primary/10 via-card to-primary/5 border border-border rounded-xl p-6 mb-6">
        <div className="flex items-center gap-2 mb-4">
          <BookOpen className="h-5 w-5 text-primary" />
          <Skeleton className="h-5 w-40" />
        </div>
        <Skeleton className="h-4 w-full mb-2" />
        <Skeleton className="h-4 w-3/4" />
      </div>
    );
  }

  if (!verse) {
    return null;
  }

  return (
    <div className="relative overflow-hidden bg-gradient-to-br from-primary/10 via-card to-primary/5 border border-border rounded-xl p-6 mb-6">
      {/* Decorative elements */}
      <div className="absolute top-0 right-0 w-32 h-32 bg-primary/5 rounded-full -translate-y-1/2 translate-x-1/2" />
      <div className="absolute bottom-0 left-0 w-24 h-24 bg-primary/5 rounded-full translate-y-1/2 -translate-x-1/2" />
      
      <div className="relative">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <div className="p-2 bg-primary/20 rounded-lg">
              <BookOpen className="h-5 w-5 text-primary" />
            </div>
            <div>
              <h3 className="text-sm font-medium text-muted-foreground">Daily Memory Verse</h3>
              <p className="text-lg font-semibold text-primary">{verse.reference}</p>
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
        
        <blockquote className="text-foreground/90 italic text-base leading-relaxed pl-4 border-l-2 border-primary/50">
          <ReactMarkdown components={markdownLinkComponents(openBibleRef)}>{enrichContentWithIcons(verse.text)}</ReactMarkdown>
        </blockquote>
      </div>
      <BiblePassageDialog reference={passageRef} open={passageOpen} onOpenChange={setPassageOpen} />
    </div>
  );
};

export default DailyBibleVerse;
