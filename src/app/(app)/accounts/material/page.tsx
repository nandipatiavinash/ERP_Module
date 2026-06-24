import { requirePermission } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { todayInIndia } from "@/lib/utils";
import { PageHeader } from "@/components/app/page-header";
import { DateFilter } from "@/components/app/date-filter";
import { MaterialSalesForm } from "./MaterialSalesForm";

export default async function MaterialSalesPage({
  searchParams,
}: {
  searchParams: Promise<{ date?: string }>;
}) {
  await requirePermission("accounts.material");
  const supabase = await createClient();
  const params = await searchParams;
  const date = params.date || todayInIndia();

  // Concurrent data fetching
  const [clientsRes, materialsRes, salesRes] = await Promise.all([
    supabase
      .from("customers")
      .select("id, customer_name, alias")
      .eq("status", "active")
      .eq("is_internal", "client a/c")
      .is("deleted_at", null)
      .order("customer_name"),
    supabase
      .from("raw_materials")
      .select("id, material_name, department, unit, current_stock")
      .eq("status", "active")
      .is("deleted_at", null)
      .order("material_name"),
    supabase
      .from("material_sales")
      .select(`
        id,
        sale_date,
        bill_number,
        type,
        department,
        raw_material_id,
        quantity,
        price,
        inc_gst,
        amount,
        journal_no,
        customers(customer_name, alias),
        raw_materials(material_name, unit)
      `)
      .eq("sale_date", date)
      .is("deleted_at", null)
      .order("created_at", { ascending: false }),
  ]);

  const clients = ((clientsRes.data ?? []) as any[]).filter((c) => !c.customer_name.endsWith(" A/c"));
  const rawMaterials = (materialsRes.data ?? []) as any[];
  const sales = (salesRes.data ?? []) as any[];

  return (
    <div className="space-y-6">
      <PageHeader
        title="Material Sales"
        description="Record raw material or waste sales directly into ledger accounts."
      />

      <div className="flex justify-end">
        <DateFilter date={date} baseUrl="/accounts/material" />
      </div>

      <MaterialSalesForm
        clients={clients}
        rawMaterials={rawMaterials}
        sales={sales}
        selectedDate={date}
      />
    </div>
  );
}
