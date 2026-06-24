import Link from "next/link";
import { PageHeader } from "@/components/app/page-header";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { requirePermission } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { formatNumber } from "@/lib/utils";

export default async function RollsPage() {
  await requirePermission("rolls.view");
  const supabase = await createClient();

  const { data: stock } = await supabase
    .from("fabric_rolls")
    .select("fabric_type_id, weight, meters, status, fabric_types(fabric_name)")
    .eq("status", "available")
    .is("deleted_at", null);

  const stockRows = Object.values(((stock ?? []) as any[]).reduce<Record<string, any>>((acc, roll) => {
    const key = roll.fabric_type_id;
    acc[key] ??= { fabric_type_id: key, fabric_name: roll.fabric_types?.fabric_name, rolls: 0, weight: 0, meters: 0 };
    acc[key].rolls += 1;
    acc[key].weight += Number(roll.weight ?? 0);
    acc[key].meters += Number(roll.meters ?? 0);
    return acc;
  }, {})).sort((a: any, b: any) => String(a.fabric_name).localeCompare(String(b.fabric_name)));

  const totalRolls = stockRows.reduce((sum: number, r: any) => sum + r.rolls, 0);
  const totalWeight = stockRows.reduce((sum: number, r: any) => sum + r.weight, 0);
  const totalMeters = stockRows.reduce((sum: number, r: any) => sum + r.meters, 0);

  return (
    <>
      <PageHeader title="Fabric Stock Inventory" description="Fabric stock grouped by type, with roll-level drill-down." />
      <Card>
        <CardHeader>
          <CardTitle>Available Stock Summary</CardTitle>
        </CardHeader>
        <CardContent>
          {stockRows.length === 0 ? (
            <div className="text-center py-6 text-muted-foreground">No available fabric stock found.</div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Fabric Type</TableHead>
                    <TableHead className="text-right">Rolls Count</TableHead>
                    <TableHead className="text-right">Total Weight</TableHead>
                    <TableHead className="text-right">Total Meters</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {stockRows.map((row) => (
                    <TableRow key={row.fabric_type_id}>
                      <TableCell className="font-semibold text-base">
                        <Link href={`/rolls/${row.fabric_type_id}` as any} prefetch={false} className="text-primary hover:underline">
                          {row.fabric_name}
                        </Link>
                      </TableCell>
                      <TableCell className="text-right text-base font-medium">{row.rolls}</TableCell>
                      <TableCell className="text-right text-base font-medium">{formatNumber(row.weight, 2)}</TableCell>
                      <TableCell className="text-right text-base font-medium">{formatNumber(Math.floor(row.meters), 0)}</TableCell>
                    </TableRow>
                  ))}
                  <TableRow className="bg-muted/50 font-bold border-t-2">
                    <TableCell className="text-base font-bold">Total</TableCell>
                    <TableCell className="text-right text-base font-bold">{totalRolls}</TableCell>
                    <TableCell className="text-right text-base font-bold">{formatNumber(totalWeight, 2)}</TableCell>
                    <TableCell className="text-right text-base font-bold">{formatNumber(Math.floor(totalMeters), 0)}</TableCell>
                  </TableRow>
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
    </>
  );
}
