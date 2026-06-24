import { Badge } from "@/components/ui/badge";

export function StatusBadge({ value }: { value: string }) {
  const tone =
    value === "active" || value === "available" || value === "confirmed" || value === "present"
      ? "border-emerald-200 bg-emerald-50 text-emerald-700"
      : value === "inactive" || value === "voided" || value === "cancelled" || value === "absent"
        ? "border-red-200 bg-red-50 text-red-700"
        : "border-amber-200 bg-amber-50 text-amber-700";
  const displayLabel = value === "draft" ? "Pending" : value.replaceAll("_", " ");
  return <Badge className={tone}>{displayLabel}</Badge>;
}
