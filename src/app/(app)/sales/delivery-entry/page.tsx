import { DeliveryEntryForm } from "@/components/app/delivery-entry-form";
import { DeleteOrderButton } from "@/components/app/delete-order-button";
import { PageHeader } from "@/components/app/page-header";
import { StatusBadge } from "@/components/app/status-badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { requirePermission } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { formatDate, formatNumber, todayInIndia } from "@/lib/utils";
import { DateFilter } from "@/components/app/date-filter";

export default async function DeliveryEntryPage({
  searchParams,
}: {
  searchParams: Promise<{ date?: string }>;
}) {
  await requirePermission("sales.order_confirmation");
  const supabase = await createClient();
  const params = await searchParams;
  const date = params.date || todayInIndia();

  const [{ data: customers }, { data: fabrics }, { data: roto }, { data: offset }, { data: orders }] = await Promise.all([
    supabase.from("customers").select("id, customer_name, alias").eq("status", "active").eq("is_internal", "client a/c").is("deleted_at", null).order("customer_name"),
    supabase.from("fabric_types").select("id, fabric_name").eq("status", "active").is("deleted_at", null).order("fabric_name"),
    supabase.from("roto_products").select("id, brand, width, height").eq("status", "active").order("brand"),
    supabase.from("offset_products").select("id, brand, width, height").eq("status", "active").order("brand"),
    supabase
      .from("sales_orders")
      .select("*, customers(customer_name, alias), sales_order_items(id, department, quantity)")
      .or(`order_date.eq.${date},status.eq.draft`)
      .is("deleted_at", null)
      .order("order_date", { ascending: true })
      .order("order_number", { ascending: true })
      .limit(100),
  ]);

  const customerRows = ((customers ?? []) as any[])
    .filter((c) => !c.customer_name.endsWith(" A/c"))
    .map((c) => ({ id: c.id, name: c.customer_name, alias: c.alias }));
  const fabricOptions = ((fabrics ?? []) as any[]).map((f) => ({ id: f.id, label: f.fabric_name }));
  const rotoOptions = ((roto ?? []) as any[]).map((r) => ({ id: r.id, label: `${r.brand} (${r.width}x${r.height} in)` }));
  const offsetOptions = ((offset ?? []) as any[]).map((o) => ({ id: o.id, label: `${o.brand} (${o.width}x${o.height} in)` }));
  const orderRows = (orders ?? []) as any[];

  return (
    <>
      <PageHeader title="Order Confirmation" description="Create multi-item orders across production departments." />
      
      <Card className="mb-6">
        <CardHeader>
          <CardTitle>Place New Sales Order</CardTitle>
        </CardHeader>
        <CardContent>
          <DeliveryEntryForm
            customers={customerRows}
            fabricProducts={fabricOptions}
            rotoProducts={rotoOptions}
            offsetProducts={offsetOptions}
          />
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-4">
          <CardTitle>Recent Orders</CardTitle>
          <DateFilter date={date} baseUrl="/sales/delivery-entry" />
        </CardHeader>
        <CardContent>
          {orderRows.length === 0 ? (
            <EmptyState />
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Order Number</TableHead>
                    <TableHead>Firm Name</TableHead>
                    <TableHead>Items Count</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="w-12 text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {orderRows.map((order) => (
                    <TableRow key={order.id}>
                      <TableCell className="font-bold text-emerald-950">{order.order_number}</TableCell>
                      <TableCell>
                        {order.customers?.customer_name} {order.customers?.alias ? `(${order.customers?.alias})` : ""}
                      </TableCell>
                      <TableCell>{order.sales_order_items?.length ?? 0} items</TableCell>
                      <TableCell>
                        <StatusBadge value={order.status} />
                      </TableCell>
                      <TableCell className="text-right">
                        <DeleteOrderButton orderId={order.id} />
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
