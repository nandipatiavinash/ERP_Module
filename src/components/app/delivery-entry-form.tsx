"use client";

import { useState } from "react";
import { Plus, Trash2, PackagePlus } from "lucide-react";
import { createSalesOrder } from "@/app/(app)/_actions";
import { ConfirmSubmitButton } from "@/components/app/confirm-submit-button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";

type Customer = { id: string; name: string; alias?: string | null };
type ProductOption = { id: string; label: string };

type DeliveryEntryFormProps = {
  customers: Customer[];
  fabricProducts: ProductOption[];
  rotoProducts: ProductOption[];
  offsetProducts: ProductOption[];
};

type ConfirmedRow = {
  key: string;
  department: string;
  departmentLabel: string;
  productId: string;
  productLabel: string;
  quantity: string;
};

const DEPT_LABELS: Record<string, string> = {
  fabric: "Fabric",
  "roto-printing": "Roto Printing",
  lamination: "Lamination",
  "offset-printing": "Off-set Printing",
  finishing: "Finishing",
};

export function DeliveryEntryForm({
  customers,
  fabricProducts,
  rotoProducts,
  offsetProducts,
}: DeliveryEntryFormProps) {
  const [confirmedRows, setConfirmedRows] = useState<ConfirmedRow[]>([]);
  const [isPending, setIsPending] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Draft (input row) state
  const [draft, setDraft] = useState({
    department: "fabric",
    productId: "",
    quantity: "",
  });

  const getProductOptions = (dept: string): ProductOption[] => {
    switch (dept) {
      case "fabric": return fabricProducts;
      case "roto-printing": return rotoProducts;
      case "offset-printing": return offsetProducts;
      case "lamination": return [
        { id: "lam-film-25", label: "Laminated Film 2.5 mil" },
        { id: "lam-film-30", label: "Laminated Film 3.0 mil" },
      ];
      case "finishing": return [
        { id: "finished-bags-28", label: "Finished Bags W-28" },
        { id: "finished-bags-32", label: "Finished Bags W-32" },
      ];
      default: return [];
    }
  };

  const draftOptions = getProductOptions(draft.department);
  const selectedProduct = draftOptions.find((p) => p.id === draft.productId);

  const handleDeptChange = (dept: string) => {
    setDraft({ department: dept, productId: "", quantity: "" });
  };

  const handleAddItem = () => {
    if (!draft.productId || !draft.quantity) return;
    const product = draftOptions.find((p) => p.id === draft.productId);
    if (!product) return;
    setConfirmedRows((prev) => [
      ...prev,
      {
        key: `row-${Date.now()}-${Math.random()}`,
        department: draft.department,
        departmentLabel: DEPT_LABELS[draft.department] ?? draft.department,
        productId: draft.productId,
        productLabel: product.label,
        quantity: draft.quantity,
      },
    ]);
    setDraft((d) => ({ ...d, productId: "", quantity: "" }));
  };

  const handleRemoveRow = (key: string) => {
    setConfirmedRows((prev) => prev.filter((r) => r.key !== key));
  };

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setErrorMsg(null);
    setIsPending(true);
    const form = e.currentTarget;
    const formData = new FormData(form);
    try {
      await createSalesOrder(formData);
      form.reset();
      setConfirmedRows([]);
      setDraft({ department: "fabric", productId: "", quantity: "" });
    } catch (err: any) {
      setErrorMsg(err.message || "Failed to create sales order.");
    } finally {
      setIsPending(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {errorMsg && (
        <div className="p-4 bg-red-100 text-red-800 rounded-lg text-sm font-semibold">
          {errorMsg}
        </div>
      )}

      {/* Firm & Date */}
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="customer_id">Firm Name</Label>
          <select
            id="customer_id"
            name="customer_id"
            required
            className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
          >
            <option value="" disabled>Select Firm</option>
            {customers.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name} {c.alias ? `(${c.alias})` : ""}
              </option>
            ))}
          </select>
        </div>

        <div className="space-y-2">
          <Label htmlFor="order_date">Order Date</Label>
          <Input
            id="order_date"
            name="order_date"
            type="date"
            required
            defaultValue={new Date().toISOString().slice(0, 10)}
          />
        </div>
      </div>

      {/* Order Items */}
      <div className="space-y-3">
        <Label className="text-xs font-bold uppercase tracking-wider text-muted-foreground border-b pb-1 block">
          Order Items
        </Label>

        {/* --- Single input row: Dept | Product | Qty | + Add Item --- */}
        <div className="flex flex-wrap gap-3 items-end p-3 rounded-lg border bg-muted/10">
          {/* Department */}
          <div className="flex-1 min-w-[130px] space-y-1">
            <Label className="text-xs">Department</Label>
            <select
              value={draft.department}
              onChange={(e) => handleDeptChange(e.target.value)}
              className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
            >
              {Object.entries(DEPT_LABELS).map(([val, lbl]) => (
                <option key={val} value={val}>{lbl}</option>
              ))}
            </select>
          </div>

          {/* Product */}
          <div className="flex-[2] min-w-[160px] space-y-1">
            <Label className="text-xs">Product ID / Type</Label>
            <select
              value={draft.productId}
              onChange={(e) => setDraft((d) => ({ ...d, productId: e.target.value }))}
              className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
            >
              <option value="" disabled>Select product</option>
              {draftOptions.map((opt) => (
                <option key={opt.id} value={opt.id}>{opt.label}</option>
              ))}
            </select>
          </div>

          {/* Quantity */}
          <div className="w-28 space-y-1">
            <Label className="text-xs">Qty (Kgs)</Label>
            <Input
              type="number"
              step="0.01"
              placeholder="e.g. 5000"
              value={draft.quantity}
              onChange={(e) => setDraft((d) => ({ ...d, quantity: e.target.value }))}
            />
          </div>

          {/* Add Item button */}
          <Button
            type="button"
            variant="default"
            onClick={handleAddItem}
            disabled={!draft.productId || !draft.quantity}
            className="h-10 gap-1.5 shrink-0"
          >
            <Plus className="h-4 w-4" /> Add Item
          </Button>
        </div>

        {/* Hidden inputs for confirmed rows */}
        {confirmedRows.map((row) => (
          <span key={row.key}>
            <input type="hidden" name="department" value={row.department} />
            <input type="hidden" name="product_id" value={row.productId} />
            <input type="hidden" name="quantity" value={row.quantity} />
          </span>
        ))}

        {/* Added items list */}
        {confirmedRows.length > 0 ? (
          <div className="space-y-2">
            {/* Header */}
            <div className="hidden sm:grid sm:grid-cols-[1fr_2fr_1fr_auto] gap-3 px-3 text-xs font-semibold text-muted-foreground uppercase tracking-wider">
              <span>Department</span>
              <span>Product</span>
              <span>Qty (Kgs)</span>
              <span></span>
            </div>
            {confirmedRows.map((row, idx) => (
              <div
                key={row.key}
                className="grid grid-cols-[1fr_2fr_1fr_auto] gap-3 items-center px-3 py-2 rounded-md bg-muted/20 border text-sm"
              >
                <span className="text-muted-foreground">{idx + 1}. {row.departmentLabel}</span>
                <span className="font-medium truncate">{row.productLabel}</span>
                <span>{row.quantity} kg</span>
                <button
                  type="button"
                  onClick={() => handleRemoveRow(row.key)}
                  className="text-muted-foreground hover:text-destructive transition-colors"
                  aria-label="Remove"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
            ))}
          </div>
        ) : (
          <div className="flex flex-col items-center gap-2 py-6 text-muted-foreground text-sm">
            <PackagePlus className="h-8 w-8 opacity-40" />
            <span>No items added yet. Fill the row above and click <strong>Add Item</strong>.</span>
          </div>
        )}
      </div>

      <div className="pt-2 border-t flex justify-end">
        <ConfirmSubmitButton
          disabled={isPending || confirmedRows.length === 0}
          confirmTitle="Place Sales Order?"
          confirmDescription="This will create the sales order and prepare it for delivery assignment."
        >
          {isPending ? "Placing Order..." : "Place Order"}
        </ConfirmSubmitButton>
      </div>
    </form>
  );
}
