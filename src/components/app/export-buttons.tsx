"use client";

import { Download, FileText, Printer } from "lucide-react";
import { Button } from "@/components/ui/button";
import { csvEscape } from "@/lib/utils";

export function ExportButtons({ filename, rows }: { filename: string; rows: Record<string, unknown>[] }) {
  function downloadCsv() {
    const headers = Object.keys(rows[0] ?? {});
    const csv = [headers.map(csvEscape).join(","), ...rows.map((row) => headers.map((key) => csvEscape(row[key])).join(","))].join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `${filename}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  }

  return (
    <div className="no-print flex flex-wrap gap-2">
      <Button type="button" variant="outline" size="sm" onClick={downloadCsv}>
        <Download className="h-4 w-4" /> Excel
      </Button>
      <Button type="button" variant="outline" size="sm" onClick={() => window.print()}>
        <FileText className="h-4 w-4" /> PDF
      </Button>
      <Button type="button" variant="outline" size="sm" onClick={() => window.print()}>
        <Printer className="h-4 w-4" /> Print
      </Button>
    </div>
  );
}
