"use client";

import { useRouter } from "next/navigation";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";

export function DateFilter({ date, baseUrl }: { date: string; baseUrl: string }) {
  const router = useRouter();

  return (
    <div className="flex items-center gap-3 bg-white p-3 rounded-lg border border-slate-200 shadow-sm no-print">
      <Label htmlFor="date-filter" className="font-semibold text-sm shrink-0">
        Filter by Date:
      </Label>
      <Input
        id="date-filter"
        type="date"
        value={date}
        onChange={(e) => {
          const newDate = e.target.value;
          router.push(`${baseUrl}?date=${newDate}` as any);
        }}
        className="w-44 h-8 text-sm"
      />
    </div>
  );
}
