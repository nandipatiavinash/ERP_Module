import { PurchaseForm } from "@/components/app/purchase-form";
import { PageHeader } from "@/components/app/page-header";
import { EmptyState } from "@/components/ui/empty-state";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { requirePermission } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { formatDate, formatNumber, todayInIndia } from "@/lib/utils";
import { DateFilter } from "@/components/app/date-filter";

function getEnteredBillValue(remarks: string | null, fallback: string | number) {
  const match = remarks?.match(/\[TOTAL_BILL_VALUE:([0-9]+(?:\.[0-9]+)?)\]/);
  return match ? Number(match[1]) : Number(fallback);
}

export default async function PurchaseEntryPage({
  searchParams,
}: {
  searchParams: Promise<{ date?: string }>;
}) {
  await requirePermission("accounts.purchase"); // Matches navGroups permission for this page
  const supabase = await createClient();
  const params = await searchParams;
  const date = params.date || todayInIndia();

  const [{ data: materials }, { data: customers }, { data: purchases }] = await Promise.all([
    supabase
      .from("raw_materials")
      .select("id, material_name, unit, status")
      .eq("status", "active")
      .is("deleted_at", null)
      .order("material_name", { ascending: true }),
    supabase
      .from("customers")
      .select("id, customer_name, alias")
      .eq("status", "active")
      .eq("is_internal", "client a/c")
      .is("deleted_at", null)
      .order("customer_name"),
    supabase
      .from("raw_material_purchases")
      .select("id, purchase_date, supplier_name, bill_number, quantity, rate, total_amount, remarks, raw_materials(material_name, unit)")
      .eq("purchase_date", date)
      .is("deleted_at", null)
      .order("created_at", { ascending: false }),
  ]);

  const activeMaterials = (materials ?? []).filter((m: any) => m.status === "active");
  const customerList = ((customers ?? []) as any[]).filter((c) => !c.customer_name.endsWith(" A/c"));
  const purchaseRows = (purchases ?? []) as any[];

  return (
    <div className="space-y-6">
      <PageHeader
        title="Purchase Entry"
        description="Accounting purchase entry and ledger updates."
      />

      <Card className="mb-5">
        <CardHeader>
          <CardTitle>New Purchase</CardTitle>
        </CardHeader>
        <CardContent>
          <PurchaseForm
            materials={activeMaterials}
            customers={customerList}
          />
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-4">
          <CardTitle>Recent Purchases</CardTitle>
          <DateFilter date={date} baseUrl="/accounts/purchase" />
        </CardHeader>
        <CardContent>
          {purchaseRows.length === 0 ? (
            <EmptyState />
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Date</TableHead>
                    <TableHead>Material</TableHead>
                    <TableHead>Client</TableHead>
                    <TableHead>Bill</TableHead>
                    <TableHead>Qty</TableHead>
                    <TableHead>Rate</TableHead>
                    <TableHead>Total</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {purchaseRows.map((purchase) => (
                    <TableRow key={purchase.id}>
                      <TableCell>{formatDate(purchase.purchase_date)}</TableCell>
                      <TableCell>
                        {purchase.raw_materials?.material_name ?? "-"}
                      </TableCell>
                      <TableCell>{purchase.supplier_name ?? "-"}</TableCell>
                      <TableCell>{purchase.bill_number ?? "-"}</TableCell>
                      <TableCell>
                        {formatNumber(purchase.quantity, 0)} {purchase.raw_materials?.unit ?? ""}
                      </TableCell>
                      <TableCell>{"\u20b9"}{formatNumber(purchase.rate, 2)}</TableCell>
                      <TableCell>{"\u20b9"}{formatNumber(getEnteredBillValue(purchase.remarks, purchase.total_amount), 2)}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

