import { StageProductionForm } from "@/components/app/stage-production-form";
import { ConfirmSubmitButton } from "@/components/app/confirm-submit-button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { PageHeader } from "@/components/app/page-header";
import { softDeleteStageProduction } from "@/app/(app)/_actions";
import { requirePermission } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { formatDate } from "@/lib/utils";

export default async function RotoPrintingProductionPage() {
  await requirePermission("roto_printing.production");
  const supabase = await createClient();

  const [
    { data: activeRolls },
    { data: rotoProducts },
    { data: rotoColors },
    { data: stageEntries },
  ] = await Promise.all([
    supabase
      .from("fabric_rolls")
      .select("id, roll_number")
      .eq("status", "available")
      .eq("current_stage", "loom")
      .is("deleted_at", null)
      .order("roll_number"),
    supabase
      .from("roto_products")
      .select("id, brand, width, height")
      .eq("status", "active")
      .order("brand"),
    supabase
      .from("roto_colors")
      .select("id, color_name")
      .eq("status", "active")
      .order("color_name"),
    supabase
      .from("stage_production_entries")
      .select("*, fabric_rolls(roll_number)")
      .eq("stage", "roto_printing")
      .is("deleted_at", null)
      .order("entry_date", { ascending: false })
      .order("created_at", { ascending: false })
      .limit(50),
  ]);

  const rolls = (activeRolls ?? []) as any[];
  const products = ((rotoProducts ?? []) as any[]).map((p) => ({
    id: p.id,
    label: `${p.brand} (${p.width}x${p.height} in)`,
  }));
  const colors = (rotoColors ?? []) as any[];
  const colorMap = new Map(colors.map((c) => [c.id, c.color_name]));
  const productMap = new Map(((rotoProducts ?? []) as any[]).map((p) => [p.id, `${p.brand} (${p.width}x${p.height} in)`]));
  const rows = (stageEntries ?? []) as any[];

  return (
    <>
      <PageHeader
        title="Roto Printing Production Entry"
        description="Select Loom fabric rolls and record their Roto Printing brand, colors, and cylinder configurations."
      />

      <Card className="mb-5">
        <CardHeader>
          <CardTitle>Log Roto Production</CardTitle>
        </CardHeader>
        <CardContent>
          <StageProductionForm
            stage="roto_printing"
            rolls={rolls}
            rotoProducts={products}
            rotoColors={colors}
          />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Recent Roto Production Entries</CardTitle>
        </CardHeader>
        <CardContent>
          {rows.length === 0 ? (
            <EmptyState title="No entries found" description="Logged Roto production entries will appear here." />
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Date</TableHead>
                    <TableHead>Roll Number</TableHead>
                    <TableHead>Roto Product</TableHead>
                    <TableHead>Color</TableHead>
                    <TableHead className="text-right">Cylinders</TableHead>
                    <TableHead>Remarks</TableHead>
                    <TableHead>Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {rows.map((row) => (
                    <TableRow key={row.id}>
                      <TableCell>{formatDate(row.entry_date)}</TableCell>
                      <TableCell className="font-bold text-emerald-950">
                        {row.fabric_rolls?.roll_number ?? "-"}
                      </TableCell>
                      <TableCell>{productMap.get(row.product_id) ?? "-"}</TableCell>
                      <TableCell>{colorMap.get(row.details?.color_id) ?? "-"}</TableCell>
                      <TableCell className="text-right">{row.details?.cylinders ?? "-"}</TableCell>
                      <TableCell>{row.remarks ?? "-"}</TableCell>
                      <TableCell>
                        <form action={softDeleteStageProduction}>
                          <input type="hidden" name="id" value={row.id} />
                          <ConfirmSubmitButton
                            size="sm"
                            variant="outline"
                            confirmTitle="Delete production entry?"
                            confirmDescription="This will revert the roll stage back to loom."
                          >
                            Delete
                          </ConfirmSubmitButton>
                        </form>
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
