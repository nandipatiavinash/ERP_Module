import { requirePermission } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { todayInIndia } from "@/lib/utils";
import { ClosingStockReportClient } from "./ClosingStockReportClient";

type Params = { date?: string };

export default async function ClosingStockReportPage({ searchParams }: { searchParams: Promise<Params> }) {
  await requirePermission("reports.closing_stock");
  const params = await searchParams;
  const date = params.date || todayInIndia();

  const supabase = await createClient();

  // Fetch raw materials, purchases, consumptions, and material sales
  const [
    { data: rawMaterials },
    { data: purchases },
    { data: consumptions },
    { data: materialSales },
    { data: fabricTypes },
    { data: rolls },
    { data: salesOrders },
  ] = await Promise.all([
    supabase
      .from("raw_materials")
      .select("id, material_name, unit, department, current_stock")
      .is("deleted_at", null)
      .order("material_name"),
    supabase
      .from("raw_material_purchases")
      .select("raw_material_id, purchase_date, quantity, rate, total_amount")
      .is("deleted_at", null)
      .order("purchase_date", { ascending: true }),
    (supabase.from("raw_material_consumptions") as any)
      .select("raw_material_id, consumption_date, quantity")
      .is("deleted_at", null)
      .order("consumption_date", { ascending: true }),
    (supabase.from("material_sales") as any)
      .select("raw_material_id, sale_date, quantity, type")
      .is("deleted_at", null)
      .order("sale_date", { ascending: true }),
    supabase
      .from("fabric_types")
      .select("id, fabric_name, selling_price")
      .order("fabric_name"),
    supabase
      .from("fabric_rolls")
      .select("id, roll_number, fabric_type_id, weight, meters, production_date, status, current_stage")
      .is("deleted_at", null)
      .order("roll_number"),
    supabase
      .from("sales_orders")
      .select("order_date, status, bill_number, sales_order_items(selected_roll_ids)")
      .is("deleted_at", null),
  ]);

  // Fetch existing closing stock submission for this date
  const { data: closingStockSetting } = await supabase
    .from("settings")
    .select("value")
    .eq("key", `closing_stock_${date}`)
    .maybeSingle();

  const submittedClosingStock = (closingStockSetting as any)?.value || null;

  return (
    <ClosingStockReportClient
      date={date}
      rawMaterials={(rawMaterials ?? []) as any[]}
      purchases={(purchases ?? []) as any[]}
      consumptions={(consumptions ?? []) as any[]}
      materialSales={(materialSales ?? []) as any[]}
      fabricTypes={(fabricTypes ?? []) as any[]}
      rolls={(rolls ?? []) as any[]}
      salesOrders={(salesOrders ?? []) as any[]}
      submittedStock={submittedClosingStock}
    />
  );
}

