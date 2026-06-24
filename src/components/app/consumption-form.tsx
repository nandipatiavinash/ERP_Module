"use client";

import { useState } from "react";
import { saveRawMaterialConsumption } from "@/app/(app)/_actions";
import { ConfirmSubmitButton } from "@/components/app/confirm-submit-button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { todayInIndia, formatNumber } from "@/lib/utils";

type MaterialOption = { id: string; material_name: string; unit: string; current_stock?: number };

type ConsumptionFormProps = {
  department: string;
  materials: MaterialOption[];
  row?: Record<string, any>;
};

export function ConsumptionForm({ department, materials, row }: ConsumptionFormProps) {
  const [isSaving, setIsSaving] = useState(false);
  const [errorText, setErrorText] = useState<string | null>(null);

  const defaultMaterial = row?.raw_material_id ?? "";
  const [materialId, setMaterialId] = useState(defaultMaterial);
  const [quantity, setQuantity] = useState(row?.quantity == null ? "" : String(row.quantity));

  const selectedMaterial = materials.find((m) => m.id === materialId);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (isSaving) return;
    const qtyNum = Number(quantity);
    if (isNaN(qtyNum) || qtyNum <= 0 || qtyNum % 25 !== 0) {
      setErrorText("Quantity must be a multiple of 25.");
      return;
    }
    setIsSaving(true);
    setErrorText(null);
    try {
      const formData = new FormData(event.currentTarget);
      if (row?.id) {
        formData.set("id", row.id);
      }
      formData.set("department", department);
      await saveRawMaterialConsumption(formData);

      if (!row?.id) {
        setMaterialId("");
        setQuantity("");
      }
    } catch (err: any) {
      setErrorText(err.message || "Failed to save consumption log.");
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="grid gap-4 md:grid-cols-2 lg:grid-cols-4 items-end">
      {row?.id && <input type="hidden" name="id" value={row.id} />}
      <input type="hidden" name="consumption_date" value={row?.consumption_date ?? todayInIndia()} />

      <div className="space-y-2">
        <Label>Raw Material</Label>
        <select
          name="raw_material_id"
          value={materialId}
          onChange={(e) => setMaterialId(e.target.value)}
          required
          disabled={isSaving}
          className="h-10 w-full rounded-md border bg-background px-3 text-sm focus:outline-none focus:ring-1 focus:ring-primary"
        >
          <option value="" disabled>Select material</option>
          {materials.map((m) => (
            <option key={m.id} value={m.id}>
              {m.material_name}
            </option>
          ))}
        </select>
      </div>

      <div className="space-y-2">
        <Label>Available Stock</Label>
        <Input
          type="text"
          readOnly
          disabled
          value={selectedMaterial ? formatNumber(Math.floor(Number(selectedMaterial.current_stock ?? 0)), 0) : "Select a material"}
          className="bg-muted font-medium"
        />
      </div>

      <div className="space-y-2">
        <Label>Quantity</Label>
        <Input
          name="quantity"
          type="number"
          step="0.01"
          required
          value={quantity}
          onChange={(e) => setQuantity(e.target.value)}
          placeholder="0.00"
          disabled={isSaving}
        />
      </div>

      <div className="space-y-2">
        <Label>Remarks</Label>
        <Textarea
          name="remarks"
          placeholder="Optional remarks..."
          defaultValue={row?.remarks ?? ""}
          rows={1}
          disabled={isSaving}
          className="min-h-10 h-10 resize-none py-2"
        />
      </div>

      <div className="md:col-span-2 lg:col-span-4 flex flex-col items-end gap-2">
        {errorText && <p className="text-sm text-destructive">{errorText}</p>}
        <ConfirmSubmitButton
          confirmTitle={row?.id ? "Save changes?" : "Submit consumption?"}
          confirmDescription="Confirm the material and quantity before submitting."
          disabled={isSaving}
          size="sm"
          className="rounded-full w-fit px-6 bg-emerald-600 hover:bg-emerald-700 text-white"
        >
          {isSaving ? "Saving..." : "Submit"}
        </ConfirmSubmitButton>
      </div>
    </form>
  );
}
