"use client";

import { useState, useTransition, useMemo } from "react";
import { Check, Printer, X, ChevronRight, ChevronDown, Search, Trash2 } from "lucide-react";
import { confirmSalesDelivery, deleteSalesOrderItem } from "@/app/(app)/_actions";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { StatusBadge } from "@/components/app/status-badge";
import { Label } from "@/components/ui/label";
import { formatNumber, formatDate } from "@/lib/utils";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";

type Roll = {
  id: string;
  roll_number: string;
  meters: number;
  weight: number;
  status: string;
  fabric_type_id: string;
  looms?: { loom_number: string } | null;
  loom_production_entries?: {
    gross_weight: number;
    core_weight: number;
    net_weight: number;
    net_meters: number;
    average_meter_weight: number;
  } | null;
};

type OrderItem = {
  id: string;
  sales_order_id: string;
  department: string;
  product_id: string;
  quantity: number;
  selected_roll_ids: string[];
};

type Customer = {
  id: string;
  customer_name: string;
  alias?: string;
  phone?: string;
  gst_number?: string;
  address?: string;
  is_internal: string;
  status: string;
};

type SalesOrder = {
  id: string;
  order_number: string;
  order_date: string;
  customer_id: string;
  status: string;
  created_at: string;
  customers?: Customer;
  sales_order_items?: OrderItem[];
};

interface OrderConfirmationWorkspaceProps {
  orders: SalesOrder[];
  fabrics: { id: string; fabric_name: string }[];
  rotoProducts: { id: string; brand: string; width: number; height: number }[];
  offsetProducts: { id: string; brand: string; width: number; height: number }[];
  rolls: Roll[];
  initialOrderId?: string | null;
  singleViewMode?: boolean;
}

function getRollSerialValue(rollNumber: string) {
  const matches = rollNumber.match(/\d+/g);
  const lastNumber = matches?.at(-1);
  return lastNumber ? Number(lastNumber) : Number.POSITIVE_INFINITY;
}

function sortRollsBySerial(a: Roll, b: Roll) {
  const serialDiff = getRollSerialValue(a.roll_number) - getRollSerialValue(b.roll_number);
  if (serialDiff !== 0) return serialDiff;
  return a.roll_number.localeCompare(b.roll_number, undefined, { numeric: true, sensitivity: "base" });
}

