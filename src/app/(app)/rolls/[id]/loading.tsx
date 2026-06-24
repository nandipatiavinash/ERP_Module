import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export default function Loading() {
  return (
    <div className="space-y-6">
      <div className="h-10 w-40 bg-muted rounded animate-pulse" />
      <div className="space-y-2">
        <div className="h-8 w-64 bg-muted rounded animate-pulse" />
        <div className="h-4 w-96 bg-muted rounded animate-pulse" />
      </div>
      <Card>
        <CardHeader>
          <CardTitle><div className="h-6 w-32 bg-muted rounded animate-pulse" /></CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="h-10 w-full bg-muted rounded animate-pulse" />
          <div className="space-y-2 pt-2">
            {[1, 2, 3, 4, 5].map((i) => (
              <div key={i} className="h-12 w-full bg-muted/60 rounded animate-pulse" />
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
