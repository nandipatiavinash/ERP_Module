"use client";

import { useRef, useState } from "react";
import { Trash2, Plus, PackagePlus } from "lucide-react";
import { saveRawMaterialPurchase } from "@/app/(app)/_actions";
import { ConfirmSubmitButton } from "@/components/app/confirm-submit-button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";

type MaterialOption = { id: string; material_name: string; unit: string };
type CustomerOption = { id: string; customer_name: string; alias?: string | null };

type PurchaseItem = {
  key: string;
  raw_material_id: string;
  material_label: string;
  unit: string;
  quantity: string;
  rate: string;
};

export function PurchaseForm({
  materials,
  customers,
}: {
  materials: MaterialOption[];
  customers: CustomerOption[];
}) {
  const formRef = useRef<HTMLFormElement>(null);
  // Confirmed items list (shown below input row)
  const [items, setItems] = useState<PurchaseItem[]>([]);
  const [isSaving, setIsSaving] = useState(false);
  const [errorText, setErrorText] = useState<string | null>(null);
  const [successText, setSuccessText] = useState<string | null>(null);

  // Current input row state
  const [draft, setDraft] = useState({
    raw_material_id: "",
    quantity: "",
    rate: "",
  });

  const selectedMaterial = materials.find((m) => m.id === draft.raw_material_id);

  const handleAddItem = () => {
    if (!draft.raw_material_id || !draft.quantity || !draft.rate) return;
    if (Number(draft.quantity) <= 0 || Number(draft.rate) <= 0) return;
    const mat = materials.find((m) => m.id === draft.raw_material_id);
    if (!mat) return;
    setItems((prev) => [
      ...prev,
      {
        key: `item-${Date.now()}-${Math.random()}`,
        raw_material_id: draft.raw_material_id,
        material_label: mat.material_name,
        unit: mat.unit && mat.unit !== "-" ? mat.unit : "",
        quantity: String(Math.round(Number(draft.quantity))),
        rate: draft.rate,
      },
    ]);
    // Reset draft to blank for next entry
    setDraft({ raw_material_id: "", quantity: "", rate: "" });
  };

  const handleRemoveItem = (key: string) => {
    setItems((prev) => prev.filter((item) => item.key !== key));
  };

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (isSaving || items.length === 0) return;

    setIsSaving(true);
    setErrorText(null);
    setSuccessText(null);

    try {
      const formData = new FormData(event.currentTarget);
      await saveRawMaterialPurchase(formData);
      setItems([]);
      setDraft({ raw_material_id: "", quantity: "", rate: "" });
      formRef.current?.reset();
      setSuccessText("Purchase saved successfully.");
    } catch (err: any) {
      setErrorText(err.message || "Failed to save purchase.");
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <form ref={formRef} onSubmit={handleSubmit} className="space-y-5">

      {/* Row 1: Purchase Date */}
      <div className="max-w-xs space-y-2">
        <Label>Purchase Date</Label>
        <Input
          name="purchase_date"
          type="date"
          required
          defaultValue={new Date().toISOString().slice(0, 10)}
        />
      </div>

      {/* Row 2: Client | Bill Number | Total Bill Value */}
      <div className="grid gap-4 sm:grid-cols-3">
        <div className="space-y-2">
          <Label>Client</Label>
          <select
            name="supplier_name"
            required
            className="h-10 w-full rounded-md border bg-background px-3 text-sm focus:outline-none focus:ring-1 focus:ring-primary"
            defaultValue=""
          >
            <option value="" disabled>Select client</option>
            {customers.map((customer) => (
              <option key={customer.id} value={customer.customer_name}>
                {customer.customer_name} {customer.alias ? `(${customer.alias})` : ""}
              </option>
            ))}
          </select>
        </div>

        <div className="space-y-2">
          <Label>Bill Number</Label>
          <Input name="bill_number" placeholder="Enter bill number" required />
        </div>

        <div className="space-y-2">
          <Label>Total Bill Value (incl. GST)</Label>
          <Input
            name="total_bill_value"
            type="number"
            step="0.01"
            min="0.01"
            required
            placeholder="Enter total bill amount"
          />
        </div>
      </div>

      {/* Row 3: Purchase Items */}
      <div className="space-y-3">
        <Label className="text-xs font-bold uppercase tracking-wider text-muted-foreground border-b pb-1 block">
          Purchase Items
        </Label>

        {/* --- Single input row: Material | Qty | Rate | + Add Item --- */}
        <div className="flex flex-wrap gap-3 items-end p-3 rounded-lg border bg-muted/10">
          {/* Material select */}
          <div className="flex-1 min-w-[160px] space-y-1">
            <Label className="text-xs">Raw Material</Label>
            <select
              value={draft.raw_material_id}
              onChange={(e) => setDraft((d) => ({ ...d, raw_material_id: e.target.value }))}
              className="h-10 w-full rounded-md border bg-background px-3 text-sm focus:outline-none focus:ring-1 focus:ring-primary"
            >
              <option value="" disabled>Select material</option>
              {materials.map((material) => (
                <option key={material.id} value={material.id}>
                  {material.material_name} ({material.unit})
                </option>
              ))}
            </select>
          </div>

          {/* Qty */}
          <div className="w-28 space-y-1">
            <Label className="text-xs">Qty {selectedMaterial ? `(${selectedMaterial.unit})` : ""}</Label>
            <Input
              type="number"
              step="1"
              min="1"
              placeholder="0"
              value={draft.quantity}
              onChange={(e) => setDraft((d) => ({ ...d, quantity: e.target.value }))}
            />
          </div>

          {/* Rate */}
          <div className="w-28 space-y-1">
            <Label className="text-xs">Rate (₹)</Label>
            <Input
              type="number"
              step="0.01"
              min="0.01"
              placeholder="0.00"
              value={draft.rate}
              onChange={(e) => setDraft((d) => ({ ...d, rate: e.target.value }))}
            />
          </div>

          {/* Add Item button */}
          <Button
            type="button"
            variant="default"
            onClick={handleAddItem}
            disabled={!draft.raw_material_id || Number(draft.quantity) <= 0 || Number(draft.rate) <= 0}
            className="h-10 gap-1.5 shrink-0"
          >
            <Plus className="h-4 w-4" /> Add Item
          </Button>
        </div>

        {/* --- Hidden inputs for confirmed items (submitted with form) --- */}
        {items.map((item) => (
          <input key={`hidden-${item.key}`} type="hidden" name="raw_material_id" value={item.raw_material_id} />
        ))}
        {items.map((item) => (
          <input key={`hidden-qty-${item.key}`} type="hidden" name="quantity" value={item.quantity} />
        ))}
        {items.map((item) => (
          <input key={`hidden-rate-${item.key}`} type="hidden" name="rate" value={item.rate} />
        ))}

        {/* --- Added items list (below input row) --- */}
        {items.length > 0 && (
          <div className="space-y-2">
            {/* Header row */}
            <div className="hidden sm:grid sm:grid-cols-[2fr_1fr_1fr_1fr_auto] gap-3 px-3 text-xs font-semibold text-muted-foreground uppercase tracking-wider">
              <span>Material</span>
              <span>Qty</span>
              <span>Rate (₹)</span>
              <span>Amount (₹)</span>
              <span></span>
            </div>
            {items.map((item, idx) => {
              const amount = (Number(item.quantity) || 0) * (Number(item.rate) || 0);
              return (
                <div
                  key={item.key}
                  className="grid grid-cols-[2fr_1fr_1fr_1fr_auto] gap-3 items-center px-3 py-2 rounded-md bg-muted/20 border text-sm"
                >
                  <span className="font-medium truncate">{idx + 1}. {item.material_label}</span>
                  <span>{Math.round(Number(item.quantity))}{item.unit ? ` ${item.unit}` : ""}</span>
                  <span>₹{item.rate}</span>
                  <span className="font-semibold">₹{amount.toFixed(2)}</span>
                  <button
                    type="button"
                    onClick={() => handleRemoveItem(item.key)}
                    className="text-muted-foreground hover:text-destructive transition-colors"
                    aria-label="Remove"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              );
            })}


          </div>
        )}

        {items.length === 0 && (
          <div className="flex flex-col items-center gap-2 py-6 text-muted-foreground text-sm">
            <PackagePlus className="h-8 w-8 opacity-40" />
            <span>No items added yet. Fill the row above and click <strong>Add Item</strong>.</span>
          </div>
        )}
      </div>

      {/* Remarks */}
      <div className="space-y-2">
        <Label>Remarks</Label>
        <Textarea name="remarks" placeholder="Optional remarks or notes about the purchase..." />
      </div>

      <div>
        {errorText ? <p className="mb-2 text-sm text-destructive">{errorText}</p> : null}
        {successText ? <p className="mb-2 text-sm font-medium text-emerald-700">{successText}</p> : null}
        <ConfirmSubmitButton
          confirmTitle="Save raw material purchase?"
          confirmDescription={`Confirm client, bill number, and items count (${items.length}) before saving.`}
          disabled={items.length === 0 || isSaving}
        >
          {isSaving ? "Saving..." : "Save Purchase"}
        </ConfirmSubmitButton>
      </div>
    </form>
  );
}
