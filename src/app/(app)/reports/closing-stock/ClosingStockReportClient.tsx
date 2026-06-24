"use client";

import { useState, useMemo, useEffect } from "react";
import { useRouter } from "next/navigation";
import { PageHeader } from "@/components/app/page-header";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { formatNumber, todayInIndia } from "@/lib/utils";
import { saveClosingStock } from "@/app/(app)/_actions";

interface RawMaterial {
  id: string;
  material_name: string;
  unit: string;
  department: string | null;
  current_stock: string | number;
}

interface Purchase {
  raw_material_id: string;
  purchase_date: string;
  quantity: string | number;
  rate: string | number;
  total_amount: string | number;
}

interface Consumption {
  raw_material_id: string;
  consumption_date: string;
  quantity: string | number;
}

interface FabricType {
  id: string;
  fabric_name: string;
  selling_price: number;
}

interface FabricRoll {
  id: string;
  roll_number: string;
  fabric_type_id: string;
  weight: string | number;
  meters: string | number;
  production_date: string;
  status: string;
  current_stage: string;
}

interface SalesOrder {
  order_date: string;
  status: string;
  bill_number: string | null;
  sales_order_items: Array<{
    selected_roll_ids: string[] | null;
  }> | null;
}

interface MaterialSale {
  raw_material_id: string | null;
  sale_date: string;
  quantity: string | number;
  type: string;
}

interface ClosingStockReportClientProps {
  date: string;
  rawMaterials: RawMaterial[];
  purchases: Purchase[];
  consumptions: Consumption[];
  materialSales: MaterialSale[];
  fabricTypes: FabricType[];
  rolls: FabricRoll[];
  salesOrders: SalesOrder[];
  submittedStock: any;
}

const DEPT_ORDER = ["fabric", "roto-printing", "lamination", "offset-printing", "finishing", "general"];

function getDeptLabel(key: string | null | undefined): string {
  if (!key) return "General";
  const mapping: Record<string, string> = {
    fabric: "Fabric",
    loom: "Fabric",
    "roto-printing": "Roto Printing",
    roto_printing: "Roto Printing",
    lamination: "Lamination",
    "offset-printing": "Offset Printing",
    offset_printing: "Offset Printing",
    finishing: "Finishing",
    general: "General",
  };
  return mapping[key] ?? key;
}

function getStageDeptKey(stage: string): string {
  if (stage === "loom") return "fabric";
  if (stage === "roto_printing") return "roto-printing";
  if (stage === "offset_printing") return "offset-printing";
  return stage;
}

function getProdStageName(key: string): string {
  const mapping: Record<string, string> = {
    loom: "Fabric Stock (Rolls)",
    roto_printing: "Roto Printed Stock",
    lamination: "Laminated Stock",
    offset_printing: "Offset Printed Stock",
    finishing: "Finished Stock",
  };
  return mapping[key] ?? key;
}

