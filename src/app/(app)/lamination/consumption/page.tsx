import { ConsumptionForm } from "@/components/app/consumption-form";
import { ConfirmSubmitButton } from "@/components/app/confirm-submit-button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { PageHeader } from "@/components/app/page-header";
import { DateFilter } from "@/components/app/date-filter";
import { softDeleteRawMaterialConsumption } from "@/app/(app)/_actions";
import { requirePermission } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { formatDate, formatNumber, todayInIndia } from "@/lib/utils";

export default async function LaminationConsumptionPage({
  searchParams,
}: {
  searchParams: Promise<{ date?: string }>;
}) {
  await requirePermission("lamination.consumption");
  const supabase = await createClient();
  const params = await searchParams;
  const date = params.date || todayInIndia();
  const isToday = date === todayInIndia();

  const [{ data: rawMaterials }, { data: consumptions }] = await Promise.all([
    supabase
      .from("raw_materials")
      .select("id, material_name, unit, status, current_stock")
      .eq("department", "lamination")
      .eq("status", "active")
      .is("deleted_at", null)
      .order("material_name"),
    supabase
      .from("raw_material_consumptions")
      .select("*, raw_materials(material_name, unit)")
      .eq("department", "lamination")
      .eq("consumption_date", date)
      .is("deleted_at", null)
      .order("created_at", { ascending: false }),
  ]);

  const materials = (rawMaterials ?? []) as any[];
  const rows = (consumptions ?? []) as any[];

  return (
    <>
      <PageHeader
        title="Lamination Raw Material Consumption"
        description="Log and monitor the consumption of raw materials (lamination film, adhesives, solvents) in the Lamination process."
      />

      <div className="flex justify-end mb-4">
        <DateFilter date={date} baseUrl="/lamination/consumption" />
      </div>

      {isToday ? (
        <Card className="mb-5">
          <CardHeader>
            <CardTitle>Log Consumption</CardTitle>
          </CardHeader>
          <CardContent>
            <ConsumptionForm department="lamination" materials={materials} />
          </CardContent>
        </Card>
      ) : (
        <div className="mb-5 bg-amber-50 border border-amber-200 text-amber-800 rounded-lg p-4 text-sm font-medium">
          Viewing historical records. Logging and deleting are only allowed on the current day.
        </div>
      )}

      <Card>
        <CardHeader>
          <CardTitle>Consumptions for {formatDate(date)}</CardTitle>
        </CardHeader>
        <CardContent>
          {rows.length === 0 ? (
            <EmptyState title="No logs found" description="New consumption logs will show up here after being saved." />
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Date</TableHead>
                    <TableHead>Material</TableHead>
                    <TableHead className="text-right">Quantity</TableHead>
                    <TableHead>Remarks</TableHead>
                    {isToday && <TableHead>Actions</TableHead>}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {rows.map((row: any) => (
                    <TableRow key={row.id}>
                      <TableCell>{formatDate(row.consumption_date)}</TableCell>
                      <TableCell>{row.raw_materials?.material_name ?? "-"}</TableCell>
                      <TableCell className="text-right">
                        {formatNumber(row.quantity, 2)} {row.raw_materials?.unit ?? ""}
                      </TableCell>
                      <TableCell>{row.remarks ?? "-"}</TableCell>
                      {isToday && (
                        <TableCell>
                          <form action={softDeleteRawMaterialConsumption}>
                            <input type="hidden" name="id" value={row.id} />
                            <ConfirmSubmitButton
                              size="sm"
                              variant="outline"
                              confirmTitle="Delete consumption log?"
                              confirmDescription="This will revert the stock update and remove the log entry."
                            >
                              Delete
                            </ConfirmSubmitButton>
                          </form>
                        </TableCell>
                      )}
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
