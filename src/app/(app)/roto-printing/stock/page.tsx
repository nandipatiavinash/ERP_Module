import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { PageHeader } from "@/components/app/page-header";
import { StatusBadge } from "@/components/app/status-badge";
import { requirePermission } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { formatDate, formatNumber } from "@/lib/utils";

export default async function RotoPrintingStockPage() {
  await requirePermission("roto_printing.stock");
  const supabase = await createClient();

  const { data: rolls } = await supabase
    .from("fabric_rolls")
    .select("*, fabric_types(fabric_name), looms(loom_number)")
    .eq("current_stage", "roto_printing")
    .eq("status", "available")
    .is("deleted_at", null)
    .order("roll_number");

  const stockRows = (rolls ?? []) as any[];

  return (
    <>
      <PageHeader
        title="Roto Printing Stock"
        description="View and manage fabric rolls that are currently in the Roto Printing stage."
      />

      <Card>
        <CardHeader>
          <CardTitle>Available Roto Printed Stock ({stockRows.length})</CardTitle>
        </CardHeader>
        <CardContent>
          {stockRows.length === 0 ? (
            <EmptyState title="No stock found" description="There are currently no active rolls in the Roto Printing stage." />
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Roll Number</TableHead>
                    <TableHead>Fabric Type</TableHead>
                    <TableHead>Loom</TableHead>
                    <TableHead className="text-right">Weight (kg)</TableHead>
                    <TableHead className="text-right">Meters</TableHead>
                    <TableHead>Production Date</TableHead>
                    <TableHead>Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {stockRows.map((roll) => (
                    <TableRow key={roll.id}>
                      <TableCell className="font-bold text-emerald-950">{roll.roll_number}</TableCell>
                      <TableCell>{roll.fabric_types?.fabric_name ?? "-"}</TableCell>
                      <TableCell>{roll.looms?.loom_number ?? "-"}</TableCell>
                      <TableCell className="text-right">{formatNumber(roll.weight, 2)}</TableCell>
                      <TableCell className="text-right">{formatNumber(roll.meters, 0)}</TableCell>
                      <TableCell>{formatDate(roll.production_date)}</TableCell>
                      <TableCell>
                        <StatusBadge value={roll.status} />
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
