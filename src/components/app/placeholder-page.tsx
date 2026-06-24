import { PageHeader } from "@/components/app/page-header";
import { Card, CardContent } from "@/components/ui/card";
import { AlertCircle } from "lucide-react";

export function PlaceholderPage({ title, description }: { title: string; description: string }) {
  return (
    <>
      <PageHeader title={title} description={description} />
      <Card className="border border-dashed border-muted-foreground/30 bg-muted/10">
        <CardContent className="flex flex-col items-center justify-center py-16 text-center">
          <AlertCircle className="h-12 w-12 text-muted-foreground mb-4 animate-pulse" />
          <h3 className="text-xl font-bold text-foreground">Legacy System Integration</h3>
          <p className="mt-2 text-sm text-muted-foreground max-w-md">
            The database tables and background permissions are provisioned. The UI module for {title} is scheduled for implementation in the next iteration.
          </p>
        </CardContent>
      </Card>
    </>
  );
}
