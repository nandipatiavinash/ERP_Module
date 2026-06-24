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

export default async function OffsetPrintingProductionPage() {
  await requirePermission("offset_printing.production");
  const supabase = await createClient();

  const [
    { data: activeRolls },
    { data: offsetProducts },
    { data: stageEntries },
  ] = await Promise.all([
    supabase
      .from("fabric_rolls")
      .select("id, roll_number")
      .eq("status", "available")
      .eq("current_stage", "lamination")
      .is("deleted_at", null)
      .order("roll_number"),
    supabase
      .from("offset_products")
      .select("id, brand, width, height")
      .eq("status", "active")
      .order("brand"),
    supabase
      .from("stage_production_entries")
      .select("*, fabric_rolls(roll_number)")
      .eq("stage", "offset_printing")
      .is("deleted_at", null)
      .order("entry_date", { ascending: false })
      .order("created_at", { ascending: false })
      .limit(50),
  ]);

  const rolls = (activeRolls ?? []) as any[];
  const products = (offsetProducts ?? []).map((p: any) => ({
    id: p.id,
    label: `${p.brand} (${p.width}x${p.height} in)`,
  }));
  const productMap = new Map((offsetProducts ?? []).map((p: any) => [p.id, `${p.brand} (${p.width}x${p.height} in)`]));
  const rows = (stageEntries ?? []) as any[];

  return (
    <>
      <PageHeader
        title="Offset Printing Production Entry"
        description="Select Laminated fabric rolls and record their Offset Printing product details."
      />

      <Card className="mb-5">
        <CardHeader>
          <CardTitle>Log Offset Production</CardTitle>
        </CardHeader>
        <CardContent>
          <StageProductionForm
            stage="offset_printing"
            rolls={rolls}
            offsetProducts={products}
          />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Recent Offset Production Entries</CardTitle>
        </CardHeader>
        <CardContent>
          {rows.length === 0 ? (
            <EmptyState title="No entries found" description="Logged Offset production entries will appear here." />
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Date</TableHead>
                    <TableHead>Roll Number</TableHead>
                    <TableHead>Offset Product</TableHead>
                    <TableHead>Remarks</TableHead>
                    <TableHead>Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {rows.map((row: any) => (
                    <TableRow key={row.id}>
                      <TableCell>{formatDate(row.entry_date)}</TableCell>
                      <TableCell className="font-bold text-emerald-950">
                        {row.fabric_rolls?.roll_number ?? "-"}
                      </TableCell>
                      <TableCell>{productMap.get(row.product_id) ?? "-"}</TableCell>
                      <TableCell>{row.remarks ?? "-"}</TableCell>
                      <TableCell>
                        <form action={softDeleteStageProduction}>
                          <input type="hidden" name="id" value={row.id} />
                          <ConfirmSubmitButton
                            size="sm"
                            variant="outline"
                            confirmTitle="Delete production entry?"
                            confirmDescription="This will revert the roll stage back to Lamination."
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
