"use client";

import { useState } from "react";
import { saveStageProduction } from "@/app/(app)/_actions";
import { ConfirmSubmitButton } from "@/components/app/confirm-submit-button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

type RollOption = { id: string; roll_number: string };
type ProductOption = { id: string; label: string };
type ColorOption = { id: string; color_name: string };

type StageProductionFormProps = {
  stage: "roto_printing" | "lamination" | "offset_printing" | "finishing";
  rolls: RollOption[];
  rotoProducts?: ProductOption[];
  rotoColors?: ColorOption[];
  offsetProducts?: ProductOption[];
  row?: Record<string, any>;
};

export function StageProductionForm({
  stage,
  rolls,
  rotoProducts = [],
  rotoColors = [],
  offsetProducts = [],
  row,
}: StageProductionFormProps) {
  const [isSaving, setIsSaving] = useState(false);
  const [errorText, setErrorText] = useState<string | null>(null);

  const [rollId, setRollId] = useState(row?.roll_id ?? "");
  const [productId, setProductId] = useState(row?.product_id ?? "");
  const [colorId, setColorId] = useState(row?.details?.color_id ?? "");
  const [cylinders, setCylinders] = useState(row?.details?.cylinders == null ? "" : String(row.details.cylinders));
  const [adhesive, setAdhesive] = useState(row?.details?.adhesive ?? "");
  const [packaging, setPackaging] = useState(row?.details?.packaging ?? "");

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (isSaving) return;
    setIsSaving(true);
    setErrorText(null);
    try {
      const formData = new FormData(event.currentTarget);
      if (row?.id) {
        formData.set("id", row.id);
      }
      formData.set("stage", stage);
      await saveStageProduction(formData);

      if (!row?.id) {
        setRollId("");
        setProductId("");
        setColorId("");
        setCylinders("");
        setAdhesive("");
        setPackaging("");
      }
    } catch (err: any) {
      setErrorText(err.message || "Failed to save production entry.");
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="grid gap-4 md:grid-cols-2 lg:grid-cols-4 items-end">
      {row?.id && <input type="hidden" name="id" value={row.id} />}
      <input type="hidden" name="stage" value={stage} />

      <div className="space-y-2">
        <Label>Roll Number</Label>
        <select
          name="roll_id"
          value={rollId}
          onChange={(e) => setRollId(e.target.value)}
          required
          disabled={isSaving}
          className="h-10 w-full rounded-md border bg-background px-3 text-sm focus:outline-none focus:ring-1 focus:ring-primary"
        >
          <option value="" disabled>Select roll</option>
          {row?.roll_id && row?.fabric_rolls?.roll_number && (
            <option value={row.roll_id}>{row.fabric_rolls.roll_number} (Current)</option>
          )}
          {[...rolls]
            .sort((a, b) => {
              const aNum = parseInt(a.roll_number, 10);
              const bNum = parseInt(b.roll_number, 10);
              if (isNaN(aNum) && isNaN(bNum)) return a.roll_number.localeCompare(b.roll_number);
              if (isNaN(aNum)) return 1;
              if (isNaN(bNum)) return -1;
              return aNum - bNum;
            })
            .map((r) => (
              <option key={r.id} value={r.id}>
                {r.roll_number}
              </option>
            ))}
        </select>
      </div>

      <div className="space-y-2">
        <Label>Entry Date</Label>
        <Input
          name="entry_date"
          type="date"
          required
          defaultValue={row?.entry_date ?? new Date().toISOString().slice(0, 10)}
          disabled={isSaving}
        />
      </div>

      {stage === "roto_printing" && (
        <>
          <div className="space-y-2">
            <Label>Roto Product</Label>
            <select
              name="product_id"
              value={productId}
              onChange={(e) => setProductId(e.target.value)}
              required
              disabled={isSaving}
              className="h-10 w-full rounded-md border bg-background px-3 text-sm focus:outline-none focus:ring-1 focus:ring-primary"
            >
              <option value="" disabled>Select Roto Product</option>
              {rotoProducts.map((p) => (
                <option key={p.id} value={p.id}>{p.label}</option>
              ))}
            </select>
          </div>

          <div className="space-y-2">
            <Label>Color</Label>
            <select
              name="color_id"
              value={colorId}
              onChange={(e) => setColorId(e.target.value)}
              required
              disabled={isSaving}
              className="h-10 w-full rounded-md border bg-background px-3 text-sm focus:outline-none focus:ring-1 focus:ring-primary"
            >
              <option value="" disabled>Select Color</option>
              {rotoColors.map((c) => (
                <option key={c.id} value={c.id}>{c.color_name}</option>
              ))}
            </select>
          </div>

          <div className="space-y-2">
            <Label>Cylinders Count</Label>
            <Input
              name="cylinders"
              type="number"
              required
              value={cylinders}
              onChange={(e) => setCylinders(e.target.value)}
              placeholder="e.g. 6"
              disabled={isSaving}
            />
          </div>
        </>
      )}

      {stage === "offset_printing" && (
        <div className="space-y-2">
          <Label>Offset Product</Label>
          <select
            name="product_id"
            value={productId}
            onChange={(e) => setProductId(e.target.value)}
            required
            disabled={isSaving}
            className="h-10 w-full rounded-md border bg-background px-3 text-sm focus:outline-none focus:ring-1 focus:ring-primary"
          >
            <option value="" disabled>Select Offset Product</option>
            {offsetProducts.map((p) => (
              <option key={p.id} value={p.id}>{p.label}</option>
            ))}
          </select>
        </div>
      )}

      {stage === "lamination" && (
        <>
          <div className="space-y-2">
            <Label>Lamination Film</Label>
            <select
              name="product_id"
              value={productId}
              onChange={(e) => setProductId(e.target.value)}
              required
              disabled={isSaving}
              className="h-10 w-full rounded-md border bg-background px-3 text-sm focus:outline-none focus:ring-1 focus:ring-primary"
            >
              <option value="" disabled>Select Film</option>
              <option value="lam-film-25">Laminated Film 2.5 mil</option>
              <option value="lam-film-30">Laminated Film 3.0 mil</option>
            </select>
          </div>

          <div className="space-y-2">
            <Label>Adhesive Details</Label>
            <Input
              name="adhesive"
              required
              value={adhesive}
              onChange={(e) => setAdhesive(e.target.value)}
              placeholder="e.g. Solventless Polyurethane"
              disabled={isSaving}
            />
          </div>
        </>
      )}

      {stage === "finishing" && (
        <>
          <div className="space-y-2">
            <Label>Finishing Bag Type</Label>
            <select
              name="product_id"
              value={productId}
              onChange={(e) => setProductId(e.target.value)}
              required
              disabled={isSaving}
              className="h-10 w-full rounded-md border bg-background px-3 text-sm focus:outline-none focus:ring-1 focus:ring-primary"
            >
              <option value="" disabled>Select Bag Type</option>
              <option value="finished-bags-28">Finished Bags W-28</option>
              <option value="finished-bags-32">Finished Bags W-32</option>
            </select>
          </div>

          <div className="space-y-2">
            <Label>Packaging / Box size</Label>
            <Input
              name="packaging"
              required
              value={packaging}
              onChange={(e) => setPackaging(e.target.value)}
              placeholder="e.g. Box of 500 bags"
              disabled={isSaving}
            />
          </div>
        </>
      )}

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

      <div className="md:col-span-2 lg:col-span-4 flex flex-col gap-2">
        {errorText && <p className="text-sm text-destructive">{errorText}</p>}
        <ConfirmSubmitButton
          confirmTitle={row?.id ? "Save production entry?" : "Create stage production entry?"}
          confirmDescription="Confirm the roll and details before logging production."
          disabled={isSaving}
        >
          {isSaving ? "Saving..." : (row?.id ? "Save Changes" : "Log Stage Production")}
        </ConfirmSubmitButton>
      </div>
    </form>
  );
}
