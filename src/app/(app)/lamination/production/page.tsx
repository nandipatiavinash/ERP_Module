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

export default async function LaminationProductionPage() {
  await requirePermission("lamination.production");
  const supabase = await createClient();

  const [{ data: activeRolls }, { data: stageEntries }] = await Promise.all([
    supabase
      .from("fabric_rolls")
      .select("id, roll_number")
      .eq("status", "available")
      .eq("current_stage", "roto_printing")
      .is("deleted_at", null)
      .order("roll_number"),
    supabase
      .from("stage_production_entries")
      .select("*, fabric_rolls(roll_number)")
      .eq("stage", "lamination")
      .is("deleted_at", null)
      .order("entry_date", { ascending: false })
      .order("created_at", { ascending: false })
      .limit(50),
  ]);

  const rolls = (activeRolls ?? []) as any[];
  const rows = (stageEntries ?? []) as any[];
  const productMap: Record<string, string> = {
    "lam-film-25": "Laminated Film 2.5 mil",
    "lam-film-30": "Laminated Film 3.0 mil",
  };

  return (
    <>
      <PageHeader
        title="Lamination Production Entry"
        description="Select Roto Printed rolls and record their lamination film and adhesive details."
      />

      <Card className="mb-5">
        <CardHeader>
          <CardTitle>Log Lamination Production</CardTitle>
        </CardHeader>
        <CardContent>
          <StageProductionForm stage="lamination" rolls={rolls} />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Recent Lamination Production Entries</CardTitle>
        </CardHeader>
        <CardContent>
          {rows.length === 0 ? (
            <EmptyState title="No entries found" description="Logged lamination entries will appear here." />
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Date</TableHead>
                    <TableHead>Roll Number</TableHead>
                    <TableHead>Film Product</TableHead>
                    <TableHead>Adhesive Details</TableHead>
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
                      <TableCell>{productMap[row.product_id] ?? row.product_id ?? "-"}</TableCell>
                      <TableCell>{row.details?.adhesive ?? "-"}</TableCell>
                      <TableCell>{row.remarks ?? "-"}</TableCell>
                      <TableCell>
                        <form action={softDeleteStageProduction}>
                          <input type="hidden" name="id" value={row.id} />
                          <ConfirmSubmitButton
                            size="sm"
                            variant="outline"
                            confirmTitle="Delete production entry?"
                            confirmDescription="This will revert the roll stage back to Roto Printing."
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
