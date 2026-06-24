"use client";

import { useRouter } from "next/navigation";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";

interface DateRangeFilterProps {
  from: string;
  to: string;
  baseUrl: string;
}

export function DateRangeFilter({ from, to, baseUrl }: DateRangeFilterProps) {
  const router = useRouter();

  const handleFromChange = (newFrom: string) => {
    router.push(`${baseUrl}?from=${newFrom}&to=${to}` as any);
  };

  const handleToChange = (newTo: string) => {
    router.push(`${baseUrl}?from=${from}&to=${newTo}` as any);
  };

  return (
    <div className="flex flex-wrap items-center gap-4 bg-white p-3 rounded-lg border border-slate-200 shadow-sm no-print">
      <div className="flex items-center gap-2">
        <Label htmlFor="from-date" className="font-semibold text-sm shrink-0 text-slate-700">
          From:
        </Label>
        <Input
          id="from-date"
          type="date"
          value={from}
          onChange={(e) => handleFromChange(e.target.value)}
          className="w-40 h-8 text-sm"
        />
      </div>
      <div className="flex items-center gap-2">
        <Label htmlFor="to-date" className="font-semibold text-sm shrink-0 text-slate-700">
          To:
        </Label>
        <Input
          id="to-date"
          type="date"
          value={to}
          onChange={(e) => handleToChange(e.target.value)}
          className="w-40 h-8 text-sm"
        />
      </div>
    </div>
  );
}
