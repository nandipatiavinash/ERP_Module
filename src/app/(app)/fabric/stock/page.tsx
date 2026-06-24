import Link from "next/link";
import { Button } from "@/components/ui/button";
import { PageHeader } from "@/components/app/page-header";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { requirePermission } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { formatNumber } from "@/lib/utils";

export default async function FabricStockPage() {
  await requirePermission("fabric.stock");
  const supabase = await createClient();

  const { data: stock } = await (supabase as any).rpc("get_fabric_stock_summary");

  const stockRows = ((stock ?? []) as any[]).map((row) => ({
    ...row,
    rolls: Number(row.rolls ?? 0),
    weight: Number(row.weight ?? 0),
    meters: Number(row.meters ?? 0),
  }));

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
                        <Link href={`/fabric/stock/${row.fabric_type_id}` as any} prefetch={false} className="text-primary hover:underline">
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
