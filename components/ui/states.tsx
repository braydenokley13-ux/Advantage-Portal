import { Card, CardContent } from "@/components/ui/card";
import { Lock } from "lucide-react";
import { cn } from "@/lib/utils";

export function EmptyState({
  icon: Icon,
  title,
  description,
  action,
  className,
}: {
  icon?: React.ComponentType<{ className?: string }>;
  title: string;
  description?: string;
  action?: React.ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "px-4 py-10 flex flex-col items-center text-center",
        className
      )}
    >
      {Icon && (
        <div className="h-10 w-10 rounded-full bg-secondary flex items-center justify-center mb-2">
          <Icon className="h-5 w-5 text-muted-foreground" />
        </div>
      )}
      <p className="text-sm font-medium">{title}</p>
      {description && (
        <p className="text-xs text-muted-foreground mt-0.5 max-w-sm">
          {description}
        </p>
      )}
      {action && <div className="mt-3">{action}</div>}
    </div>
  );
}

export function AccessDenied({
  title = "Access restricted",
  description = "You don't have permission to view this page.",
}: {
  title?: string;
  description?: string;
}) {
  return (
    <div className="container py-12 max-w-md">
      <Card>
        <CardContent className="p-8 text-center">
          <div className="mx-auto h-10 w-10 rounded-full bg-secondary flex items-center justify-center mb-3">
            <Lock className="h-5 w-5 text-muted-foreground" />
          </div>
          <p className="text-sm font-semibold">{title}</p>
          <p className="text-xs text-muted-foreground mt-1">{description}</p>
        </CardContent>
      </Card>
    </div>
  );
}

export function Skeleton({
  className,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn(
        "animate-pulse rounded-md bg-secondary/70",
        className
      )}
      {...props}
    />
  );
}

export function SkeletonRow() {
  return (
    <div className="flex items-center gap-3 px-4 py-3">
      <Skeleton className="h-8 w-8 rounded-full" />
      <div className="flex-1 space-y-2">
        <Skeleton className="h-3 w-2/3" />
        <Skeleton className="h-2.5 w-1/3" />
      </div>
      <Skeleton className="h-3 w-12" />
    </div>
  );
}

export function SkeletonCard() {
  return (
    <div className="rounded-lg border border-border bg-card p-4 space-y-3">
      <Skeleton className="h-4 w-1/2" />
      <Skeleton className="h-3 w-full" />
      <Skeleton className="h-3 w-5/6" />
      <div className="flex items-center gap-2 pt-1">
        <Skeleton className="h-6 w-6 rounded-full" />
        <Skeleton className="h-3 w-16" />
      </div>
    </div>
  );
}
