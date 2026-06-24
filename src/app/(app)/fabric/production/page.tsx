import { ConfirmSubmitButton } from "@/components/app/confirm-submit-button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { PageHeader } from "@/components/app/page-header";
import { ProductionForm } from "@/components/app/production-form";
import { ProductionEditDialog } from "@/components/app/production-edit-dialog";
import { StatusBadge } from "@/components/app/status-badge";
import { softDeleteProduction } from "@/app/(app)/_actions";
import { isAdmin, requirePermission } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { formatDate, formatNumber } from "@/lib/utils";

export default async function FabricProductionPage() {
  const user = await requirePermission("fabric.production");
  const admin = isAdmin(user);
  const supabase = await createClient();
  const today = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Kolkata",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
  
  const [{ data: fabrics }, { data: looms }, { data: rows }, { data: meterRows }, { data: allSerials }] = await Promise.all([
    supabase.from("fabric_types").select("id, fabric_name").eq("status", "active").is("deleted_at", null).order("fabric_name"),
    supabase.from("looms").select("id, loom_number").eq("status", "active").is("deleted_at", null).order("loom_number"),
    supabase
      .from("loom_production_entries")
      .select("*, fabric_types(fabric_name), looms(loom_number), fabric_rolls(roll_number, status)")
      .is("deleted_at", null)
      .eq("entry_date", today)
      .order("created_at", { ascending: false }),
    (supabase as any).rpc("get_last_end_meters_by_loom"),
    supabase.from("loom_production_entries").select("fabric_type_id, serial_number").is("deleted_at", null),
  ]);

  const productionRows = ((rows ?? []) as any[]).sort((a, b) => {
    return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
  });
  const meterHistory = (meterRows ?? []) as any[];
  const lastMeters: Record<string, number> = {};
  for (const row of meterHistory) {
    if (row.loom_id && lastMeters[row.loom_id] === undefined) lastMeters[row.loom_id] = Number(row.end_meters ?? 0);
  }
  for (const loom of (looms ?? []) as any[]) {
    if (lastMeters[loom.id] === undefined) lastMeters[loom.id] = 0;
  }

  // Calculate next serial number for each fabric type
  const nextSerials: Record<string, string> = {};
  const serialsGrouped: Record<string, number[]> = {};
  for (const s of (allSerials ?? []) as any[]) {
    if (!s.fabric_type_id) continue;
    if (!serialsGrouped[s.fabric_type_id]) {
      serialsGrouped[s.fabric_type_id] = [];
    }
    const num = parseInt(s.serial_number, 10);
    if (!isNaN(num)) {
      serialsGrouped[s.fabric_type_id].push(num);
    }
  }
  for (const fabric of (fabrics ?? []) as any[]) {
    const list = serialsGrouped[fabric.id] ?? [];
    const maxVal = list.length > 0 ? Math.max(...list) : 0;
    nextSerials[fabric.id] = String(maxVal + 1);
  }

  return (
    <>
      <PageHeader title="Fabric Production Entry" description="Operators create entries; the database generates serials, calculations, and fabric rolls." />
      <Card className="mb-5">
        <CardHeader><CardTitle>New Production Entry</CardTitle></CardHeader>
        <CardContent>
          <ProductionForm
            fabrics={((fabrics ?? []) as any[]).map((fabric) => ({ id: fabric.id, label: fabric.fabric_name }))}
            looms={((looms ?? []) as any[]).map((loom) => ({ id: loom.id, label: loom.loom_number }))}
            lastMeters={lastMeters}
            nextSerials={nextSerials}
            isAdmin={admin}
          />
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle>Today's Production Entries</CardTitle></CardHeader>
        <CardContent>
          {productionRows.length === 0 ? <EmptyState title="No entries today" description="New production entries will appear here immediately after saving." /> : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Fabric type</TableHead>
                    <TableHead>S. No</TableHead>
                    <TableHead>Gross Weight</TableHead>
                    <TableHead>Core Weight</TableHead>
                    <TableHead>Net Weight</TableHead>
                    <TableHead>Net Mtrs</TableHead>
                    <TableHead>Avg Mtr Weight</TableHead>
                    <TableHead>Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {productionRows.map((row, index) => (
                    <TableRow key={row.id} className={index === 0 ? "bg-emerald-50 font-semibold" : "bg-emerald-50/40"}>
                      <TableCell>{row.fabric_types?.fabric_name}</TableCell>
                      <TableCell className="text-lg font-bold text-emerald-900">{row.serial_number}</TableCell>
                      <TableCell>{formatNumber(row.gross_weight, 2)}</TableCell>
                      <TableCell>{formatNumber(row.core_weight, 2)}</TableCell>
                      <TableCell>{formatNumber(row.net_weight, 2)}</TableCell>
                      <TableCell>{formatNumber(Math.floor(row.net_meters), 0)}</TableCell>
                      <TableCell>{row.average_meter_weight == null ? "-" : formatNumber(Math.floor(Number(row.average_meter_weight)), 0)}</TableCell>
                      <TableCell className="min-w-[200px]">
                        <div className="flex flex-col gap-2">
                          <ProductionEditDialog
                            row={row}
                            fabrics={((fabrics ?? []) as any[]).map((fabric) => ({ id: fabric.id, label: fabric.fabric_name }))}
                            looms={((looms ?? []) as any[]).map((loom) => ({ id: loom.id, label: loom.loom_number }))}
                            lastMeters={lastMeters}
                            nextSerials={nextSerials}
                            isAdmin={admin}
                          />
                          <form action={softDeleteProduction}>
                            <input type="hidden" name="id" value={row.id} />
                            <ConfirmSubmitButton variant="outline" size="sm" confirmTitle="Delete production entry?" confirmDescription="This will delete the production entry and update related views.">Delete</ConfirmSubmitButton>
                          </form>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
    </>
  );
}