export function OrderConfirmationWorkspace({
  orders,
  fabrics,
  rotoProducts,
  offsetProducts,
  rolls,
  initialOrderId = null,
  singleViewMode = false,
}: OrderConfirmationWorkspaceProps) {
  const [selectedOrderId, setSelectedOrderId] = useState<string | null>(initialOrderId);
  const [searchTerm, setSearchTerm] = useState("");
  const [isPending, startTransition] = useTransition();

  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  // Roll allocation state: Record<itemId, rollId[]>
  const [allocation, setAllocation] = useState<Record<string, string[]>>({});
  // Expanded items state: Record<itemId, boolean>
  const [expandedItems, setExpandedItems] = useState<Record<string, boolean>>({});

  const [deleteItemId, setDeleteItemId] = useState<string | null>(null);
  const [itemRemainingActions, setItemRemainingActions] = useState<Record<string, "backorder" | "close">>({});


  // Calculate sum of weights of all currently selected rolls across all items
  const totalSelectedWeight = useMemo(() => {
    if (!selectedOrderId) return 0;
    const currentOrder = orders.find((o) => o.id === selectedOrderId);
    if (!currentOrder) return 0;
    let sum = 0;
    currentOrder.sales_order_items?.forEach((item) => {
      const selectedIds = allocation[item.id] || [];
      const itemRolls = rolls.filter((r) => selectedIds.includes(r.id));
      sum += itemRolls.reduce((s, r) => s + Number(r.weight || 0), 0);
    });
    return sum;
  }, [selectedOrderId, allocation, rolls, orders]);

  // Resolve product name helper
  const getProductName = (dept: string, productId: string) => {
    if (dept === "fabric") {
      const f = fabrics.find((x) => x.id === productId);
      return f ? f.fabric_name : "Fabric Product";
    } else if (dept === "roto-printing") {
      const r = rotoProducts.find((x) => x.id === productId);
      return r ? `${r.brand} (${r.width}x${r.height} in)` : "Roto Product";
    } else if (dept === "offset-printing") {
      const o = offsetProducts.find((x) => x.id === productId);
      return o ? `${o.brand} (${o.width}x${o.height} in)` : "Offset Product";
    } else if (dept === "lamination") {
      return productId === "lam-film-25" ? "Laminated Film 2.5 mil" : "Laminated Film 3.0 mil";
    } else if (dept === "finishing") {
      return productId === "finished-bags-28" ? "Finished Bags W-28" : "Finished Bags W-32";
    }
    return "Unknown Product";
  };

  // Find active order details
  const selectedOrder = useMemo(() => {
    if (!selectedOrderId) return null;
    return orders.find((o) => o.id === selectedOrderId) || null;
  }, [selectedOrderId, orders]);

  // Set initial allocation & expansion when an order is selected
  const handleSelectOrder = (order: SalesOrder) => {
    setSelectedOrderId(order.id);
    setErrorMsg(null);
    setSuccessMsg(null);
    const initialAlloc: Record<string, string[]> = {};
    const initialExpand: Record<string, boolean> = {};
    const initialRemaining: Record<string, "backorder" | "close"> = {};

    order.sales_order_items?.forEach((item) => {
      initialAlloc[item.id] = item.selected_roll_ids || [];
      // Expand fabric item roll list by default if there are rolls allocated, or if it's fabric
      initialExpand[item.id] = item.department === "fabric";
      initialRemaining[item.id] = "close";
    });

    setAllocation(initialAlloc);
    setExpandedItems(initialExpand);
    setItemRemainingActions(initialRemaining);
  };


  // Toggle roll selection
  const toggleRoll = (itemId: string, rollId: string) => {
    setAllocation((prev) => {
      const current = prev[itemId] || [];
      const updated = current.includes(rollId)
        ? current.filter((id) => id !== rollId)
        : [...current, rollId];
      return { ...prev, [itemId]: updated };
    });
  };

  // Toggle expansion for an item card
  const toggleExpand = (itemId: string) => {
    setExpandedItems((prev) => ({ ...prev, [itemId]: !prev[itemId] }));
  };

  // Filtered orders list
  const filteredOrders = useMemo(() => {
    return orders.filter((o) => {
      const query = searchTerm.toLowerCase();
      const numMatch = o.order_number.toLowerCase().includes(query);
      const custMatch = o.customers?.customer_name.toLowerCase().includes(query) || false;
      const aliasMatch = o.customers?.alias?.toLowerCase().includes(query) || false;
      return numMatch || custMatch || aliasMatch;
    });
  }, [orders, searchTerm]);

  // Save current allocations
  const handleSave = () => {
    if (!selectedOrder) return;
    setErrorMsg(null);
    setSuccessMsg(null);

    startTransition(async () => {
      try {
        await confirmSalesDelivery(selectedOrder.id, allocation, itemRemainingActions);
        setSuccessMsg("Order allocations saved and delivery status confirmed successfully!");
      } catch (err: any) {
        setErrorMsg(err.message || "Failed to save order confirmation.");
      }
    });

  };

  const handleDeleteItem = (itemId: string) => {
    setErrorMsg(null);
    setSuccessMsg(null);
    setDeleteItemId(null);

    startTransition(async () => {
      try {
        await deleteSalesOrderItem(itemId);
        setSuccessMsg("Item deleted successfully!");
        
        if (selectedOrder) {
          const updatedItems = selectedOrder.sales_order_items?.filter((x) => x.id !== itemId) || [];
          if (updatedItems.length === 0) {
            setSelectedOrderId(null);
          }
        }
      } catch (err: any) {
        setErrorMsg(err.message || "Failed to delete item.");
      }
    });
  };

  const getItemRolls = (item: OrderItem) => {
    if (item.department !== "fabric") return [];
    return rolls
      .filter(
        (r) =>
          r.fabric_type_id === item.product_id &&
          (r.status === "available" || item.selected_roll_ids?.includes(r.id))
      )
      .sort(sortRollsBySerial);
  };

  return (
    <div className="flex flex-col xl:flex-row gap-6 h-full items-stretch">

      {/* Left panel: Orders list */}
      {!singleViewMode && (
        <div className="w-full xl:w-80 shrink-0 flex flex-col gap-4 no-print">
          <Card className="h-[calc(100vh-12rem)] flex flex-col overflow-hidden">
            <CardHeader className="p-4 border-b">
              <CardTitle className="text-base font-bold">Select Sales Order</CardTitle>
              <div className="relative mt-2">
                <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                <input
                  type="text"
                  placeholder="Search orders..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-9 h-9 w-full rounded-md border bg-background text-sm focus:outline-none focus:ring-1 focus:ring-primary"
                />
              </div>
            </CardHeader>
            <div className="flex-1 overflow-y-auto divide-y divide-border">
              {filteredOrders.length === 0 ? (
                <div className="p-4 text-center text-sm text-muted-foreground">No orders found</div>
              ) : (
                filteredOrders.map((order) => {
                  const isSelected = order.id === selectedOrderId;
                  return (
                    <button
                      key={order.id}
                      onClick={() => handleSelectOrder(order)}
                      className={`w-full text-left p-4 transition-colors hover:bg-muted/50 flex flex-col gap-1.5 ${
                        isSelected ? "bg-muted border-l-4 border-l-primary pl-3" : ""
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <span className="font-bold text-sm text-emerald-950">
                          Order #{order.order_number}
                        </span>
                        <StatusBadge value={order.status} />
                      </div>
                      <div className="text-xs font-semibold text-foreground truncate">
                        {order.customers?.customer_name}
                        {order.customers?.alias ? ` (${order.customers.alias})` : ""}
                      </div>
                      <div className="flex items-center justify-between text-[11px] text-muted-foreground mt-1">
                        <span>{formatDate(order.order_date)}</span>
                        <span>{order.sales_order_items?.length ?? 0} items</span>
                      </div>
                    </button>
                  );
                })
              )}
            </div>
          </Card>
        </div>
      )}

      {/* Right panel: Active workspace */}
      <div className="flex-1 min-w-0 no-print">
        {!selectedOrder ? (
          <Card className="h-full flex items-center justify-center p-8 text-center border-dashed">
            <div className="max-w-md space-y-3">
              <div className="h-12 w-12 rounded-full bg-emerald-50 text-emerald-600 flex items-center justify-center mx-auto">
                <Printer className="h-6 w-6" />
              </div>
              <h3 className="text-lg font-bold text-emerald-950">No Order Selected</h3>
              <p className="text-sm text-muted-foreground">
                Select an order from the list on the left to allocate rolls, view dynamic quantity tallies, and generate proforma invoices.
              </p>
            </div>
          </Card>
        ) : (
          <div className="space-y-6">
            {/* Feedback Notifications */}
            {errorMsg && (
              <div className="p-4 bg-red-100 text-red-800 rounded-lg text-sm font-semibold">
                {errorMsg}
              </div>
            )}
            {successMsg && (
              <div className="p-4 bg-emerald-100 text-emerald-800 rounded-lg text-sm font-semibold">
                {successMsg}
              </div>
            )}

            {/* Selected Order Overview Card */}
            {selectedOrder.status === "confirmed" ? (
              <Card className="border-l-4 border-l-emerald-600 bg-emerald-50/10">
                <CardHeader className="p-5 border-b flex flex-row items-center justify-between flex-wrap gap-4">
                  <div>
                    <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-emerald-100 text-emerald-800 text-xs font-bold uppercase tracking-wider mb-2">
                      <Check className="h-3.5 w-3.5" /> Order Confirmed
                    </div>
                    <CardTitle className="text-xl font-black text-emerald-950">
                      Order #{selectedOrder.order_number}
                    </CardTitle>
                    <p className="text-sm text-muted-foreground mt-0.5">
                      Date: {formatDate(selectedOrder.order_date)} | Firm Name:{" "}
                      <span className="font-semibold text-foreground">
                        {selectedOrder.customers?.customer_name}
                      </span>
                      {selectedOrder.customers?.alias && ` (${selectedOrder.customers.alias})`}
                    </p>
                  </div>
                  <div className="flex items-center gap-3">
                    <StatusBadge value={selectedOrder.status} />
                  </div>
                </CardHeader>

                <CardContent className="p-5 space-y-6">
                  <div className="text-sm font-bold text-muted-foreground uppercase tracking-wider">
                    Confirmed Order Items & Allocations
                  </div>

                  {selectedOrder.sales_order_items?.length === 0 ? (
                    <div className="text-center py-6 text-sm text-muted-foreground">
                      This order has no registered items.
                    </div>
                  ) : (
                    <div className="space-y-6">
                      {selectedOrder.sales_order_items?.map((item) => {
                        const prodName = getProductName(item.department, item.product_id);
                        const selectedRolls = rolls
                          .filter((r) => item.selected_roll_ids?.includes(r.id))
                          .sort(sortRollsBySerial);
                        const totalWeight = selectedRolls.reduce((sum, r) => sum + Number(r.weight || 0), 0);
                        const totalMeters = selectedRolls.reduce((sum, r) => sum + Number(r.meters || 0), 0);

                        return (
                          <div key={item.id} className="border rounded-lg bg-card overflow-hidden shadow-sm">
                            <div className="p-4 bg-muted/20 border-b flex items-center justify-between">
                              <div>
                                <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground block">
                                  {item.department}
                                </span>
                                <span className="font-bold text-base text-emerald-950">
                                  {prodName}
                                </span>
                              </div>
                              <div className="text-right flex items-center gap-6">
                                <div>
                                  <span className="text-xs text-muted-foreground block">Order Qty</span>
                                  <span className="font-bold text-sm">{formatNumber(item.quantity)} kg</span>
                                </div>
                              </div>
                            </div>

                            <div className="p-4 space-y-4">
                              {item.department !== "fabric" ? (
                                <div className="text-sm text-muted-foreground py-2 font-medium">
                                  Confirmed & ready for dispatch.
                                </div>
                              ) : selectedRolls.length === 0 ? (
                                <div className="text-sm text-red-600 py-2 font-medium">
                                  No fabric rolls were allocated to this item.
                                </div>
                              ) : (
                                <div className="space-y-4">
                                  <div className="grid grid-cols-3 gap-4 bg-emerald-50/30 p-3 rounded-lg text-sm">
                                    <div>
                                      <div className="text-muted-foreground text-xs">Allocated Rolls</div>
                                      <div className="font-bold text-emerald-950">{selectedRolls.length} rolls</div>
                                    </div>
                                    <div>
                                      <div className="text-muted-foreground text-xs">Total Weight</div>
                                      <div className="font-bold text-emerald-950">{formatNumber(totalWeight, 2)} kg</div>
                                    </div>
                                    <div>
                                      <div className="text-muted-foreground text-xs">Total Meters</div>
                                      <div className="font-bold text-emerald-950">{formatNumber(totalMeters, 2)} m</div>
                                    </div>
                                  </div>

                                  <div className="overflow-x-auto border rounded-lg">
                                    <table className="w-full text-left border-collapse text-sm">
                                      <thead>
                                        <tr className="bg-muted/40 border-b text-xs font-bold uppercase tracking-wider text-muted-foreground">
                                          <th className="p-3">S.No</th>
                                          <th className="p-3">Net W8</th>
                                          <th className="p-3">Core W8</th>
                                          <th className="p-3">Gross W8</th>
                                          <th className="p-3">Mtrs</th>
                                          <th className="p-3">Avg Mtrs</th>
                                          <th className="p-3">Loom</th>
                                        </tr>
                                      </thead>
                                      <tbody className="divide-y">
                                        {selectedRolls.map((roll) => {
                                          const grossW = roll.loom_production_entries?.gross_weight ? formatNumber(roll.loom_production_entries.gross_weight, 2) : "-";
                                          const coreW = roll.loom_production_entries?.core_weight ? formatNumber(roll.loom_production_entries.core_weight, 2) : "-";
                                          const avgMeterW = roll.loom_production_entries?.average_meter_weight ? formatNumber(Math.floor(Number(roll.loom_production_entries.average_meter_weight)), 0) : "-";
                                          const loomNo = roll.looms?.loom_number ?? "-";
                                          return (
                                            <tr key={roll.id}>
                                              <td className="p-3 font-bold text-emerald-950">{roll.roll_number}</td>
                                              <td className="p-3 font-semibold">{formatNumber(roll.weight, 2)}</td>
                                              <td className="p-3">{coreW}</td>
                                              <td className="p-3">{grossW}</td>
                                              <td className="p-3">{formatNumber(roll.meters, 0)}</td>
                                              <td className="p-3">{avgMeterW}</td>
                                              <td className="p-3 font-medium">{loomNo}</td>
                                            </tr>
                                          );
                                        })}
                                      </tbody>
                                    </table>
                                  </div>
                                </div>
                              )}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </CardContent>
              </Card>
            ) : (
              <Card className="border-l-4 border-l-primary">
                <CardHeader className="p-5 border-b flex flex-row items-center justify-between flex-wrap gap-4">
                  <div>
                    <div className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                      Active Order Workspace
                    </div>
                    <CardTitle className="text-xl font-black mt-1 text-emerald-950 flex flex-wrap items-center gap-3">
                      <span>Order #{selectedOrder.order_number}</span>
                      {totalSelectedWeight > 0 && (
                        <span className="text-sm font-bold text-emerald-700 bg-emerald-50 border border-emerald-200 px-2.5 py-0.5 rounded-full">
                          Selected Weight: {formatNumber(totalSelectedWeight, 2)} kg
                        </span>
                      )}
                    </CardTitle>
                    <p className="text-sm text-muted-foreground mt-0.5">
                      Date: {formatDate(selectedOrder.order_date)} | Firm Name:{" "}
                      <span className="font-semibold text-foreground">
                        {selectedOrder.customers?.customer_name}
                      </span>
                      {selectedOrder.customers?.alias && ` (${selectedOrder.customers.alias})`}
                    </p>
                  </div>
                  <div className="flex items-center gap-4 flex-wrap">
                    <button
                      type="button"
                      onClick={handleSave}
                      disabled={isPending}
                      className="inline-flex h-9 items-center justify-center rounded-md bg-primary px-5 text-sm font-semibold text-primary-foreground shadow hover:bg-primary/90 transition-colors disabled:opacity-50"
                    >
                      {isPending ? "Confirming..." : "Confirm & Save"}
                    </button>
                  </div>

                </CardHeader>

                <CardContent className="p-5 space-y-6">
                  <div className="text-sm font-bold text-muted-foreground uppercase tracking-wider">
                    Order Items & Stock Allocation
                  </div>

                  {selectedOrder.sales_order_items?.length === 0 ? (
                    <div className="text-center py-6 text-sm text-muted-foreground">
                      This order has no registered items.
                    </div>
                  ) : (
                    <div className="space-y-4">
                      {selectedOrder.sales_order_items?.map((item) => {
                        const itemRolls = getItemRolls(item);
                        const selectedIds = allocation[item.id] || [];
                        const selectedRolls = itemRolls.filter((r) => selectedIds.includes(r.id));

                        const totalMeters = selectedRolls.reduce(
                          (sum, r) => sum + Number(r.meters || 0),
                          0
                        );
                        const totalWeight = selectedRolls.reduce(
                          (sum, r) => sum + Number(r.weight || 0),
                          0
                        );

                        const isExpanded = !!expandedItems[item.id];
                        const prodName = getProductName(item.department, item.product_id);

                        return (
                          <div
                            key={item.id}
                            className="border rounded-lg overflow-hidden bg-card shadow-sm"
                          >
                            {/* Card Header (Product Clickable Toggle) */}
                            <div
                              onClick={() => toggleExpand(item.id)}
                              className="p-4 bg-muted/20 border-b flex items-center justify-between cursor-pointer select-none hover:bg-muted/40 transition-colors"
                            >
                              <div className="flex items-center gap-3">
                                {isExpanded ? (
                                  <ChevronDown className="h-5 w-5 text-muted-foreground shrink-0" />
                                ) : (
                                  <ChevronRight className="h-5 w-5 text-muted-foreground shrink-0" />
                                )}
                                <div>
                                  <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground block">
                                    {item.department}
                                  </span>
                                  <span className="font-bold text-base text-emerald-950">
                                    {prodName}
                                  </span>
                                </div>
                              </div>

                              <div className="flex items-center gap-6">
                                <div className="text-right">
                                  <span className="text-xs text-muted-foreground block">Needed</span>
                                  <span className="font-bold text-sm">{formatNumber(item.quantity)} kg</span>
                                </div>
                                <div className="text-right">
                                  <span className="text-xs text-muted-foreground block">Selected</span>
                                  <span
                                    className={`font-bold text-sm ${
                                      totalWeight >= item.quantity
                                        ? "text-emerald-700"
                                        : "text-amber-700"
                                    }`}
                                  >
                                    {formatNumber(totalWeight)} kg
                                  </span>
                                </div>
                                <button
                                  type="button"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    setDeleteItemId(item.id);
                                  }}
                                  className="p-1.5 rounded-md text-red-500 hover:bg-red-50 hover:text-red-600 transition-colors shrink-0"
                                  title="Delete Item"
                                >
                                  <Trash2 className="h-4.5 w-4.5" />
                                </button>
                              </div>
                            </div>

                            {/* Card Content */}
                            {isExpanded && (
                              <div className="p-4 space-y-4">
                                {/* Tally Metrics Block */}
                                <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 bg-muted/30 p-3 rounded-lg text-sm">
                                  <div>
                                    <div className="text-muted-foreground text-xs">Target Qty</div>
                                    <div className="font-bold text-sm text-emerald-950">
                                      {formatNumber(item.quantity)} kg
                                    </div>
                                  </div>
                                  <div>
                                    <div className="text-muted-foreground text-xs">Selected Qty</div>
                                    <div className="font-bold text-sm text-emerald-950">
                                      {formatNumber(totalWeight)} kg
                                    </div>
                                  </div>
                                  <div>
                                    <div className="text-muted-foreground text-xs">Selected Meters</div>
                                    <div className="font-bold text-sm text-emerald-950">
                                      {formatNumber(totalMeters, 2)}
                                    </div>
                                  </div>
                                  <div>
                                    <div className="text-muted-foreground text-xs">Selected Rolls</div>
                                    <div className="font-bold text-sm text-emerald-950">
                                      {selectedIds.length} rolls
                                    </div>
                                  </div>
                                </div>

                                {/* Partial Order Checkbox for this item */}
                                {item.department === "fabric" && totalWeight < item.quantity && (
                                  <div className="flex items-center gap-2 bg-amber-50/50 border border-amber-200/60 p-3 rounded-lg">
                                    <input
                                      type="checkbox"
                                      id={`partial-order-checkbox-${item.id}`}
                                      checked={(itemRemainingActions[item.id] ?? "close") === "backorder"}
                                      onChange={(e) => {
                                        setItemRemainingActions((prev) => ({
                                          ...prev,
                                          [item.id]: e.target.checked ? "backorder" : "close",
                                        }));
                                      }}
                                      className="h-4 w-4 rounded border-slate-300 text-primary focus:ring-primary cursor-pointer"
                                    />
                                    <Label
                                      htmlFor={`partial-order-checkbox-${item.id}`}
                                      className="text-xs font-semibold text-emerald-950 cursor-pointer select-none"
                                    >
                                      Create Partial Order for this item (Remaining {formatNumber(item.quantity - totalWeight, 2)} kg will go into a new bill)
                                    </Label>
                                  </div>
                                )}

                                {/* Rolls Selection (Row Format) */}
                                {item.department !== "fabric" ? (

                                  <div className="text-sm text-muted-foreground py-4 text-center border border-dashed rounded-lg">
                                    Dynamic roll tracking is only available for Fabric department. Delivery confirmation will mark this item ready.
                                  </div>
                                ) : itemRolls.length === 0 ? (
                                  <div className="text-sm text-muted-foreground py-4 text-center border border-dashed rounded-lg">
                                    No available rolls found in stock for this fabric type.
                                  </div>
                                ) : (
                                  <div className="space-y-2">
                                    <Label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                                      Select Fabric Rolls
                                    </Label>
                                    <div className="overflow-x-auto border rounded-lg">
                                      <table className="w-full text-left border-collapse text-sm">
                                        <thead>
                                          <tr className="bg-muted/40 border-b text-xs font-bold uppercase tracking-wider text-muted-foreground">
                                                                            <th className="p-3 w-12 text-center">Select</th>
                                            <th className="p-3">S.No</th>
                                            <th className="p-3">Gross W8</th>
                                            <th className="p-3">Core W8</th>
                                            <th className="p-3">Net W8</th>
                                            <th className="p-3">Mtrs</th>
                                            <th className="p-3">Avg Mtrs</th>
                                            <th className="p-3">Loom</th>
                                          </tr>
                                        </thead>
                                        <tbody className="divide-y">
                                          {itemRolls.map((roll) => {
                                            const isSelected = selectedIds.includes(roll.id);
                                            const grossW = roll.loom_production_entries?.gross_weight ? formatNumber(roll.loom_production_entries.gross_weight, 2) : "-";
                                            const coreW = roll.loom_production_entries?.core_weight ? formatNumber(roll.loom_production_entries.core_weight, 2) : "-";
                                            const avgMeterW = roll.loom_production_entries?.average_meter_weight ? formatNumber(Math.floor(Number(roll.loom_production_entries.average_meter_weight)), 0) : "-";
                                            const loomNo = roll.looms?.loom_number ?? "-";
                                            return (
                                              <tr
                                                key={roll.id}
                                                onClick={() => toggleRoll(item.id, roll.id)}
                                                className={`cursor-pointer hover:bg-muted/30 transition-colors ${
                                                  isSelected ? "bg-emerald-50/30" : ""
                                                }`}
                                              >
                                                <td className="p-3 text-center" onClick={(e) => e.stopPropagation()}>
                                                  <input
                                                    type="checkbox"
                                                    checked={isSelected}
                                                    onChange={() => toggleRoll(item.id, roll.id)}
                                                    className="h-4 w-4 rounded border-gray-300 text-emerald-600 focus:ring-emerald-500"
                                                  />
                                                </td>
                                                <td className="p-3 font-bold text-emerald-950">{roll.roll_number}</td>
                                                <td className="p-3">{grossW}</td>
                                                <td className="p-3">{coreW}</td>
                                                <td className="p-3 font-semibold">{formatNumber(roll.weight, 2)}</td>
                                                <td className="p-3">{formatNumber(roll.meters, 0)}</td>
                                                <td className="p-3">{avgMeterW}</td>
                                                <td className="p-3 font-medium">{loomNo}</td>
                                              </tr>
                                            );
                                          })}
                                        </tbody>
                                      </table>
                                    </div>
                                  </div>
                                )}
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  )}
                </CardContent>
              </Card>
            )}
          </div>
        )}
      </div>

      <Dialog open={deleteItemId !== null} onOpenChange={(open) => { if (!open) setDeleteItemId(null); }}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Delete Item from Order?</DialogTitle>
            <DialogDescription>
              Are you sure you want to delete this item from the order? Any allocated rolls will be released.
            </DialogDescription>
          </DialogHeader>
          <div className="flex justify-end gap-3 mt-4">
            <button
              type="button"
              onClick={() => setDeleteItemId(null)}
              className="inline-flex h-9 items-center justify-center rounded-md border border-input bg-background px-4 text-sm font-semibold hover:bg-accent transition-colors"
            >
              No
            </button>
            <button
              type="button"
              onClick={() => {
                if (deleteItemId) {
                  handleDeleteItem(deleteItemId);
                }
              }}
              disabled={isPending}
              className="inline-flex h-9 items-center justify-center rounded-md bg-destructive px-4 text-sm font-semibold text-destructive-foreground hover:bg-destructive/90 transition-colors disabled:opacity-50"
            >
              Yes
            </button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
