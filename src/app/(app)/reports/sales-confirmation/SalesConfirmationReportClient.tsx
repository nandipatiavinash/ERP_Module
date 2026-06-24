"use client";

import { useEffect, useState, useMemo } from "react";
import { useRouter } from "next/navigation";
import { ChevronDown, ChevronRight, Percent, Check } from "lucide-react";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { formatNumber, formatDate } from "@/lib/utils";
import { saveSalesConfirmationRates } from "@/app/(app)/_actions";

type OrderItem = {
  id: string;
  department: string;
  product_id: string;
  quantity: number;
  selected_roll_ids: string[];
  price?: number;
};

type SalesOrder = {
  id: string;
  order_number: string;
  order_date: string;
  customer_id: string;
  status: string;
  bill_number: string;
  bill_value: number;
  gst_rate?: number;
  customers?: {
    customer_name: string;
    alias?: string;
    phone?: string;
    address?: string;
  };
  sales_order_items?: OrderItem[];
};

interface SalesConfirmationReportClientProps {
  orders: SalesOrder[];
  recentOrders?: SalesOrder[];
  fabrics: Array<{ id: string; fabric_name: string; selling_price: number }>;
  rotoProducts: Array<{ id: string; brand: string; width: number; height: number }>;
  offsetProducts: Array<{ id: string; brand: string; width: number; height: number }>;
  rolls: Array<{ id: string; weight: number }>;
}

