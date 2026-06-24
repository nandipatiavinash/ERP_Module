import { updateCriticalLevel } from "@/app/(app)/_actions";
import { ConfirmSubmitButton } from "@/components/app/confirm-submit-button";
import { PageHeader } from "@/components/app/page-header";
import { StatusBadge } from "@/components/app/status-badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { requirePermission } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { formatNumber } from "@/lib/utils";

const departmentLabels: Record<string, string> = {
  fabric: "Fabric",
  "roto-printing": "Roto Printing",
  lamination: "Lamination",
  "offset-printing": "Off-set Printing",
  finishing: "Finishing",
};

export default async function CriticalLevelsPage() {
  await requirePermission("admin.critical_levels");
  const supabase = await createClient();
  
  const { data, error } = await supabase
    .from("raw_materials")
    .select("id, material_name, unit, department, critical_level, current_stock, status")
    .is("deleted_at", null)
    .order("department", { ascending: true })
    .order("material_name", { ascending: true });

  if (error) {
    console.error("Critical Levels Database Error:", error);
    return (
      <div className="p-6 max-w-lg mx-auto bg-red-50 border border-red-200 rounded-lg text-red-800 space-y-3 mt-10 shadow-sm">
        <h3 className="text-lg font-bold">Database Error</h3>
        <p className="text-sm">
          Failed to fetch raw materials. This typically indicates that your production database schema is out of sync or migrations (specifically `011_custom_legacy_schema.sql`) have not been pushed to production.
        </p>
        <div className="text-xs bg-red-100 p-4 rounded-md border font-mono overflow-x-auto">
          Error Message: {error.message}
        </div>
        <p className="text-xs text-muted-foreground">
          Please run `npx supabase db push` or apply the migrations to your remote Supabase instance.
        </p>
      </div>
    );
  }

  const materials = (data ?? []) as any[];

  // Group materials by department
  const grouped = materials.reduce<Record<string, any[]>>((acc, material) => {
    const dept = (material.department || "fabric").toLowerCase();
    acc[dept] ??= [];
    acc[dept].push(material);
    return acc;
  }, {});

  return (
    <>
      <PageHeader title="Raw Material Critical Levels" description="Configure inventory warning thresholds per production department." />
      
      {materials.length === 0 ? (
        <EmptyState title="No Raw Materials" description="Add raw materials under Raw Material ID's before setting critical levels." />
      ) : (
        <div className="space-y-6">
          {Object.entries(departmentLabels).map(([deptKey, deptLabel]) => {
            const deptMaterials = grouped[deptKey] ?? [];
            if (deptMaterials.length === 0) return null;

            return (
              <Card key={deptKey}>
                <CardHeader>
                  <CardTitle className="uppercase tracking-wider text-sm font-bold text-primary">
                    {deptLabel} Department
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="overflow-x-auto">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Raw Material ID</TableHead>
                          <TableHead>Unit</TableHead>
                          <TableHead>Current Stock</TableHead>
                          <TableHead>Critical Level</TableHead>
                          <TableHead>Status</TableHead>
                          <TableHead className="w-80">Update Critical Level</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {deptMaterials.map((material) => {
                          const currentStockVal = Number(material.current_stock ?? 0);
                          const criticalLevelVal = Number(material.critical_level ?? 0);
                          const isLowStock = currentStockVal <= criticalLevelVal;
                          return (
                            <TableRow key={material.id}>
                              <TableCell className="font-semibold">{material.material_name}</TableCell>
                              <TableCell>{material.unit}</TableCell>
                              <TableCell>{formatNumber(material.current_stock, 2)}</TableCell>
                              <TableCell>{formatNumber(material.critical_level ?? 0, 2)}</TableCell>
                              <TableCell>
                                {isLowStock ? (
                                  <span className="inline-flex items-center rounded-full bg-red-100 px-2.5 py-0.5 text-xs font-semibold text-red-800 dark:bg-red-900/30 dark:text-red-400">
                                    LOW STOCK
                                  </span>
                                ) : (
                                  <span className="inline-flex items-center rounded-full bg-green-100 px-2.5 py-0.5 text-xs font-semibold text-green-800 dark:bg-green-900/30 dark:text-green-400">
                                    OK
                                  </span>
                                )}
                              </TableCell>
                              <TableCell>
                                <form action={updateCriticalLevel} className="flex gap-2">
                                  <input type="hidden" name="material_id" value={material.id} />
                                  <Input
                                    name="critical_level"
                                    type="number"
                                    step="0.01"
                                    defaultValue={material.critical_level ?? 0}
                                    className="h-9 w-32"
                                    required
                                  />
                                  <ConfirmSubmitButton
                                    size="sm"
                                    variant="outline"
                                    confirmTitle="Update Stock Warning Threshold?"
                                    confirmDescription={`Set the critical level threshold of ${material.material_name} to this value?`}
                                  >
                                    Update
                                  </ConfirmSubmitButton>
                                </form>
                              </TableCell>
                            </TableRow>
                          );
                        })}
                      </TableBody>
                    </Table>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </>
  );
}
