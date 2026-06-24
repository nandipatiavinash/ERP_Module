"use client";

import { useState, useMemo } from "react";
import { ChevronDown, ChevronUp, ChevronsUpDown } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { StatusBadge } from "@/components/app/status-badge";
import { formatDate, formatNumber } from "@/lib/utils";

type SortKey =
  | "roll_number"
  | "net_weight"
  | "core_weight"
  | "gross_weight"
  | "net_meters"
  | "avg_meter_weight"
  | "loom_number"
  | "production_date"
  | "dispatch_date"
  | "client_name";

type SortDir = "asc" | "desc";

interface Roll {
  id: string;
  roll_number: string;
  production_date: string | null;
  status: string;
  looms?: { loom_number: string | null } | null;
  loom_production_entries?: {
    gross_weight: number | null;
    core_weight: number | null;
    net_weight: number | null;
    net_meters: number | null;
    average_meter_weight: number | null;
  } | null;
}

interface AllocationInfo {
  dispatchDate: string;
  clientName: string;
}

interface StockRollsClientProps {
  availableRolls: Roll[];
  soldRolls: Roll[];
  rollAllocationMap: Record<string, AllocationInfo>;
  fabricName: string;
}

function SortIcon({ col, sortKey, sortDir }: { col: SortKey; sortKey: SortKey; sortDir: SortDir }) {
  if (col !== sortKey) return <ChevronsUpDown className="inline h-3.5 w-3.5 ml-1 text-slate-300" />;
  return sortDir === "asc"
    ? <ChevronUp className="inline h-3.5 w-3.5 ml-1 text-primary" />
    : <ChevronDown className="inline h-3.5 w-3.5 ml-1 text-primary" />;
}

function SortableHead({
  col,
  label,
  sortKey,
  sortDir,
  onSort,
  className,
}: {
  col: SortKey;
  label: string;
  sortKey: SortKey;
  sortDir: SortDir;
  onSort: (col: SortKey) => void;
  className?: string;
}) {
  return (
    <TableHead
      className={`cursor-pointer select-none whitespace-nowrap hover:bg-muted/40 transition-colors ${className ?? ""}`}
      onClick={() => onSort(col)}
    >
      {label}
      <SortIcon col={col} sortKey={sortKey} sortDir={sortDir} />
    </TableHead>
  );
}

function useSort(initialKey: SortKey = "roll_number") {
  const [sortKey, setSortKey] = useState<SortKey>(initialKey);
  const [sortDir, setSortDir] = useState<SortDir>("asc");

  const handleSort = (col: SortKey) => {
    if (col === sortKey) {
      setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    } else {
      setSortKey(col);
      setSortDir("asc");
    }
  };

  return { sortKey, sortDir, handleSort };
}

function sortRolls(rolls: Roll[], map: Record<string, AllocationInfo>, key: SortKey, dir: SortDir): Roll[] {
  return [...rolls].sort((a, b) => {
    const lpeA = a.loom_production_entries;
    const lpeB = b.loom_production_entries;
    const allocA = map[a.id];
    const allocB = map[b.id];

    let valA: string | number = 0;
    let valB: string | number = 0;

    switch (key) {
      case "roll_number":
        valA = a.roll_number ?? "";
        valB = b.roll_number ?? "";
        break;
      case "net_weight":
        valA = Number(lpeA?.net_weight ?? 0);
        valB = Number(lpeB?.net_weight ?? 0);
        break;
      case "core_weight":
        valA = Number(lpeA?.core_weight ?? 0);
        valB = Number(lpeB?.core_weight ?? 0);
        break;
      case "gross_weight":
        valA = Number(lpeA?.gross_weight ?? 0);
        valB = Number(lpeB?.gross_weight ?? 0);
        break;
      case "net_meters":
        valA = Number(lpeA?.net_meters ?? 0);
        valB = Number(lpeB?.net_meters ?? 0);
        break;
      case "avg_meter_weight":
        valA = Number(lpeA?.average_meter_weight ?? 0);
        valB = Number(lpeB?.average_meter_weight ?? 0);
        break;
      case "loom_number":
        valA = a.looms?.loom_number ?? "";
        valB = b.looms?.loom_number ?? "";
        break;
      case "production_date":
        valA = a.production_date ?? "";
        valB = b.production_date ?? "";
        break;
      case "dispatch_date":
        valA = allocA?.dispatchDate ?? "";
        valB = allocB?.dispatchDate ?? "";
        break;
      case "client_name":
        valA = allocA?.clientName ?? "";
        valB = allocB?.clientName ?? "";
        break;
    }

    if (typeof valA === "string" && typeof valB === "string") {
      const cmp = valA.localeCompare(valB, undefined, { numeric: true, sensitivity: "base" });
      return dir === "asc" ? cmp : -cmp;
    }
    const cmp = (valA as number) - (valB as number);
    return dir === "asc" ? cmp : -cmp;
  });
}

