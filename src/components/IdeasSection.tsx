import { Lightbulb, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";

interface IdeasSectionProps {
  onShareIdea?: () => void;
}

const IdeasSection = ({ onShareIdea }: IdeasSectionProps) => {
  return (
    <section className="px-4 py-4 border-b border-border/30">
      <div className="flex items-center gap-2 mb-4">
        <span className="text-2xl">📝</span>
        <h2 className="font-heading text-lg font-semibold text-foreground">
          Ideas & Posts
        </h2>
      </div>
      
      <Button
        onClick={onShareIdea}
        variant="outline"
        className="w-full py-6 border-2 border-dashed border-border hover:border-primary hover:bg-primary/5 transition-all duration-300 group"
      >
        <Plus className="w-5 h-5 mr-2 text-muted-foreground group-hover:text-primary transition-colors" />
        <span className="text-muted-foreground group-hover:text-foreground transition-colors font-medium">
          Share Idea
        </span>
      </Button>
    </section>
  );
};

export default IdeasSection;