export function SalesConfirmationReportClient({
  orders,
  recentOrders = [],
  fabrics,
  rotoProducts,
  offsetProducts,
  rolls,
}: SalesConfirmationReportClientProps) {
  const router = useRouter();
  
  // Tabs: "date" or "recent"
  const [activeTab, setActiveTab] = useState<"date" | "recent">("date");

  // Collapsible states
  const [expandedOrders, setExpandedOrders] = useState<Record<string, boolean>>({});

  // Inputs state
  const [prices, setPrices] = useState<Record<string, number>>({});
  const [gstRates, setGstRates] = useState<Record<string, number>>({});

  // Edit states per order
  const [editingOrders, setEditingOrders] = useState<Record<string, boolean>>({});

  // Submission feedback state
  const [saving, setSaving] = useState<Record<string, boolean>>({});
  const [successOrders, setSuccessOrders] = useState<Record<string, boolean>>({});
  const [errorText, setErrorText] = useState<Record<string, string | null>>({});

  const displayedOrders = activeTab === "date" ? orders : recentOrders;

  // Sort orders flat: order_date (ascending for date tab, descending for recent tab), then bill_number (ascending)
  const sortedOrders = useMemo(() => {
    return [...displayedOrders].sort((a, b) => {
      if (a.order_date !== b.order_date) {
        return activeTab === "date"
          ? a.order_date.localeCompare(b.order_date)
          : b.order_date.localeCompare(a.order_date);
      }
      return (a.bill_number || "").localeCompare(b.bill_number || "");
    });
  }, [displayedOrders, activeTab]);

  useEffect(() => {
    const initialPrices: Record<string, number> = {};
    const initialGst: Record<string, number> = {};

    const allOrders = [...orders, ...recentOrders];
    allOrders.forEach((order) => {
      initialGst[order.id] = Number(order.gst_rate ?? 18);
      order.sales_order_items?.forEach((item) => {
        if (item.price != null && Number(item.price) !== 0) {
          initialPrices[item.id] = Number(item.price);
        } else if (item.department === "fabric") {
          const fab = fabrics.find((f) => f.id === item.product_id);
          initialPrices[item.id] = Number(fab?.selling_price ?? 0);
        } else {
          initialPrices[item.id] = 0;
        }
      });
    });

    setPrices((prev) => ({ ...initialPrices, ...prev }));
    setGstRates((prev) => ({ ...initialGst, ...prev }));
  }, [orders, recentOrders, fabrics]);

  const toggleOrder = (orderId: string) => {
    setExpandedOrders((prev) => ({ ...prev, [orderId]: !prev[orderId] }));
  };

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

  const getItemQuantity = (item: OrderItem) => {
    if (item.department === "fabric") {
      const selectedIds = item.selected_roll_ids || [];
      const itemRolls = rolls.filter((r) => selectedIds.includes(r.id));
      return itemRolls.reduce((sum, r) => sum + Number(r.weight || 0), 0);
    }
    return Number(item.quantity || 0);
  };

  const getItemUnit = (item: OrderItem) => {
    if (item.department === "fabric") return "kg";
    if (item.department === "finishing") return "bags";
    return "pcs";
  };

  const handlePriceChange = (itemId: string, val: string) => {
    const price = Number(val);
    setPrices((prev) => ({ ...prev, [itemId]: isNaN(price) ? 0 : price }));
  };

  const handleGstChange = (orderId: string, val: string) => {
    const rate = Number(val);
    setGstRates((prev) => ({ ...prev, [orderId]: isNaN(rate) ? 0 : rate }));
  };

  const handleSaveOrderRates = async (orderId: string, orderItems: OrderItem[]) => {
    if (saving[orderId]) return;
    setSaving((prev) => ({ ...prev, [orderId]: true }));
    setErrorText((prev) => ({ ...prev, [orderId]: null }));
    setSuccessOrders((prev) => ({ ...prev, [orderId]: false }));

    try {
      const itemPrices: Record<string, number> = {};
      orderItems.forEach((item) => {
        itemPrices[item.id] = Number(prices[item.id] ?? 0);
      });
      const gstRate = Number(gstRates[orderId] ?? 18);

      await saveSalesConfirmationRates(orderId, itemPrices, gstRate);
      
      // Lock rate inputs upon save
      setEditingOrders((prev) => ({ ...prev, [orderId]: false }));
      
      router.refresh();

      setSuccessOrders((prev) => ({ ...prev, [orderId]: true }));
      setTimeout(() => {
        setSuccessOrders((prev) => ({ ...prev, [orderId]: false }));
      }, 3000);
    } catch (err: any) {
      setErrorText((prev) => ({ ...prev, [orderId]: err.message || "Failed to save prices." }));
    } finally {
      setSaving((prev) => ({ ...prev, [orderId]: false }));
    }
  };

  // Helper to determine if an order has all rates/prices confirmed in database
  const isOrderRatesConfirmed = (order: SalesOrder) => {
    if (!order.sales_order_items || order.sales_order_items.length === 0) return false;
    return order.sales_order_items.every(
      (item) => item.price != null && Number(item.price) > 0
    );
  };

  return (
    <div className="space-y-6">
      {/* Premium Tab Switcher */}
      <div className="flex border-b border-slate-200">
        <button
          onClick={() => setActiveTab("date")}
          className={`px-5 py-2.5 font-bold text-sm border-b-2 transition-all ${
            activeTab === "date"
              ? "border-emerald-600 text-emerald-600"
              : "border-transparent text-slate-500 hover:text-slate-700"
          }`}
        >
          Orders on Selected Date
        </button>
        <button
          onClick={() => setActiveTab("recent")}
          className={`px-5 py-2.5 font-bold text-sm border-b-2 transition-all ${
            activeTab === "recent"
              ? "border-emerald-600 text-emerald-600"
              : "border-transparent text-slate-500 hover:text-slate-700"
          }`}
        >
          Recent Confirmations (Last 20)
        </button>
      </div>

      {sortedOrders.length === 0 ? (
        <EmptyState
          title={activeTab === "date" ? "No billed sales on this date" : "No recent confirmations"}
          description="Billed sales orders from Sales Entry will appear here."
        />
      ) : (
        <div className="space-y-4">
          {sortedOrders.map((order) => {
            const isOrderExpanded = expandedOrders[order.id] ?? false;
            const gstPct = gstRates[order.id] ?? 18;
            const clientName = order.customers?.customer_name ?? "Unknown Customer";
            const clientAlias = order.customers?.alias;

            const itemsWithCalcs = order.sales_order_items?.map((item) => {
              const qty = Number(getItemQuantity(item));
              const price = Number(prices[item.id] ?? 0);
              const amount = qty * price;
              return {
                ...item,
                qty,
                price,
                amount,
                unit: getItemUnit(item),
                resolvedName: getProductName(item.department, item.product_id),
              };
            }) || [];

            const baseTotal = itemsWithCalcs.reduce((s, item) => s + item.amount, 0);
            const gstAmount = baseTotal * (gstPct / 100);
            const calculatedTotal = baseTotal + gstAmount;
            const billValue = Number(order.bill_value ?? 0);
            const balance = calculatedTotal - billValue;

            const isConfirmed = isOrderRatesConfirmed(order);
            const isEditing = editingOrders[order.id] ?? false;

            return (
              <div
                key={order.id}
                className="rounded-xl border border-slate-200 bg-white overflow-hidden shadow-sm transition-all hover:shadow-md"
              >
                {/* Card header / Collapsible trigger button */}
                <button
                  type="button"
                  className="w-full flex flex-col md:flex-row md:items-center justify-between px-6 py-4 hover:bg-slate-50/50 transition-colors gap-3"
                  onClick={() => toggleOrder(order.id)}
                >
                  <div className="flex items-center gap-3 min-w-0">
                    {isOrderExpanded ? (
                      <ChevronDown className="h-5 w-5 text-slate-400 shrink-0" />
                    ) : (
                      <ChevronRight className="h-5 w-5 text-slate-400 shrink-0" />
                    )}
                    <div className="text-left min-w-0">
                      <div className="flex items-center gap-3 flex-wrap">
                        <span className="font-black text-lg text-slate-900 block truncate">
                          {clientName} {clientAlias ? `(${clientAlias})` : ""}
                        </span>
                        <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider ${
                          isConfirmed ? "bg-emerald-100 text-emerald-800 border border-emerald-200" : "bg-amber-100 text-amber-800 border border-amber-200"
                        }`}>
                          {isConfirmed ? "Rates Confirmed" : "Pending Rates"}
                        </span>
                      </div>
                      <div className="flex items-center gap-3 text-xs text-muted-foreground mt-0.5">
                        <span className="font-semibold text-slate-700">Order #{order.order_number}</span>
                        <span>•</span>
                        <span>Date: {formatDate(order.order_date)}</span>
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center justify-between md:justify-end gap-6 border-t md:border-t-0 pt-2 md:pt-0 text-left md:text-right text-xs shrink-0">
                    <div>
                      <span className="text-[9px] text-muted-foreground uppercase tracking-wider block">Bill No</span>
                      <span className="font-bold text-slate-800 text-sm">{order.bill_number}</span>
                    </div>
                    <div>
                      <span className="text-[9px] text-muted-foreground uppercase tracking-wider block">Bill Value</span>
                      <span className="font-bold text-slate-800 text-sm">₹{formatNumber(Math.floor(billValue), 0)}</span>
                    </div>
                    <div>
                      <span className="text-[9px] text-muted-foreground uppercase tracking-wider block">Balance</span>
                      <span
                        className={`font-black text-sm ${
                          balance > 0 ? "text-rose-600" : "text-emerald-600"
                        }`}
                      >
                        ₹{formatNumber(Math.floor(balance), 0)}
                      </span>
                    </div>
                  </div>
                </button>

                {/* Expanded Card Content */}
                {isOrderExpanded && (
                  <div className="border-t border-slate-100 bg-slate-50/20 p-6 space-y-6">
                    {/* Items Table */}
                    <div className="overflow-x-auto rounded-lg border border-slate-200 bg-white">
                      <Table>
                        <TableHeader>
                          <TableRow className="bg-slate-50 text-[10px] font-bold uppercase text-slate-600 border-b border-slate-200">
                            <TableHead>Department</TableHead>
                            <TableHead>Product</TableHead>
                            <TableHead className="text-right">Qty / Weight</TableHead>
                            <TableHead className="w-36 text-right">Price (₹)</TableHead>
                            <TableHead className="text-right">Amount (₹)</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {itemsWithCalcs.map((item) => (
                            <TableRow key={item.id} className="hover:bg-slate-50/50 border-b border-slate-100 last:border-b-0">
                              <TableCell className="text-xs capitalize font-medium text-slate-600">
                                {item.department}
                              </TableCell>
                              <TableCell className="text-xs font-bold text-emerald-950">
                                {item.resolvedName}
                              </TableCell>
                              <TableCell className="text-xs text-right font-medium">
                                {formatNumber(item.qty, 0)} <span className="text-[10px] text-muted-foreground font-normal">{item.unit}</span>
                              </TableCell>
                              <TableCell className="text-right">
                                {isConfirmed && !isEditing ? (
                                  <span className="font-bold text-xs pr-4 text-slate-800">
                                    ₹{formatNumber(item.price, 2)}
                                  </span>
                                ) : (
                                  <div className="relative flex items-center justify-end">
                                    <span className="absolute left-2.5 text-muted-foreground text-[10px]">₹</span>
                                    <Input
                                      type="number"
                                      min="0"
                                      step="0.01"
                                      placeholder="0.00"
                                      value={prices[item.id] === 0 ? "" : (prices[item.id] ?? "")}
                                      onChange={(e) => handlePriceChange(item.id, e.target.value)}
                                      className="h-8 pl-5 pr-2 w-28 text-right text-xs border-slate-300 focus-visible:ring-emerald-500 font-semibold shadow-none"
                                    />
                                  </div>
                                )}
                              </TableCell>
                              <TableCell className="text-xs text-right font-bold text-slate-900">
                                ₹{formatNumber(Math.floor(item.amount), 0)}
                              </TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </div>

                    {/* Summary Calculations Banner */}
                    <div className="grid grid-cols-2 md:grid-cols-5 gap-3 bg-slate-50 border border-slate-200 text-slate-800 p-4 rounded-lg shadow-inner text-xs">
                      <div>
                        <div className="text-slate-500 text-[10px] uppercase font-semibold">Base Amount</div>
                        <div className="font-bold text-sm mt-0.5">₹{formatNumber(Math.floor(baseTotal), 0)}</div>
                      </div>
                      <div>
                        <div className="text-slate-500 text-[10px] uppercase font-semibold">GST Amount</div>
                        <div className="font-bold text-sm mt-0.5">₹{formatNumber(Math.floor(gstAmount), 0)}</div>
                      </div>
                      <div>
                        <div className="text-slate-500 text-[10px] uppercase font-semibold">Calculated Total</div>
                        <div className="font-bold text-sm mt-0.5 text-emerald-700">₹{formatNumber(Math.floor(calculatedTotal), 0)}</div>
                      </div>
                      <div>
                        <div className="text-slate-500 text-[10px] uppercase font-semibold">Bill Value</div>
                        <div className="font-bold text-sm mt-0.5 text-slate-700">₹{formatNumber(Math.floor(billValue), 0)}</div>
                      </div>
                      <div className="col-span-2 md:col-span-1 border-t md:border-t-0 md:border-l border-slate-200 pt-2 md:pt-0 md:pl-4">
                        <div className="text-slate-500 text-[10px] uppercase font-semibold">Outstanding Balance</div>
                        <div
                          className={`font-black text-base mt-0.5 ${
                            balance > 0 ? "text-rose-700" : "text-emerald-700"
                          }`}
                        >
                          ₹{formatNumber(Math.floor(balance), 0)}
                        </div>
                      </div>
                    </div>

                    {/* Submit and GST Input Control */}
                    <div className="flex items-center justify-between gap-4 pt-4 border-t border-slate-100">
                      <div className="flex items-center gap-2">
                        <div className="flex flex-col gap-1 w-28">
                          <Label htmlFor={`gst-${order.id}`} className="text-[10px] text-muted-foreground font-bold uppercase">
                            GST Rate (%)
                          </Label>
                          {isConfirmed && !isEditing ? (
                            <span className="font-bold text-xs text-slate-800 py-1.5 px-3 bg-slate-100 rounded border border-slate-200 block text-center w-full min-h-[32px] flex items-center justify-center">
                              {order.gst_rate ?? 18}%
                            </span>
                          ) : (
                            <div className="relative flex items-center">
                              <Percent className="absolute right-2.5 h-3 w-3 text-muted-foreground" />
                              <Input
                                id={`gst-${order.id}`}
                                type="number"
                                min="0"
                                max="100"
                                step="0.01"
                                value={gstRates[order.id] === 0 ? "" : (gstRates[order.id] ?? "")}
                                onChange={(e) => handleGstChange(order.id, e.target.value)}
                                className="h-8 pr-7 text-xs border-slate-300 focus-visible:ring-emerald-500 font-semibold shadow-none"
                              />
                            </div>
                          )}
                        </div>
                      </div>

                      <div className="flex items-center gap-3">
                        {errorText[order.id] && (
                          <p className="text-xs text-destructive max-w-xs">{errorText[order.id]}</p>
                        )}
                        {isConfirmed && !isEditing ? (
                          <Button
                            onClick={() => setEditingOrders((prev) => ({ ...prev, [order.id]: true }))}
                            size="sm"
                            className="rounded-full w-fit px-8 bg-slate-700 hover:bg-slate-800 text-white font-semibold text-xs h-9 flex items-center gap-1.5 shadow-sm"
                          >
                            Edit Rates
                          </Button>
                        ) : (
                          <Button
                            onClick={() => handleSaveOrderRates(order.id, order.sales_order_items || [])}
                            disabled={saving[order.id]}
                            size="sm"
                            className="rounded-full w-fit px-8 bg-emerald-600 hover:bg-emerald-700 text-white font-semibold text-xs h-9 flex items-center gap-1.5 shadow-sm"
                          >
                            {saving[order.id] ? (
                              "Saving..."
                            ) : successOrders[order.id] ? (
                              <>
                                <Check className="h-3.5 w-3.5" /> Saved
                              </>
                            ) : (
                              "Submit"
                            )}
                          </Button>
                        )}
                      </div>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

