import * as React from "react";
import { cn } from "@/lib/utils";

function Skeleton({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return <div className={cn("animate-pulse rounded-md bg-muted", className)} {...props} />;
}

function Spinner({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      role="status"
      aria-label="Loading"
      className={cn(
        "h-4 w-4 animate-spin rounded-full border-2 border-muted-foreground/30 border-t-muted-foreground",
        className
      )}
      {...props}
    />
  );
}

export { Skeleton, Spinner };
