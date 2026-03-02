import { Calendar, MapPin, Users } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import React from "react";

interface ActivityCardProps {
  title: string;
  date: string;
  location?: string;
  attendees?: number;
  image?: string;
  className?: string;
  style?: React.CSSProperties;
}

const ActivityCard = ({
  title,
  date,
  location,
  attendees = 0,
  image,
  className,
  style,
}: ActivityCardProps) => {
  return (
    <div
      style={style}
      className={cn(
        "bg-card rounded-lg overflow-hidden card-shadow animate-slide-up",
        className
      )}
    >
      {image && (
        <div className="relative h-32 overflow-hidden">
          <img
            src={image}
            alt={title}
            className="w-full h-full object-cover"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-card to-transparent" />
        </div>
      )}
      
      <div className="p-4">
        <h3 className="font-heading font-semibold text-lg text-foreground mb-2">
          {title}
        </h3>
        
        <div className="space-y-2 mb-4">
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Calendar className="w-4 h-4 text-primary" />
            <span>{date}</span>
          </div>
          
          {location && (
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <MapPin className="w-4 h-4 text-primary" />
              <span>{location}</span>
            </div>
          )}
          
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Users className="w-4 h-4 text-primary" />
            <span>{attendees} attending</span>
          </div>
        </div>
        
        <Button className="w-full bg-primary text-primary-foreground hover:bg-primary/90">
          Join Activity
        </Button>
      </div>
    </div>
  );
};

export default ActivityCard;
