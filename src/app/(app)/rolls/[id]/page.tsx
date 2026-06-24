import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { PageHeader } from "@/components/app/page-header";
import { StatusBadge } from "@/components/app/status-badge";
import { requirePermission } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { formatDate, formatNumber } from "@/lib/utils";
import { Button } from "@/components/ui/button";

export default async function FabricTypeRollsPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  await requirePermission("rolls.view");
  const { id } = await params;
  const supabase = await createClient();

  const [{ data: fabricData, error: fabricError }, { data: rolls, error: rollsError }, { data: allocations, error: allocationsError }] = await Promise.all([
    supabase.from("fabric_types").select("fabric_name").eq("id", id).single(),
    supabase
      .from("fabric_rolls")
      .select("*, fabric_types(fabric_name), looms(loom_number), loom_production_entries(gross_weight, core_weight, net_weight, net_meters, average_meter_weight)")
      .eq("fabric_type_id", id)
      .is("deleted_at", null)
      .order("roll_number", { ascending: true }),
    (supabase as any).rpc("get_roll_allocations_for_fabric", { p_fabric_type_id: id }),
  ]);

  if (fabricError || rollsError || allocationsError) {
    throw new Error("Unable to load roll details right now.");
  }

  const rollAllocationMap: Record<string, { dispatchDate: string; clientName: string }> = {};
  for (const allocation of (allocations ?? []) as any[]) {
    rollAllocationMap[allocation.roll_id] = {
      dispatchDate: allocation.dispatch_date,
      clientName: allocation.client_name ?? "Unknown",
    };
  }

  const fabric = fabricData as { fabric_name: string } | null;
  const fabricName = fabric?.fabric_name ?? "Fabric";

  const sortedRolls = ((rolls ?? []) as any[]).sort((a, b) => {
    const dateA = new Date(a.production_date || 0).getTime();
    const dateB = new Date(b.production_date || 0).getTime();
    if (dateA !== dateB) return dateA - dateB;
    return (a.roll_number || "").localeCompare(b.roll_number || "", undefined, { numeric: true });
  });

  return (
    <>
      <div className="mb-4">
        <Link href="/rolls" passHref>
          <Button variant="ghost" className="gap-2 text-muted-foreground hover:text-foreground">
            <ArrowLeft className="h-4 w-4" /> Back to Inventory
          </Button>
        </Link>
      </div>

      <PageHeader
        title={`Rolls - ${fabricName}`}
        description={`Detailed view of fabric rolls registered under type ${fabricName}.`}
      />

      <Card>
        <CardHeader>
          <CardTitle>Fabric Rolls ({sortedRolls.length})</CardTitle>
        </CardHeader>
        <CardContent>
          {sortedRolls.length === 0 ? (
            <EmptyState
              title="No records found"
              description={`There are currently no active rolls for ${fabricName}.`}
            />
          ) : (
             <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>S.No</TableHead>
                    <TableHead className="text-right">Net W8</TableHead>
                    <TableHead className="text-right">Core W8</TableHead>
                    <TableHead className="text-right">Gross W8</TableHead>
                    <TableHead className="text-right">Mtrs</TableHead>
                    <TableHead className="text-right">Avg Mtrs</TableHead>
                    <TableHead>Loom</TableHead>
                    <TableHead>Prod Date</TableHead>
                    <TableHead>Dispatch Date</TableHead>
                    <TableHead>Client Name</TableHead>
                    <TableHead>Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {sortedRolls.map((roll) => {
                    const lpe = roll.loom_production_entries;
                    const allocation = rollAllocationMap[roll.id];
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
                        <TableCell className="whitespace-nowrap">{allocation ? formatDate(allocation.dispatchDate) : "-"}</TableCell>
                        <TableCell className="font-medium">{allocation ? allocation.clientName : "-"}</TableCell>
                        <TableCell>
                          <StatusBadge value={roll.status} />
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
    </>
  );
}
