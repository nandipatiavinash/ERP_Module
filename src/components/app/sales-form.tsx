"use client";

import { useMemo, useState } from "react";
import { saveSale } from "@/app/(app)/_actions";
import { ConfirmSubmitButton } from "@/components/app/confirm-submit-button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { salesStatuses } from "@/lib/modules";

type Option = { id: string; label: string };
type Roll = { id: string; roll_number: string; fabric_type_id: string; meters: number; status: string };

export function SalesForm({ customers, fabrics, rolls, row }: { customers: Option[]; fabrics: Option[]; rolls: Roll[]; row?: Record<string, any> }) {
  const [fabricId, setFabricId] = useState(row?.fabric_type_id ?? "");
  const [quantity, setQuantity] = useState(Number(row?.quantity_meters ?? 0));
  const [rate, setRate] = useState(Number(row?.rate ?? 0));
  const selected = useMemo(() => new Set<string>(row?.selected_roll_ids ?? []), [row?.selected_roll_ids]);
  const filteredRolls = useMemo(() => rolls.filter((roll) => roll.fabric_type_id === fabricId || selected.has(roll.id)), [rolls, fabricId, selected]);

  return (
    <form action={saveSale} className="grid gap-4 md:grid-cols-3">
      {row?.id ? <input type="hidden" name="id" value={row.id} /> : null}
      <div className="space-y-2">
        <Label>Customer</Label>
        <select name="customer_id" defaultValue={row?.customer_id ?? ""} required className="h-10 w-full rounded-md border bg-background px-3 text-sm">
          <option value="" disabled>Select customer</option>
          {customers.map((customer) => <option key={customer.id} value={customer.id}>{customer.label}</option>)}
        </select>
      </div>
      <div className="space-y-2">
        <Label>Fabric Type</Label>
        <select name="fabric_type_id" value={fabricId} onChange={(event) => setFabricId(event.target.value)} required className="h-10 w-full rounded-md border bg-background px-3 text-sm">
          <option value="" disabled>Select fabric</option>
          {fabrics.map((fabric) => <option key={fabric.id} value={fabric.id}>{fabric.label}</option>)}
        </select>
      </div>
      <div className="space-y-2">
        <Label>Status</Label>
        <select name="status" defaultValue={row?.status ?? "draft"} className="h-10 w-full rounded-md border bg-background px-3 text-sm">
          {salesStatuses.map((status) => <option key={status.value} value={status.value}>{status.label}</option>)}
        </select>
      </div>
      <div className="space-y-2">
        <Label>Quantity</Label>
        <Input name="quantity_meters" type="number" step="0.01" defaultValue={row?.quantity_meters ?? ""} required onChange={(event) => setQuantity(Number(event.target.value))} />
      </div>
      <div className="space-y-2">
        <Label>Rate</Label>
        <Input name="rate" type="number" step="0.01" defaultValue={row?.rate ?? ""} required onChange={(event) => setRate(Number(event.target.value))} />
      </div>
      <div className="rounded-md border bg-muted/40 p-3 text-sm">
        <div className="text-muted-foreground">Total Amount</div>
        <div className="font-semibold">₹{(quantity * rate).toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</div>
      </div>
      <div className="space-y-2 md:col-span-3">
        <Label>Available Rolls</Label>
        <div className="grid gap-2 rounded-md border p-3 md:grid-cols-3">
          {filteredRolls.length === 0 ? <p className="text-sm text-muted-foreground">Select a fabric with available rolls.</p> : filteredRolls.map((roll) => (
            <label key={roll.id} className="flex items-center gap-2 text-sm">
              <input type="checkbox" name="selected_roll_ids" value={roll.id} defaultChecked={selected.has(roll.id)} />
              {roll.roll_number} - {Number(roll.meters).toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} m - {roll.status}
            </label>
          ))}
        </div>
      </div>
      <div className="md:col-span-3">
        <ConfirmSubmitButton confirmTitle={row?.id ? "Save sales order?" : "Create sales order?"} confirmDescription="Confirm customer, fabric, quantity, rate, and selected rolls before saving.">
          {row?.id ? "Save Order" : "Create Sales Order"}
        </ConfirmSubmitButton>
      </div>
    </form>
  );
}