export function ClosingStockReportClient({
  date,
  rawMaterials,
  purchases,
  consumptions,
  materialSales,
  fabricTypes,
  rolls,
  salesOrders,
  submittedStock,
}: ClosingStockReportClientProps) {
  const router = useRouter();
  const [customPrices, setCustomPrices] = useState<Record<string, string>>(() => {
    return submittedStock?.customPrices ? submittedStock.customPrices : {};
  });
  const [submitted, setSubmitted] = useState(() => !!submittedStock);
  const [isSaving, setIsSaving] = useState(false);
  const today = todayInIndia();

  useEffect(() => {
    setCustomPrices(submittedStock?.customPrices ? submittedStock.customPrices : {});
    setSubmitted(!!submittedStock);
  }, [submittedStock]);


  const handleDateChange = (newDate: string) => {
    router.push(`/reports/closing-stock?date=${newDate}` as any);
  };

  const setPrice = (key: string, val: string) =>
    setCustomPrices((prev) => ({ ...prev, [key]: val }));

  const getPrice = (key: string, fallback: number): number =>
    customPrices[key] !== undefined ? Number(customPrices[key] || 0) : fallback;

  // Sold roll IDs → order date
  const rollIdToSoldDate = useMemo(() => {
    const map: Record<string, string> = {};
    salesOrders.forEach((order) => {
      if (order.status === "confirmed" && order.bill_number) {
        order.sales_order_items?.forEach((item) => {
          if (item.selected_roll_ids) {
            item.selected_roll_ids.forEach((rollId) => {
              map[rollId] = order.order_date;
            });
          }
        });
      }
    });
    return map;
  }, [salesOrders]);

  // Active rolls at date D (produced on/before D, not yet sold or sold after D)
  const activeRollsAtD = useMemo(() => {
    return rolls.filter((roll) => {
      if (roll.production_date > date) return false;
      const soldDate = rollIdToSoldDate[roll.id];
      return roll.status === "available" || (soldDate && soldDate > date);
    });
  }, [rolls, date, rollIdToSoldDate]);

  // RM stock at date D (backtrack from current)
  const getRmStockAtD = (materialId: string, currentStock: number): number => {
    if (date >= today) return currentStock;
    const purchasesAfter = purchases
      .filter((p) => p.raw_material_id === materialId && p.purchase_date > date)
      .reduce((s, p) => s + Number(p.quantity), 0);
    const consumptionsAfter = consumptions
      .filter((c) => c.raw_material_id === materialId && c.consumption_date > date)
      .reduce((s, c) => s + Number(c.quantity), 0);
    const rmSalesAfter = materialSales
      .filter((s) => s.raw_material_id === materialId && s.type === "raw_material" && s.sale_date > date)
      .reduce((s, m) => s + Number(m.quantity), 0);
    return currentStock - purchasesAfter + consumptionsAfter + rmSalesAfter;
  };

  const getRmDefaultPrice = (materialId: string): number => {
    const matPurchases = purchases
      .filter((p) => p.raw_material_id === materialId && p.purchase_date <= date)
      .sort((a, b) => a.purchase_date.localeCompare(b.purchase_date));
    if (matPurchases.length === 0) return 0;
    return Number(matPurchases[matPurchases.length - 1].rate ?? 0);
  };

  // Raw Material rows
  const rmRows = useMemo(() => {
    return rawMaterials
      .map((mat) => ({
        key: `rm-${mat.id}`,
        departmentKey: mat.department || "general",
        departmentLabel: getDeptLabel(mat.department),
        name: mat.material_name,
        stock: Math.max(0, Math.floor(getRmStockAtD(mat.id, Number(mat.current_stock)))),
        defaultPrice: getRmDefaultPrice(mat.id),
        isProduct: false,
      }))
      .filter((r) => r.stock > 0)
      .sort((a, b) => {
        const ia = DEPT_ORDER.indexOf(a.departmentKey);
        const ib = DEPT_ORDER.indexOf(b.departmentKey);
        return ia !== ib ? ia - ib : a.name.localeCompare(b.name);
      });
  }, [rawMaterials, purchases, consumptions, materialSales, date, today]);

  // Product rows (one row per stage/department, summed KGs)
  const productRows = useMemo(() => {
    const stageWeights: Record<string, number> = {};
    activeRollsAtD.forEach((roll) => {
      const stage = roll.current_stage || "loom";
      stageWeights[stage] = (stageWeights[stage] ?? 0) + Number(roll.weight || 0);
    });

    const getStageDefaultPrice = (stage: string): number => {
      const firstRoll = activeRollsAtD.find((r) => (r.current_stage || "loom") === stage);
      if (!firstRoll) return 0;
      const fab = fabricTypes.find((f) => f.id === firstRoll.fabric_type_id);
      return Number(fab?.selling_price || 0);
    };

    return Object.entries(stageWeights)
      .filter(([, w]) => w > 0)
      .map(([stage, weight]) => ({
        key: `prod-${stage}`,
        departmentKey: getStageDeptKey(stage),
        departmentLabel: getDeptLabel(getStageDeptKey(stage)),
        name: getProdStageName(stage),
        stock: Math.floor(weight),
        defaultPrice: getStageDefaultPrice(stage),
        isProduct: true,
      }))
      .sort((a, b) => DEPT_ORDER.indexOf(a.departmentKey) - DEPT_ORDER.indexOf(b.departmentKey));
  }, [activeRollsAtD, fabricTypes]);

  // WIP:
  // Stock = RM Stock + Production Stock (all active rolls KGs)
  const wipData = useMemo(() => {
    const totalPurchaseQty = purchases
      .filter((p) => p.purchase_date <= date)
      .reduce((s, p) => s + Number(p.quantity), 0);

    const totalPurchaseAmt = purchases
      .filter((p) => p.purchase_date <= date)
      .reduce((s, p) => s + Number(p.total_amount), 0);

    // Sales Entry: confirmed roll weights sold up to D
    const soldRollWeightsUpToD = rolls
      .filter((roll) => {
        const soldDate = rollIdToSoldDate[roll.id];
        return soldDate && soldDate <= date;
      })
      .reduce((s, r) => s + Number(r.weight || 0), 0);

    // Stock = RM stock + Production stock (all active rolls at D)
    const totalRmStock = rmRows.reduce((s, r) => s + r.stock, 0);
    const totalProductionStock = activeRollsAtD.reduce((s, r) => s + Number(r.weight || 0), 0);
    const totalStock = totalRmStock + totalProductionStock;

    // Waste Sale
    const wasteSaleQty = materialSales
      .filter((m) => m.type === "waste" && m.sale_date <= date)
      .reduce((s, m) => s + Number(m.quantity), 0);

    // RM Sale
    const rmSaleQty = materialSales
      .filter((m) => m.type === "raw_material" && m.sale_date <= date)
      .reduce((s, m) => s + Number(m.quantity), 0);

    const wipKgs = Math.max(
      0,
      totalPurchaseQty - (soldRollWeightsUpToD + totalStock + wasteSaleQty + rmSaleQty)
    );

    const wipDefaultPrice = totalPurchaseQty > 0 ? totalPurchaseAmt / totalPurchaseQty : 0;

    return {
      stock: Math.floor(wipKgs),
      defaultPrice: wipDefaultPrice,
      breakdown: {
        purchases: Math.floor(totalPurchaseQty),
        sales: Math.floor(soldRollWeightsUpToD),
        stock: Math.floor(totalStock),
        waste: Math.floor(wasteSaleQty),
        rmSales: Math.floor(rmSaleQty),
      }
    };
  }, [purchases, rolls, rmRows, activeRollsAtD, materialSales, date, rollIdToSoldDate]);

  const allRows = useMemo(() => [...rmRows, ...productRows], [rmRows, productRows]);

  const groupedRows = useMemo(() => {
    const groups: Record<string, typeof allRows> = {};
    allRows.forEach((row) => {
      if (!groups[row.departmentKey]) groups[row.departmentKey] = [];
      groups[row.departmentKey].push(row);
    });
    return DEPT_ORDER
      .filter((k) => groups[k]?.length)
      .map((k) => ({ deptKey: k, deptLabel: getDeptLabel(k), rows: groups[k] }));
  }, [allRows]);

  // Live totals
  const totals = useMemo(() => {
    let stockBase = 0;
    allRows.forEach((row) => {
      stockBase += row.stock * getPrice(row.key, row.defaultPrice);
    });
    const wipAmount = wipData.stock * getPrice("wip", wipData.defaultPrice);
    const baseTotal = stockBase + wipAmount;
    const gstAmount = baseTotal * 0.18;
    const grandTotal = baseTotal * 1.18;
    return { stockBase, wipAmount, baseTotal, gstAmount, grandTotal };
  }, [allRows, customPrices, wipData]);

  const displayDate = new Date(date + "T00:00:00").toLocaleDateString("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });

  const handleSubmit = async () => {
    setIsSaving(true);
    try {
      const pricesToSave: Record<string, number> = {};
      allRows.forEach((row) => {
        pricesToSave[row.key] = getPrice(row.key, row.defaultPrice);
      });
      pricesToSave["wip"] = getPrice("wip", wipData.defaultPrice);

      await saveClosingStock(
        date,
        pricesToSave,
        totals.baseTotal,
        totals.wipAmount,
        totals.gstAmount,
        totals.grandTotal
      );

      setSubmitted(true);
      router.refresh();
    } catch (err: any) {
      alert("Failed to submit closing stock: " + err.message);
    } finally {
      setIsSaving(false);
    }
  };

  return (

    <div className="space-y-6 pb-10">
      <PageHeader
        title="Closing Stock"
        description="Department-wise stock valuation with Work In Progress (WIP) and GST-inclusive grand total."
      />

      {/* Date Selector */}
      <div className="flex items-center gap-3 bg-white border border-slate-200 rounded-lg px-4 py-3 shadow-sm w-fit">
        <Label htmlFor="date-select" className="font-semibold text-sm text-slate-700 shrink-0">
          Select Stock Date:
        </Label>
        <Input
          id="date-select"
          type="date"
          value={date}
          onChange={(e) => handleDateChange(e.target.value)}
          className="w-44 h-9 text-sm border-slate-200 shadow-none"
        />
      </div>

      {/* Main Stock Table */}
      <div className="bg-white rounded-lg border border-slate-200 shadow-sm overflow-hidden">
        {/* Table Header */}
        <div className="flex items-center justify-between px-5 py-3 border-b border-slate-200 bg-slate-50">
          <div>
            <h2 className="font-bold text-slate-800 text-sm uppercase tracking-wider">
              Closing Stock — Department Wise
            </h2>
            <p className="text-xs text-slate-500 mt-0.5">As on {displayDate}</p>
          </div>
        </div>

        <Table>
          <TableHeader>
            <TableRow className="bg-slate-100 border-b border-slate-200">
              <TableHead className="font-bold text-slate-700 text-xs uppercase w-40">Department</TableHead>
              <TableHead className="font-bold text-slate-700 text-xs uppercase">RM &amp; Product</TableHead>
              <TableHead className="font-bold text-slate-700 text-xs uppercase text-right w-36">Stock (Kgs)</TableHead>
              <TableHead className="font-bold text-slate-700 text-xs uppercase text-right w-36">Price (₹/Kg)</TableHead>
              <TableHead className="font-bold text-slate-700 text-xs uppercase text-right w-40">Amount (₹)</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {groupedRows.length === 0 ? (
              <TableRow>
                <TableCell colSpan={5} className="text-center py-16 text-slate-400 text-sm">
                  No stock items found for this date.
                </TableCell>
              </TableRow>
            ) : (
              groupedRows.map(({ deptKey, deptLabel, rows }) => {
                const deptTotal = rows.reduce((s, r) => s + r.stock * getPrice(r.key, r.defaultPrice), 0);
                return (
                  <>
                    {/* Department Header */}
                    <TableRow key={`dept-${deptKey}`} className="bg-slate-50 border-t border-slate-200 hover:bg-slate-50">
                      <TableCell colSpan={5} className="py-1.5 px-4 text-xs font-bold uppercase tracking-widest text-slate-500">
                        {deptLabel}
                      </TableCell>
                    </TableRow>

                    {/* Item Rows */}
                    {rows.map((row) => {
                      const price = getPrice(row.key, row.defaultPrice);
                      const amount = row.stock * price;
                      return (
                        <TableRow key={row.key} className="border-b border-slate-100 hover:bg-slate-50/50">
                          <TableCell className="py-2.5 pl-8 text-xs text-slate-500">
                            {row.isProduct ? "Product" : "Raw Material"}
                          </TableCell>
                          <TableCell className="py-2.5 text-sm font-semibold text-slate-800">
                            {row.name}
                          </TableCell>
                          <TableCell className="py-2.5 text-right text-sm font-semibold text-slate-900">
                            {formatNumber(row.stock, 0)}
                          </TableCell>
                          <TableCell className="py-2 text-right">
                            <Input
                              type="number"
                              min="0"
                              step="any"
                              className="w-28 h-7 text-right text-sm py-0 px-2 border border-slate-200 rounded bg-white font-semibold ml-auto shadow-none"
                              value={
                                customPrices[row.key] !== undefined
                                  ? customPrices[row.key]
                                  : row.defaultPrice > 0
                                  ? row.defaultPrice.toFixed(2)
                                  : ""
                              }
                              placeholder="0.00"
                              onChange={(e) => setPrice(row.key, e.target.value)}
                            />
                          </TableCell>
                          <TableCell className="py-2.5 text-right text-sm font-semibold text-slate-900">
                            {amount > 0 ? `₹${formatNumber(amount, 0)}` : "—"}
                          </TableCell>
                        </TableRow>
                      );
                    })}

                    {/* Department Subtotal */}
                    <TableRow key={`subtotal-${deptKey}`} className="bg-slate-50 border-b border-slate-200 hover:bg-slate-50">
                      <TableCell colSpan={4} className="py-2 text-xs font-bold text-slate-600 text-right uppercase">
                        {deptLabel} Subtotal
                      </TableCell>
                      <TableCell className="py-2 text-right text-sm font-bold text-slate-800">
                        {deptTotal > 0 ? `₹${formatNumber(deptTotal, 0)}` : "—"}
                      </TableCell>
                    </TableRow>
                  </>
                );
              })
            )}

            {/* WIP Section Header */}
            <TableRow className="bg-amber-50 border-t border-amber-200 hover:bg-amber-50">
              <TableCell colSpan={5} className="py-1.5 px-4 text-xs font-bold uppercase tracking-widest text-amber-700">
                Work In Progress (WIP)
              </TableCell>
            </TableRow>

            {/* WIP Row */}
            <TableRow className="border-b border-slate-200 hover:bg-slate-50/50">
              <TableCell className="py-2.5 pl-8 text-xs text-slate-500">WIP</TableCell>
              <TableCell className="py-2.5 text-sm font-semibold text-slate-800">
                Work In Progress
              </TableCell>
              <TableCell className="py-2.5 text-right text-sm font-semibold text-slate-900">
                {formatNumber(wipData.stock, 0)}
              </TableCell>
              <TableCell className="py-2 text-right">
                <Input
                  type="number"
                  min="0"
                  step="any"
                  className="w-28 h-7 text-right text-sm py-0 px-2 border border-slate-200 rounded bg-white font-semibold ml-auto shadow-none"
                  value={
                    customPrices["wip"] !== undefined
                      ? customPrices["wip"]
                      : wipData.defaultPrice > 0
                      ? wipData.defaultPrice.toFixed(2)
                      : ""
                  }
                  placeholder="0.00"
                  onChange={(e) => setPrice("wip", e.target.value)}
                />
              </TableCell>
              <TableCell className="py-2.5 text-right text-sm font-semibold text-slate-900">
                {totals.wipAmount > 0 ? `₹${formatNumber(totals.wipAmount, 0)}` : "—"}
              </TableCell>
            </TableRow>

            {/* WIP Breakdown Rows */}
            <TableRow className="bg-slate-50/30 text-[11px] hover:bg-slate-50/30 border-b border-slate-100/50">
              <TableCell className="py-1.5 pl-10 text-slate-500 font-medium" colSpan={2}>
                (+) Total Purchases
              </TableCell>
              <TableCell className="py-1.5 text-right text-slate-600 font-mono">
                {formatNumber(wipData.breakdown.purchases, 0)} Kgs
              </TableCell>
              <TableCell colSpan={2}></TableCell>
            </TableRow>
            <TableRow className="bg-slate-50/30 text-[11px] hover:bg-slate-50/30 border-b border-slate-100/50">
              <TableCell className="py-1.5 pl-10 text-slate-500 font-medium" colSpan={2}>
                (−) Sales Delivery (Sold Rolls)
              </TableCell>
              <TableCell className="py-1.5 text-right text-slate-600 font-mono">
                {formatNumber(wipData.breakdown.sales, 0)} Kgs
              </TableCell>
              <TableCell colSpan={2}></TableCell>
            </TableRow>
            <TableRow className="bg-slate-50/30 text-[11px] hover:bg-slate-50/30 border-b border-slate-100/50">
              <TableCell className="py-1.5 pl-10 text-slate-500 font-medium" colSpan={2}>
                (−) Current Stock (RM &amp; Products)
              </TableCell>
              <TableCell className="py-1.5 text-right text-slate-600 font-mono">
                {formatNumber(wipData.breakdown.stock, 0)} Kgs
              </TableCell>
              <TableCell colSpan={2}></TableCell>
            </TableRow>
            <TableRow className="bg-slate-50/30 text-[11px] hover:bg-slate-50/30 border-b border-slate-100/50">
              <TableCell className="py-1.5 pl-10 text-slate-500 font-medium" colSpan={2}>
                (−) Waste Sales
              </TableCell>
              <TableCell className="py-1.5 text-right text-slate-600 font-mono">
                {formatNumber(wipData.breakdown.waste, 0)} Kgs
              </TableCell>
              <TableCell colSpan={2}></TableCell>
            </TableRow>
            <TableRow className="bg-slate-50/30 text-[11px] hover:bg-slate-50/30 border-b border-slate-100/50">
              <TableCell className="py-1.5 pl-10 text-slate-500 font-medium" colSpan={2}>
                (−) RM Sales
              </TableCell>
              <TableCell className="py-1.5 text-right text-slate-600 font-mono">
                {formatNumber(wipData.breakdown.rmSales, 0)} Kgs
              </TableCell>
              <TableCell colSpan={2}></TableCell>
            </TableRow>

            {/* Base Total */}
            <TableRow className="bg-slate-50 border-t border-slate-200 hover:bg-slate-50">
              <TableCell colSpan={4} className="py-2.5 text-sm font-bold text-slate-700 text-right uppercase">
                Base Stock Value
              </TableCell>
              <TableCell className="py-2.5 text-right text-sm font-bold text-slate-900">
                ₹{formatNumber(totals.baseTotal, 0)}
              </TableCell>
            </TableRow>

            {/* GST */}
            <TableRow className="bg-slate-50 border-b border-slate-200 hover:bg-slate-50">
              <TableCell colSpan={4} className="py-2.5 text-sm font-bold text-slate-700 text-right uppercase">
                GST Component (18%)
              </TableCell>
              <TableCell className="py-2.5 text-right text-sm font-bold text-slate-900">
                ₹{formatNumber(totals.gstAmount, 0)}
              </TableCell>
            </TableRow>

            {/* Grand Total */}
            <TableRow className="border-t-2 border-slate-300 bg-slate-100 hover:bg-slate-100">
              <TableCell colSpan={4} className="py-3 text-sm font-black text-slate-900 text-right uppercase tracking-wide">
                Grand Total (Incl. GST)
              </TableCell>
              <TableCell className="py-3 text-right text-base font-black text-slate-900">
                ₹{formatNumber(totals.grandTotal, 0)}
              </TableCell>
            </TableRow>
          </TableBody>
        </Table>

        {/* Submit Button */}
        <div className="flex justify-end px-5 py-4 border-t border-slate-200 bg-white">
          {submitted ? (
            <div className="flex items-center gap-4">
              <span className="text-sm font-semibold text-emerald-600">✓ Submitted successfully</span>
              <Button onClick={handleSubmit} disabled={isSaving} variant="outline" className="px-8 border-slate-200">
                {isSaving ? "Updating..." : "Update Submission"}
              </Button>
            </div>
          ) : (
            <Button
              onClick={handleSubmit}
              disabled={isSaving}
              className="px-8"
            >
              {isSaving ? "Submitting..." : "Submit"}
            </Button>
          )}
        </div>

      </div>
    </div>
  );
}
