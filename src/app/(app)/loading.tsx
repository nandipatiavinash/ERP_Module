import { Card, CardContent, CardHeader } from "@/components/ui/card";

export default function GlobalLoading() {
  return (
    <div className="space-y-6 animate-pulse">
      {/* Header Skeleton */}
      <div className="space-y-2">
        <div className="h-8 w-48 bg-muted rounded-md" />
        <div className="h-4 w-80 bg-muted/80 rounded-md" />
      </div>

      {/* Main Grid/Cards Skeleton */}
      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
        {[1, 2, 3].map((i) => (
          <Card key={i} className="border-muted/40">
            <CardHeader className="space-y-2">
              <div className="h-5 w-32 bg-muted rounded-md" />
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="h-10 w-full bg-muted/60 rounded-md" />
              <div className="h-4 w-5/6 bg-muted/40 rounded-md" />
              <div className="h-4 w-4/6 bg-muted/40 rounded-md" />
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Table/List Skeleton */}
      <Card className="border-muted/40">
        <CardHeader>
          <div className="h-5 w-40 bg-muted rounded-md" />
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="h-8 w-full bg-muted/70 rounded-md" />
          {[1, 2, 3, 4, 5].map((i) => (
            <div key={i} className="h-12 w-full bg-muted/40 rounded-md" />
          ))}
        </CardContent>
      </Card>
    </div>
  );
}
