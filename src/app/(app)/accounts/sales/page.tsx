import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { PageHeader } from "@/components/app/page-header";
import { requirePermission } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { formatDate, formatNumber, todayInIndia } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { SalesEntryClient } from "./SalesEntryClient";
import { DateFilter } from "@/components/app/date-filter";

export default async function AccountsSalesPage({
  searchParams,
}: {
  searchParams: Promise<{ date?: string }>;
}) {
  await requirePermission("accounts.sales");
  const supabase = await createClient();
  const params = await searchParams;
  const date = params.date || todayInIndia();

  // 1. Fetch pending orders, billed orders, and fabric types concurrently
  const [pendingRes, billedRes, fabricTypesRes] = await Promise.all([
    (supabase.from("sales_orders") as any)
      .select("id, order_number, order_date, customer_id, status, bill_number, bill_value, customers(customer_name, alias, phone, address, gst_number), sales_order_items(id, department, product_id, quantity, selected_roll_ids)")
      .eq("status", "confirmed")
      .is("bill_number", null)
      .is("deleted_at", null)
      .order("order_date", { ascending: false }),
    (supabase.from("sales_orders") as any)
      .select("id, order_number, order_date, bill_number, bill_value, customers(customer_name), sales_order_items(id, department, product_id, quantity, selected_roll_ids)")
      .eq("status", "confirmed")
      .eq("order_date", date)
      .not("bill_number", "is", null)
      .is("deleted_at", null)
      .order("order_date", { ascending: false })
      .limit(50),
    supabase
      .from("fabric_types")
      .select("id, fabric_name")
  ]);

  const pendingOrders = pendingRes.data;
  const billedOrders = billedRes.data;
  const fabricTypes = fabricTypesRes.data;

  // 2. Gather all roll IDs across pending + billed orders to fetch roll data
  const allOrders = [...((pendingOrders ?? []) as any[]), ...((billedOrders ?? []) as any[])];
  const allRollIds: string[] = [];
  for (const order of allOrders) {
    for (const item of ((order as any).sales_order_items ?? []) as any[]) {
      const ids = ((item.selected_roll_ids ?? []) as string[]);
      allRollIds.push(...ids);
    }
  }
  const uniqueRollIds = Array.from(new Set(allRollIds));

  // 3. Fetch roll details with production entries
  let rolls: any[] = [];
  if (uniqueRollIds.length > 0) {
    const { data: rollData } = await supabase
      .from("fabric_rolls")
      .select("id, roll_number, meters, weight, fabric_type_id, loom_production_entries(gross_weight, core_weight, net_weight, net_meters, average_meter_weight)")
      .in("id", uniqueRollIds)
      .is("deleted_at", null);
    rolls = (rollData ?? []) as any[];
  }

  return (
    <>
      <PageHeader
        title="Sales Entry"
        description="View confirmed deliveries, enter billing details, and generate journal entries."
      />

      <div className="flex flex-col gap-4">
        <div className="flex justify-end">
          <DateFilter date={date} baseUrl="/accounts/sales" />
        </div>

        <SalesEntryClient
          pendingOrders={(pendingOrders ?? []) as any[]}
          billedOrders={(billedOrders ?? []) as any[]}
          rolls={rolls}
          fabricTypes={(fabricTypes ?? []) as any[]}
        />
      </div>
    </>
  );
}