function RollsTable({
  rolls,
  allocationMap,
  sortKey,
  sortDir,
  onSort,
}: {
  rolls: Roll[];
  allocationMap: Record<string, AllocationInfo>;
  sortKey: SortKey;
  sortDir: SortDir;
  onSort: (col: SortKey) => void;
}) {
  const sorted = useMemo(() => sortRolls(rolls, allocationMap, sortKey, sortDir), [rolls, allocationMap, sortKey, sortDir]);

  return (
    <div className="overflow-x-auto">
      <Table>
        <TableHeader>
          <TableRow>
            <SortableHead col="roll_number" label="S.No" sortKey={sortKey} sortDir={sortDir} onSort={onSort} />
            <SortableHead col="net_weight" label="Net W8" sortKey={sortKey} sortDir={sortDir} onSort={onSort} className="text-right" />
            <SortableHead col="core_weight" label="Core W8" sortKey={sortKey} sortDir={sortDir} onSort={onSort} className="text-right" />
            <SortableHead col="gross_weight" label="Gross W8" sortKey={sortKey} sortDir={sortDir} onSort={onSort} className="text-right" />
            <SortableHead col="net_meters" label="Mtrs" sortKey={sortKey} sortDir={sortDir} onSort={onSort} className="text-right" />
            <SortableHead col="avg_meter_weight" label="Avg Mtrs" sortKey={sortKey} sortDir={sortDir} onSort={onSort} className="text-right" />
            <SortableHead col="loom_number" label="Loom" sortKey={sortKey} sortDir={sortDir} onSort={onSort} />
            <SortableHead col="production_date" label="Prod Date" sortKey={sortKey} sortDir={sortDir} onSort={onSort} />
            <SortableHead col="dispatch_date" label="Dispatch Date" sortKey={sortKey} sortDir={sortDir} onSort={onSort} />
            <SortableHead col="client_name" label="Client Name" sortKey={sortKey} sortDir={sortDir} onSort={onSort} />
            <TableHead>Status</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {sorted.map((roll) => {
            const lpe = roll.loom_production_entries;
            const allocation = allocationMap[roll.id];
            return (
              <TableRow key={roll.id} className="hover:bg-muted/30">
                <TableCell className="font-bold text-emerald-950">{roll.roll_number}</TableCell>
                <TableCell className="text-right font-medium text-emerald-900">{formatNumber(lpe?.net_weight, 2)}</TableCell>
                <TableCell className="text-right text-muted-foreground">{formatNumber(lpe?.core_weight, 2)}</TableCell>
                <TableCell className="text-right text-muted-foreground">{formatNumber(lpe?.gross_weight, 2)}</TableCell>
                <TableCell className="text-right font-medium text-emerald-900">{formatNumber(Math.floor(lpe?.net_meters ?? 0), 0)}</TableCell>
                <TableCell className="text-right text-muted-foreground">{formatNumber(Math.floor(lpe?.average_meter_weight ?? 0), 0)}</TableCell>
                <TableCell className="font-medium">{roll.looms?.loom_number ?? "N/A"}</TableCell>
                <TableCell className="whitespace-nowrap">{formatDate(roll.production_date)}</TableCell>
                <TableCell className="whitespace-nowrap">{allocation ? formatDate(allocation.dispatchDate) : "—"}</TableCell>
                <TableCell className="font-medium">{allocation ? allocation.clientName : "—"}</TableCell>
                <TableCell>
                  <StatusBadge value={roll.status} />
                </TableCell>
              </TableRow>
            );
          })}
        </TableBody>
      </Table>
    </div>
  );
}

function CollapsibleRollSection({
  title,
  count,
  rolls,
  allocationMap,
  fabricName,
  defaultOpen = false,
  emptyTitle,
  emptyDescription,
}: {
  title: string;
  count: number;
  rolls: Roll[];
  allocationMap: Record<string, AllocationInfo>;
  fabricName: string;
  defaultOpen?: boolean;
  emptyTitle: string;
  emptyDescription: string;
}) {
  const [open, setOpen] = useState(defaultOpen);
  const { sortKey, sortDir, handleSort } = useSort("roll_number");

  return (
    <div className="rounded-xl border border-slate-200 bg-white shadow-sm overflow-hidden">
      {/* Clickable Header */}
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="w-full flex items-center gap-3 px-5 py-4 text-left transition hover:bg-slate-50 group"
      >
        <span
          className={`flex h-6 w-6 items-center justify-center rounded-full bg-slate-100 text-slate-500 text-xs font-bold transition-transform duration-200 ${
            open ? "rotate-90" : ""
          }`}
        >
          ▶
        </span>
        <span className="font-semibold text-slate-700">
          {title} ({count})
        </span>
        <span className="ml-auto text-xs text-muted-foreground">
          {open ? "Click to collapse" : "Click to expand"}
        </span>
        {open ? (
          <ChevronUp className="h-4 w-4 text-slate-400" />
        ) : (
          <ChevronDown className="h-4 w-4 text-slate-400" />
        )}
      </button>

      {/* Expandable Content */}
      {open && (
        <div className="border-t border-slate-100">
          <div className="p-4">
            {rolls.length === 0 ? (
              <EmptyState title={emptyTitle} description={emptyDescription} />
            ) : (
              <RollsTable
                rolls={rolls}
                allocationMap={allocationMap}
                sortKey={sortKey}
                sortDir={sortDir}
                onSort={handleSort}
              />
            )}
          </div>
        </div>
      )}
    </div>
  );
}

export function StockRollsClient({
  availableRolls,
  soldRolls,
  rollAllocationMap,
  fabricName,
}: StockRollsClientProps) {
  return (
    <div className="space-y-4">
      {/* Available Rolls – Collapsible */}
      <CollapsibleRollSection
        title="Available Rolls"
        count={availableRolls.length}
        rolls={availableRolls}
        allocationMap={rollAllocationMap}
        fabricName={fabricName}
        defaultOpen={true}
        emptyTitle="No available rolls"
        emptyDescription={`All rolls for ${fabricName} have been sold or there are none yet.`}
      />

      {/* Sold Rolls – Collapsible */}
      <CollapsibleRollSection
        title="Sold Rolls"
        count={soldRolls.length}
        rolls={soldRolls}
        allocationMap={rollAllocationMap}
        fabricName={fabricName}
        defaultOpen={false}
        emptyTitle="No sold rolls"
        emptyDescription={`No rolls for ${fabricName} have been sold yet.`}
      />
    </div>
  );
}
