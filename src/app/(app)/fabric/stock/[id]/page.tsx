import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { PageHeader } from "@/components/app/page-header";
import { requirePermission } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { Button } from "@/components/ui/button";
import { StockRollsClient } from "./StockRollsClient";

export default async function FabricStockDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  await requirePermission("fabric.stock");
  const { id } = await params;
  const supabase = await createClient();

  const [
    { data: fabricData, error: fabricError },
    { data: availableRolls, error: availableRollsError },
    { data: soldRolls, error: soldRollsError },
    { data: allocations, error: allocationsError },
  ] = await Promise.all([
    supabase.from("fabric_types").select("fabric_name").eq("id", id).single(),
    supabase
      .from("fabric_rolls")
      .select("*, fabric_types(fabric_name), looms(loom_number), loom_production_entries(gross_weight, core_weight, net_weight, net_meters, average_meter_weight)")
      .eq("fabric_type_id", id)
      .eq("status", "available")
      .is("deleted_at", null)
      .order("roll_number", { ascending: true }),
    supabase
      .from("fabric_rolls")
      .select("*, fabric_types(fabric_name), looms(loom_number), loom_production_entries(gross_weight, core_weight, net_weight, net_meters, average_meter_weight)")
      .eq("fabric_type_id", id)
      .eq("status", "sold")
      .is("deleted_at", null)
      .order("roll_number", { ascending: true }),
    (supabase as any).rpc("get_roll_allocations_for_fabric", { p_fabric_type_id: id }),
  ]);

  if (fabricError || availableRollsError || soldRollsError || allocationsError) {
    throw new Error("Unable to load stock details right now.");
  }

  const rollAllocationMap: Record<string, { dispatchDate: string; clientName: string }> = {};
  for (const allocation of (allocations ?? []) as any[]) {
    rollAllocationMap[allocation.roll_id] = {
      dispatchDate: allocation.dispatch_date,
      clientName: allocation.client_name ?? "Unknown",
    };
  }

  const fabric = fabricData as { fabric_name: string } | null;
  const fabricName = fabric?.fabric_name ?? "Fabric";

  return (
    <>
      <div className="mb-4">
        <Link href={"/fabric/stock" as any} passHref>
          <Button variant="ghost" className="gap-2 text-muted-foreground hover:text-foreground">
            <ArrowLeft className="h-4 w-4" /> Back to Stock Inventory
          </Button>
        </Link>
      </div>

      <PageHeader
        title={`Rolls — ${fabricName}`}
        description={`Detailed view of fabric rolls registered under type ${fabricName}.`}
      />

      <StockRollsClient
        availableRolls={(availableRolls ?? []) as any[]}
        soldRolls={(soldRolls ?? []) as any[]}
        rollAllocationMap={rollAllocationMap}
        fabricName={fabricName}
      />
    </>
  );
}
