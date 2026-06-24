import { requirePermission } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { todayInIndia } from "@/lib/utils";
import { StockReportClient } from "./StockReportClient";

type Params = { from?: string; to?: string };

export default async function StockReportPage({ searchParams }: { searchParams: Promise<Params> }) {
  await requirePermission("reports.stock");
  const params = await searchParams;
  const from = params.from || todayInIndia();
  const to = params.to || todayInIndia();

  const supabase = await createClient();

  const [
    { data: rawMaterials },
    { data: purchases },
    { data: consumptions },
    { data: sales },
    { data: fabricTypes },
    { data: rolls },
    { data: salesOrders },
    { data: materialSales },
  ] = await Promise.all([
    supabase
      .from("raw_materials")
      .select("id, material_name, unit, current_stock, department")
      .is("deleted_at", null)
      .order("material_name"),
    supabase
      .from("raw_material_purchases")
      .select("raw_material_id, purchase_date, quantity")
      .gte("purchase_date", from)
      .is("deleted_at", null),
    (supabase.from("raw_material_consumptions") as any)
      .select("raw_material_id, consumption_date, quantity")
      .gte("consumption_date", from)
      .is("deleted_at", null),
    (supabase.from("material_sales") as any)
      .select("raw_material_id, sale_date, quantity")
      .eq("type", "raw_material")
      .gte("sale_date", from)
      .is("deleted_at", null),
    supabase
      .from("fabric_types")
      .select("id, fabric_name"),
    supabase
      .from("fabric_rolls")
      .select("id, roll_number, fabric_type_id, weight, production_date, status, current_stage")
      .is("deleted_at", null),
    supabase
      .from("sales_orders")
      .select("id, order_date, status, bill_number, bill_value, customer_id, customers(customer_name, alias), sales_order_items(selected_roll_ids)")
      .is("deleted_at", null),
    // All material sales (raw_material + waste) for the Sale section
    (supabase.from("material_sales") as any)
      .select("id, type, department, raw_material_id, sale_date, quantity, bill_number, customers(customer_name, alias)")
      .gte("sale_date", from)
      .lte("sale_date", to)
      .is("deleted_at", null),
  ]);

  return (
    <StockReportClient
      from={from}
      to={to}
      rawMaterials={(rawMaterials ?? []) as any[]}
      purchases={(purchases ?? []) as any[]}
      consumptions={(consumptions ?? []) as any[]}
      sales={(sales ?? []) as any[]}
      fabricTypes={(fabricTypes ?? []) as any[]}
      rolls={(rolls ?? []) as any[]}
      salesOrders={(salesOrders ?? []) as any[]}
      materialSales={(materialSales ?? []) as any[]}
    />
  );
}

