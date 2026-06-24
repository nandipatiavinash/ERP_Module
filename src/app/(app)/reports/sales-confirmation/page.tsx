import { requirePermission } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { todayInIndia } from "@/lib/utils";
import { DateFilter } from "@/components/app/date-filter";
import { PageHeader } from "@/components/app/page-header";
import { SalesConfirmationReportClient } from "./SalesConfirmationReportClient";

export default async function SalesConfirmationReportPage({
  searchParams,
}: {
  searchParams: Promise<{ date?: string }>;
}) {
  await requirePermission("reports.sales_confirmation");
  const supabase = await createClient();
  const params = await searchParams;
  const date = params.date || todayInIndia();

  // Fetch billed sales orders for this date
  const { data: orders } = await supabase
    .from("sales_orders")
    .select("*, customers(*), sales_order_items(*)")
    .eq("status", "confirmed")
    .eq("order_date", date)
    .not("bill_number", "is", null)
    .is("deleted_at", null)
    .order("order_number", { ascending: true });

  const billedOrders = (orders ?? []) as any[];

  // Fetch the 20 most recent confirmed orders with a bill number (any date, sorted by date/created_at descending)
  const { data: recentOrders } = await supabase
    .from("sales_orders")
    .select("*, customers(*), sales_order_items(*)")
    .eq("status", "confirmed")
    .not("bill_number", "is", null)
    .is("deleted_at", null)
    .order("order_date", { ascending: false })
    .order("created_at", { ascending: false })
    .limit(20);

  const billedRecentOrders = (recentOrders ?? []) as any[];

  // Fetch product definitions for resolving names
  const [{ data: fabrics }, { data: roto }, { data: offset }] = await Promise.all([
    supabase.from("fabric_types").select("id, fabric_name, selling_price"),
    supabase.from("roto_products").select("id, brand, width, height"),
    supabase.from("offset_products").select("id, brand, width, height"),
  ]);

  // Extract selected roll IDs
  const allRollIds: string[] = [];
  const combinedOrders = [...billedOrders, ...billedRecentOrders];
  combinedOrders.forEach((order) => {
    order.sales_order_items?.forEach((item: any) => {
      if (item.selected_roll_ids) {
        allRollIds.push(...item.selected_roll_ids);
      }
    });
  });
  const uniqueRollIds = Array.from(new Set(allRollIds));

  // Fetch rolls
  let rolls: any[] = [];
  if (uniqueRollIds.length > 0) {
    const { data: rollData } = await supabase
      .from("fabric_rolls")
      .select("id, weight")
      .in("id", uniqueRollIds)
      .is("deleted_at", null);
    rolls = rollData || [];
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Sales Confirmation Report"
        description="Verify calculations, GST, rates, and outstanding balances for billed sales."
      />

      <div className="flex flex-col gap-4">
        <div className="flex justify-end">
          <DateFilter date={date} baseUrl="/reports/sales-confirmation" />
        </div>

        <SalesConfirmationReportClient
          orders={billedOrders}
          recentOrders={billedRecentOrders}
          fabrics={fabrics || []}
          rotoProducts={roto || []}
          offsetProducts={offset || []}
          rolls={rolls}
        />
      </div>
    </div>
  );
}

