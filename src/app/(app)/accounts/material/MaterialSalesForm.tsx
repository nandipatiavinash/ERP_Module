"use client";

import { useState, useRef } from "react";
import { Trash2 } from "lucide-react";
import { saveMaterialSalesEntry, deleteMaterialSalesEntry } from "@/app/(app)/_actions";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { EmptyState } from "@/components/ui/empty-state";
import { ConfirmSubmitButton } from "@/components/app/confirm-submit-button";
import { formatNumber } from "@/lib/utils";

type ClientOption = { id: string; customer_name: string; alias?: string | null };
type MaterialOption = { id: string; material_name: string; department: string; unit: string; current_stock: string | number };

type MaterialSalesFormProps = {
  clients: ClientOption[];
  rawMaterials: MaterialOption[];
  sales: any[];
  selectedDate: string;
};

export function MaterialSalesForm({
  clients,
  rawMaterials,
  sales,
  selectedDate,
}: MaterialSalesFormProps) {
  const formRef = useRef<HTMLFormElement>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [errorText, setErrorText] = useState<string | null>(null);
  const [successText, setSuccessText] = useState<string | null>(null);

  // Form states for dynamic amount calculation
  const [type, setType] = useState<"raw_material" | "waste">("raw_material");
  const [selectedDept, setSelectedDept] = useState<string>("");
  const [selectedMatId, setSelectedMatId] = useState<string>("");
  const [qty, setQty] = useState<string>("");
  const [price, setPrice] = useState<string>("");
  const [incGst, setIncGst] = useState<boolean>(false);

  // Filter raw materials based on selected department
  const filteredMaterials = rawMaterials.filter(
    (m) => m.department === selectedDept
  );

  const selectedMaterial = rawMaterials.find((m) => m.id === selectedMatId);

  // Dynamic calculations
  const parsedQty = Number(qty) || 0;
  const parsedPrice = Number(price) || 0;
  const baseAmount = parsedQty * parsedPrice;
  const gstAmount = incGst ? 0 : baseAmount * 0.18;
  const totalAmount = incGst ? baseAmount : baseAmount * 1.18;

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (isSaving) return;

    if (type === "raw_material" && selectedMaterial) {
      const availStock = Number(selectedMaterial.current_stock ?? 0);
      if (parsedQty > availStock) {
        setErrorText(`Cannot sell ${parsedQty}. Only ${availStock} is available in stock.`);
        return;
      }
    }

    setIsSaving(true);
    setErrorText(null);
    setSuccessText(null);

    try {
      const formData = new FormData(event.currentTarget);
      formData.set("inc_gst", String(incGst));
      formData.set("sale_date", selectedDate);

      await saveMaterialSalesEntry(formData);
      
      // Reset form states
      setQty("");
      setPrice("");
      setSelectedDept("");
      setSelectedMatId("");
      setIncGst(false);
      formRef.current?.reset();
      setSuccessText("Material sale saved successfully.");
    } catch (err: any) {
      setErrorText(err.message || "Failed to save material sale.");
    } finally {
      setIsSaving(false);
    }
  }

  async function handleDelete(id: string, journalNo: string | null) {
    if (!confirm("Are you sure you want to delete this sale? This will also remove the corresponding journal entries and adjust raw material stock.")) {
      return;
    }
    setErrorText(null);
    setSuccessText(null);
    try {
      const formData = new FormData();
      formData.append("id", id);
      if (journalNo) formData.append("journal_no", journalNo);
      await deleteMaterialSalesEntry(formData);
      setSuccessText("Sale entry deleted successfully.");
    } catch (err: any) {
      setErrorText(err.message || "Failed to delete sale.");
    }
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>New Material/Waste Sale</CardTitle>
        </CardHeader>
        <CardContent>
          <form ref={formRef} onSubmit={handleSubmit} className="space-y-5">
            {/* Client & Bill Details */}
            <div className="grid gap-4 sm:grid-cols-3">
              <div className="space-y-2">
                <Label htmlFor="customer_id">Client Account</Label>
                <select
                  id="customer_id"
                  name="customer_id"
                  required
                  className="h-10 w-full rounded-md border bg-background px-3 text-sm focus:outline-none focus:ring-1 focus:ring-primary"
                  defaultValue=""
                >
                  <option value="" disabled>Select client</option>
                  {clients.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.customer_name} {c.alias ? `(${c.alias})` : ""}
                    </option>
                  ))}
                </select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="bill_number">Bill Number</Label>
                <Input
                  id="bill_number"
                  name="bill_number"
                  placeholder="Enter bill number"
                  required
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="type">Sale Type</Label>
                <select
                  id="type"
                  name="type"
                  required
                  value={type}
                  onChange={(e) => {
                    setType(e.target.value as "raw_material" | "waste");
                    // Reset conditional fields
                    setSelectedDept("");
                    setSelectedMatId("");
                  }}
                  className="h-10 w-full rounded-md border bg-background px-3 text-sm focus:outline-none focus:ring-1 focus:ring-primary"
                >
                  <option value="raw_material">Raw Material</option>
                  <option value="waste">Waste</option>
                </select>
              </div>
            </div>

            {/* Conditional Raw Material Selectors */}
            {type === "raw_material" && (
              <div className="grid gap-4 sm:grid-cols-2 p-4 rounded-lg border bg-slate-50/50">
                <div className="space-y-2">
                  <Label htmlFor="department">Department</Label>
                  <select
                    id="department"
                    name="department"
                    required={type === "raw_material"}
                    value={selectedDept}
                    onChange={(e) => {
                      setSelectedDept(e.target.value);
                      setSelectedMatId("");
                    }}
                    className="h-10 w-full rounded-md border bg-background bg-white px-3 text-sm focus:outline-none focus:ring-1 focus:ring-primary"
                  >
                    <option value="">Select department</option>
                    <option value="fabric">Fabric</option>
                    <option value="roto-printing">Roto Printing</option>
                    <option value="lamination">Lamination</option>
                    <option value="offset-printing">Off-set Printing</option>
                    <option value="finishing">Finishing</option>
                  </select>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="raw_material_id">Raw Material ID</Label>
                  <select
                    id="raw_material_id"
                    name="raw_material_id"
                    required={type === "raw_material"}
                    value={selectedMatId}
                    onChange={(e) => setSelectedMatId(e.target.value)}
                    disabled={!selectedDept}
                    className="h-10 w-full rounded-md border bg-background bg-white px-3 text-sm focus:outline-none focus:ring-1 focus:ring-primary disabled:opacity-50"
                  >
                    <option value="">Select raw material</option>
                    {filteredMaterials.map((m) => (
                      <option key={m.id} value={m.id}>
                        {m.material_name} {m.unit && m.unit !== "-" ? `(${m.unit})` : ""}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
            )}

            <div className="grid gap-4 sm:grid-cols-4 items-end">
              <div className="space-y-2">
                <Label htmlFor="quantity">
                  Quantity {selectedMaterial && selectedMaterial.unit !== "-" ? `(${selectedMaterial.unit})` : ""}
                </Label>
                <Input
                  id="quantity"
                  name="quantity"
                  type="number"
                  step="0.001"
                  min="0.001"
                  placeholder="0.000"
                  required
                  value={qty}
                  onChange={(e) => setQty(e.target.value)}
                />
                {type === "raw_material" && selectedMaterial && (
                  <div className="space-y-1">
                    <div className="text-xs text-muted-foreground">
                      Available: <span className="font-semibold text-slate-800">{formatNumber(selectedMaterial.current_stock, 3)}</span> {selectedMaterial.unit !== "-" ? selectedMaterial.unit : ""}
                    </div>
                    {parsedQty > Number(selectedMaterial.current_stock ?? 0) && (
                      <div className="text-xs text-destructive font-semibold">
                        Quantity exceeds available stock!
                      </div>
                    )}
                  </div>
                )}
              </div>

              <div className="space-y-2">
                <Label htmlFor="price">Price (₹)</Label>
                <Input
                  id="price"
                  name="price"
                  type="number"
                  step="0.01"
                  min="0"
                  placeholder="0.00"
                  required
                  value={price}
                  onChange={(e) => setPrice(e.target.value)}
                />
              </div>

              <div className="flex items-center gap-2 h-10 pb-2">
                <input
                  id="inc_gst"
                  type="checkbox"
                  checked={incGst}
                  onChange={(e) => setIncGst(e.target.checked)}
                  className="h-4.5 w-4.5 rounded border-gray-300 text-emerald-600 focus:ring-emerald-500 cursor-pointer"
                />
                <Label htmlFor="inc_gst" className="text-sm font-medium cursor-pointer">
                  Price Inclusive of GST
                </Label>
              </div>

              {/* Amount Calculations display */}
              <div className="p-3 rounded-lg border bg-slate-50 text-right space-y-0.5">
                <div className="text-[10px] uppercase font-bold text-slate-500">Calculated Amount</div>
                <div className="text-lg font-black text-slate-900">
                  ₹{formatNumber(totalAmount, 2)}
                </div>
                {!incGst && parsedQty > 0 && parsedPrice > 0 && (
                  <div className="text-[9px] text-muted-foreground">
                    (Base: ₹{formatNumber(baseAmount, 2)} + GST 18%: ₹{formatNumber(gstAmount, 2)})
                  </div>
                )}
                {incGst && parsedQty > 0 && parsedPrice > 0 && (
                  <div className="text-[9px] text-muted-foreground font-semibold text-emerald-700">
                    Inclusive of GST
                  </div>
                )}
              </div>
            </div>

            {/* Error and Success alerts */}
            <div>
              {errorText && <p className="mb-2 text-sm text-destructive">{errorText}</p>}
              {successText && <p className="mb-2 text-sm font-medium text-emerald-700">{successText}</p>}
              
              <ConfirmSubmitButton
                confirmTitle="Save Material Sale?"
                confirmDescription="This sale will directly post Debit/Credit lines into the accounts journal. Confirm bill details and client before posting."
                disabled={isSaving}
              >
                {isSaving ? "Saving..." : "Save Material Sale"}
              </ConfirmSubmitButton>
            </div>
          </form>
        </CardContent>
      </Card>

      {/* Material Sales List */}
      <Card>
        <CardHeader>
          <CardTitle>Sales Entries for {selectedDate}</CardTitle>
        </CardHeader>
        <CardContent>
          {sales.length === 0 ? (
            <EmptyState description="No material or waste sales entered for this date." />
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Bill No</TableHead>
                    <TableHead>Client Account</TableHead>
                    <TableHead>Type</TableHead>
                    <TableHead>Department</TableHead>
                    <TableHead>Material ID</TableHead>
                    <TableHead className="text-right">Qty</TableHead>
                    <TableHead className="text-right">Price</TableHead>
                    <TableHead className="text-right">GST</TableHead>
                    <TableHead className="text-right">Total Amount</TableHead>
                    <TableHead className="w-12 text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {sales.map((sale) => {
                    const clientName = sale.customers?.customer_name ?? "-";
                    const clientAlias = sale.customers?.alias;
                    const materialName = sale.raw_materials?.material_name ?? "-";
                    const rawUnit = sale.raw_materials?.unit;
                    const materialUnit = rawUnit && rawUnit !== "-" ? rawUnit : "";

                    return (
                      <TableRow key={sale.id}>
                        <TableCell className="font-bold text-emerald-950">
                          {sale.bill_number}
                        </TableCell>
                        <TableCell>
                          {clientName} {clientAlias ? `(${clientAlias})` : ""}
                        </TableCell>
                        <TableCell className="capitalize text-xs font-semibold">
                          {sale.type === "raw_material" ? "Raw Material" : "Waste"}
                        </TableCell>
                        <TableCell className="capitalize text-xs">
                          {sale.type === "raw_material" ? (sale.department || "-") : "-"}
                        </TableCell>
                        <TableCell className="text-xs">
                          {sale.type === "raw_material" ? materialName : "-"}
                        </TableCell>
                        <TableCell className="text-right font-medium">
                          {formatNumber(sale.quantity, 3)} {sale.type === "raw_material" ? materialUnit : "kg"}
                        </TableCell>
                        <TableCell className="text-right">
                          ₹{formatNumber(sale.price, 2)}
                        </TableCell>
                        <TableCell className="text-right text-xs">
                          {sale.inc_gst ? (
                            <span className="text-emerald-700 font-semibold bg-emerald-50 px-2 py-0.5 rounded-full">
                              Inc.
                            </span>
                          ) : (
                            "18%"
                          )}
                        </TableCell>
                        <TableCell className="text-right font-bold text-slate-900">
                          ₹{formatNumber(sale.amount, 2)}
                        </TableCell>
                        <TableCell className="text-right">
                          <button
                            type="button"
                            onClick={() => handleDelete(sale.id, sale.journal_no)}
                            className="text-muted-foreground hover:text-destructive transition-colors"
                            title="Delete entry"
                          >
                            <Trash2 className="h-4 w-4" />
                          </button>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
