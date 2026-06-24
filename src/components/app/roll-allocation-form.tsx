"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Check } from "lucide-react";
import { confirmSalesDelivery } from "@/app/(app)/_actions";
import { ConfirmSubmitButton } from "@/components/app/confirm-submit-button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { StatusBadge } from "@/components/app/status-badge";
import { Label } from "@/components/ui/label";
import { formatNumber } from "@/lib/utils";

type Roll = {
  id: string;
  roll_number: string;
  meters: number;
  weight: number;
  status: string;
  loom_production_entries?: {
    gross_weight: number;
    core_weight: number;
    net_weight: number;
    net_meters: number;
    average_meter_weight: number;
  } | null;
  looms?: {
    loom_number: string;
  } | null;
};

type OrderItem = {
  id: string;
  department: string;
  product_id: string;
  product_name: string;
  quantity: number;
  selected_roll_ids: string[];
  availableRolls: Roll[];
};

type RollAllocationFormProps = {
  orderId: string;
  orderNumber: string;
  customerName: string;
  items: OrderItem[];
};

export function RollAllocationForm({
  orderId,
  orderNumber,
  customerName,
  items,
}: RollAllocationFormProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [allocation, setAllocation] = useState<Record<string, string[]>>(() => {
    const initial: Record<string, string[]> = {};
    items.forEach((item) => {
      initial[item.id] = item.selected_roll_ids || [];
    });
    return initial;
  });

  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const toggleRoll = (itemId: string, rollId: string) => {
    setAllocation((prev) => {
      const current = prev[itemId] || [];
      const updated = current.includes(rollId)
        ? current.filter((id) => id !== rollId)
        : [...current, rollId];
      return { ...prev, [itemId]: updated };
    });
  };

  const handleSave = () => {
    setErrorMsg(null);
    startTransition(async () => {
      try {
        await confirmSalesDelivery(orderId, allocation);
        router.push("/sales/delivery-confirmation" as any);
      } catch (err: any) {
        setErrorMsg(err.message || "Failed to confirm delivery.");
      }
    });
  };

  return (
    <div className="space-y-6">
      {errorMsg && (
        <div className="p-4 bg-red-100 text-red-800 rounded-lg text-sm font-semibold">
          {errorMsg}
        </div>
      )}

      {items.map((item) => {
        const selectedIds = allocation[item.id] || [];
        const selectedRolls = item.availableRolls.filter((r) => selectedIds.includes(r.id));
        const totalMeters = selectedRolls.reduce((sum, r) => sum + Number(r.meters || 0), 0);
        const totalWeight = selectedRolls.reduce((sum, r) => sum + Number(r.weight || 0), 0);
        const totalAvailableWeight = item.availableRolls.reduce((sum, r) => sum + Number(r.weight || 0), 0);

        return (
          <Card key={item.id} className="border-l-4 border-l-emerald-600">
            <CardHeader className="pb-3 border-b">
              <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
                <div>
                  <div className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                    Department: {item.department}
                  </div>
                  <CardTitle className="text-lg mt-1 font-bold text-foreground">
                    Product: {item.product_name}
                  </CardTitle>
                </div>
                <div className="text-right">
                  <span className="text-sm text-muted-foreground font-medium">Target:</span>
                  <div className="text-lg font-bold text-emerald-950">
                    {formatNumber(item.quantity)} kg
                  </div>
                </div>
              </div>
            </CardHeader>
            <CardContent className="pt-4 space-y-4">
              {/* Tally Metrics */}
              <div className="grid grid-cols-4 gap-4 bg-muted/30 p-3 rounded-lg text-sm">
                <div>
                  <div className="text-muted-foreground text-xs">Needed (Kgs)</div>
                  <div className="font-bold text-base text-emerald-900">{formatNumber(item.quantity, 2)}</div>
                </div>
                <div>
                  <div className="text-muted-foreground text-xs">Selected (Kgs)</div>
                  <div className={`font-bold text-base ${totalWeight >= item.quantity ? "text-emerald-700" : "text-amber-700"}`}>
                    {formatNumber(totalWeight, 2)}
                  </div>
                </div>
                <div>
                  <div className="text-muted-foreground text-xs">Available (Kgs)</div>
                  <div className="font-bold text-base text-emerald-900">{formatNumber(totalAvailableWeight, 2)}</div>
                </div>
                <div>
                  <div className="text-muted-foreground text-xs">Selected Rolls</div>
                  <div className="font-bold text-base text-emerald-900">
                    {selectedIds.length} / {item.availableRolls.length}
                  </div>
                </div>
              </div>

              {/* Rolls Checkbox List */}
              {item.department !== "fabric" ? (
                <div className="text-sm text-muted-foreground py-4 text-center border border-dashed rounded-lg">
                  Order item is registered under {item.department} department. Physical fabric roll inventory is only tracked for fabric products. Delivery confirmation will mark this item ready.
                </div>
              ) : item.availableRolls.length === 0 ? (
                <div className="text-sm text-muted-foreground py-4 text-center border border-dashed rounded-lg">
                  No available rolls in stock for this fabric type.
                </div>
              ) : (
                <div className="space-y-2">
                  <Label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                    Select Available Rolls
                  </Label>
                  <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                    {item.availableRolls.map((roll) => {
                      const isSelected = selectedIds.includes(roll.id);
                      return (
                        <button
                          key={roll.id}
                          type="button"
                          onClick={() => toggleRoll(item.id, roll.id)}
                          className={`flex items-center justify-between p-3 border rounded-lg text-left text-sm transition-all duration-150 ${
                            isSelected
                              ? "border-emerald-600 bg-emerald-50/50 shadow-sm"
                              : "border-muted hover:border-muted-foreground/30 bg-background"
                          }`}
                        >
                          <div>
                            <div className="font-bold text-emerald-950">Roll: {roll.roll_number}</div>
                            <div className="text-xs text-muted-foreground mt-1 space-y-0.5">
                              <div>Gross: {formatNumber(roll.loom_production_entries?.gross_weight, 2)} | Core: {formatNumber(roll.loom_production_entries?.core_weight, 2)}</div>
                              <div>Net W8: {formatNumber(roll.weight, 2)} | Mtrs: {formatNumber(Math.floor(roll.meters), 0)}</div>
                              <div>Avg Mtrs: {roll.loom_production_entries?.average_meter_weight ? formatNumber(Math.floor(Number(roll.loom_production_entries.average_meter_weight)), 0) : "-"}</div>
                            </div>
                          </div>
                          {isSelected ? (
                            <span className="h-5 w-5 rounded-full bg-emerald-600 flex items-center justify-center text-white">
                              <Check className="h-3.5 w-3.5" />
                            </span>
                          ) : (
                            <span className="h-5 w-5 rounded-full border border-muted" />
                          )}
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        );
      })}

      <div className="pt-4 border-t flex justify-end">
        <button
          type="button"
          onClick={handleSave}
          disabled={isPending}
          className="inline-flex h-10 items-center justify-center rounded-md bg-primary px-6 font-semibold text-primary-foreground shadow transition-colors hover:bg-primary/95 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-50"
        >
          {isPending ? "Confirming Delivery..." : "Confirm Delivery"}
        </button>
      </div>
    </div>
  );
}
