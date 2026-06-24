import { Inbox } from "lucide-react";

export function EmptyState({ title = "No records found", description = "Create a record to get started." }) {
  return (
    <div className="flex min-h-40 flex-col items-center justify-center gap-2 rounded-lg border border-dashed bg-muted/30 p-8 text-center">
      <Inbox className="h-8 w-8 text-muted-foreground" />
      <div className="text-sm font-medium">{title}</div>
      <div className="text-sm text-muted-foreground">{description}</div>
    </div>
  );
}
