import { CheckCircle2, Circle, Clock } from "lucide-react";
import { cn } from "@/lib/utils";
import React from "react";

interface TaskCardProps {
  title: string;
  description?: string;
  dueDate?: string;
  completed?: boolean;
  priority?: "low" | "medium" | "high";
  onToggle?: () => void;
  className?: string;
  style?: React.CSSProperties;
}

const TaskCard = ({
  title,
  description,
  dueDate,
  completed = false,
  priority = "medium",
  onToggle,
  className,
  style,
}: TaskCardProps) => {
  const priorityColors = {
    low: "border-l-muted-foreground",
    medium: "border-l-primary",
    high: "border-l-destructive",
  };

  return (
    <div
      style={style}
      className={cn(
        "bg-card rounded-lg p-4 border-l-4 card-shadow animate-slide-up",
        priorityColors[priority],
        completed && "opacity-60",
        className
      )}
    >
      <div className="flex items-start gap-3">
        <button
          onClick={onToggle}
          className="mt-0.5 text-muted-foreground hover:text-primary transition-colors"
        >
          {completed ? (
            <CheckCircle2 className="w-5 h-5 text-primary" />
          ) : (
            <Circle className="w-5 h-5" />
          )}
        </button>
        
        <div className="flex-1">
          <h3
            className={cn(
              "font-medium text-foreground",
              completed && "line-through text-muted-foreground"
            )}
          >
            {title}
          </h3>
          {description && (
            <p className="text-sm text-muted-foreground mt-1">{description}</p>
          )}
          {dueDate && (
            <div className="flex items-center gap-1 mt-2 text-xs text-muted-foreground">
              <Clock className="w-3 h-3" />
              <span>{dueDate}</span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default TaskCard;
