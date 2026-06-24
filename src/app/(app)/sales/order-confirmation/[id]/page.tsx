import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { notFound } from "next/navigation";
import { requirePermission } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { OrderConfirmationWorkspace } from "../OrderConfirmationWorkspace";
import { Button } from "@/components/ui/button";

export default async function OrderWorkspacePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  await requirePermission("sales.delivery_entry");
  const { id } = await params;
  const supabase = await createClient();
  const [
    orderResult,
    { data: fabrics },
    { data: rotoProducts },
    { data: offsetProducts }
  ] = await Promise.all([
    supabase
      .from("sales_orders")
      .select("*, customers(*), sales_order_items(*)")
      .eq("id", id)
      .is("deleted_at", null)
      .maybeSingle(),
    supabase.from("fabric_types").select("id, fabric_name"),
    supabase.from("roto_products").select("id, brand, width, height"),
    supabase.from("offset_products").select("id, brand, width, height")
  ]);

  if (orderResult.error) throw new Error(orderResult.error.message);
  const order = orderResult.data;
  if (!order) notFound();

  const orderItems = ((order as any).sales_order_items ?? []) as any[];
  const fabricTypeIds = Array.from(new Set(orderItems.filter((item) => item.department === "fabric").map((item) => item.product_id).filter(Boolean)));
  const selectedRollIds = Array.from(new Set([
    ...(((order as any).selected_roll_ids ?? []) as string[]),
    ...orderItems.flatMap((item) => ((item.selected_roll_ids ?? []) as string[])),
  ]));
  const rollSelect = "id, roll_number, meters, weight, status, fabric_type_id, looms(loom_number), loom_production_entries(gross_weight, core_weight, net_weight, net_meters, average_meter_weight)";

  // 2. Fetch available and selected rolls in parallel
  const [availableRollsResult, selectedRollsResult] = await Promise.all([
    fabricTypeIds.length > 0
      ? supabase.from("fabric_rolls").select(rollSelect).in("fabric_type_id", fabricTypeIds).eq("status", "available").is("deleted_at", null).order("roll_number", { ascending: true })
      : Promise.resolve({ data: [], error: null }),
    selectedRollIds.length > 0
      ? supabase.from("fabric_rolls").select(rollSelect).in("id", selectedRollIds).is("deleted_at", null).order("roll_number", { ascending: true })
      : Promise.resolve({ data: [], error: null }),
  ]);
  if (availableRollsResult.error) throw new Error(availableRollsResult.error.message);
  if (selectedRollsResult.error) throw new Error(selectedRollsResult.error.message);

  const rollsById = new Map<string, any>();
  for (const roll of [...((availableRollsResult.data ?? []) as any[]), ...((selectedRollsResult.data ?? []) as any[])]) {
    rollsById.set(roll.id, roll);
  }

  return (
    <div className="space-y-6">
      <div className="no-print mb-4">
        <Link href={"/sales/order-confirmation" as any} passHref>
          <Button variant="ghost" className="gap-2 text-muted-foreground hover:text-foreground">
            <ArrowLeft className="h-4 w-4" /> Back to Delivery Entry List
          </Button>
        </Link>
      </div>

      <OrderConfirmationWorkspace
        orders={[order] as any[]}
        fabrics={(fabrics ?? []) as any[]}
        rotoProducts={(rotoProducts ?? []) as any[]}
        offsetProducts={(offsetProducts ?? []) as any[]}
        rolls={Array.from(rollsById.values())}
        initialOrderId={id}
        singleViewMode={true}
      />
    </div>
  );
}
