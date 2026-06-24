"use client";

import { useMemo, useState } from "react";
import { saveProduction } from "@/app/(app)/_actions";
import { ConfirmSubmitButton } from "@/components/app/confirm-submit-button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

type Option = { id: string; label: string };

export function ProductionForm({
  fabrics,
  looms,
  lastMeters,
  nextSerials,
  isAdmin,
  row,
  onSaved,
}: {
  fabrics: Option[];
  looms: Option[];
  lastMeters: Record<string, number>;
  nextSerials?: Record<string, string>;
  isAdmin: boolean;
  row?: Record<string, any>;
  onSaved?: () => void;
}) {
  const defaultFabric = row?.fabric_type_id ?? "";
  const defaultLoom = row?.loom_id ?? "";
  const [fabricId, setFabricId] = useState(defaultFabric);
  const [loomId, setLoomId] = useState(defaultLoom);

  // Controlled inputs: Initialize as string to prevent stale number persistence.
  const [gross, setGross] = useState(row?.gross_weight == null ? "" : String(row.gross_weight));
  const [core, setCore] = useState(row?.core_weight == null ? "" : String(row.core_weight));
  const [endMeters, setEndMeters] = useState(row?.end_meters == null ? "" : String(Math.floor(row.end_meters)));

  const [initialMetersInput, setInitialMetersInput] = useState(row?.initial_meters == null ? "" : String(Math.floor(row.initial_meters)));
  const [isSaving, setIsSaving] = useState(false);
  const [errorText, setErrorText] = useState<string | null>(null);

  const derivedInitialMeters = Math.floor(Number(lastMeters[loomId] ?? 0));
  const isOriginalLoom = row && loomId === row.loom_id;
  const initialMetersValue = isOriginalLoom
    ? (isAdmin ? (initialMetersInput !== "" ? initialMetersInput : String(Math.floor(row.initial_meters ?? 0))) : String(Math.floor(row.initial_meters ?? 0)))
    : (isAdmin ? (initialMetersInput || String(derivedInitialMeters)) : String(derivedInitialMeters));
  const initialMeters = Math.floor(Number(initialMetersValue));

  const netWeight = Math.max(Number(gross || 0) - Number(core || 0), 0);
  const netMeters = Math.max(Number(endMeters || 0) - initialMeters, 0);
  const avg = netMeters > 0 ? (netWeight / netMeters) * 1000 : 0;
  const nextSerial = row?.serial_number
    ? row.serial_number
    : (fabricId && nextSerials ? (nextSerials[fabricId] ?? "1") : "Select fabric");

  const summary = useMemo(() => ({ netWeight, netMeters: Math.floor(netMeters), avg: Math.floor(avg) }), [netWeight, netMeters, avg]);

  const confirmSummary = useMemo(() => {
    return [
      { label: "FABRIC ID", value: fabrics.find((f) => f.id === fabricId)?.label ?? "" },
      { label: "S. No", value: String(nextSerial) },
      { label: "GROSS WEIGHT", value: String(gross) },
      { label: "CORE WEIGHT", value: String(core) },
      { label: "NET WEIGHT", value: String(netWeight) },
      { label: "NET METERS", value: String(Math.floor(netMeters)) },
      { label: "AVERAGE METER WEIGHT", value: String(Math.floor(avg)) },
    ];
  }, [fabrics, fabricId, nextSerial, gross, core, netWeight, netMeters, avg]);

  // Handles client-side submission of server action saving the production record.
  // This allows loaders, disables double submissions, and resets stale input values.
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
      await saveProduction(formData);

      // Reset the form state upon successful submission (only for creating new records)
      if (!row?.id) {
        setFabricId("");
        setLoomId("");
        setGross("");
        setCore("");
        setEndMeters("");
        setInitialMetersInput("");
      }

      // Notify parent (e.g. dialog) that save succeeded
      onSaved?.();
    } catch (err: any) {
      setErrorText(err.message || "Failed to save production entry.");
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="grid gap-4 md:grid-cols-3">
      {row?.id ? <input type="hidden" name="id" value={row.id} /> : null}
      <div className="space-y-2">
        <Label>Fabric ID</Label>
        <select name="fabric_type_id" value={fabricId} onChange={(event) => setFabricId(event.target.value)} required disabled={isSaving} className="h-10 w-full rounded-md border bg-background px-3 text-sm">
          <option value="" disabled>Select fabric</option>
          {fabrics.map((fabric) => <option key={fabric.id} value={fabric.id}>{fabric.label}</option>)}
        </select>
      </div>
      <div className="space-y-2">
        <Label>Loom ID</Label>
        <select
          name="loom_id"
          value={loomId}
          onChange={(event) => {
            const nextLoomId = event.target.value;
            setLoomId(nextLoomId);
            setInitialMetersInput(row && nextLoomId === row.loom_id ? String(row.initial_meters ? Math.floor(row.initial_meters) : "") : "");
          }}
          required
          disabled={isSaving}
          className="h-10 w-full rounded-md border bg-background px-3 text-sm"
        >
          <option value="" disabled>Select loom</option>
          {looms.map((loom) => <option key={loom.id} value={loom.id}>{loom.label}</option>)}
        </select>
      </div>
      <div className="rounded-md border border-emerald-200 bg-emerald-50 p-3 text-sm">
        <div className="text-emerald-700">{row?.id ? "Current S.No" : "Next S.No"}</div>
        <div className="text-xl font-bold text-emerald-950">{nextSerial}</div>
      </div>
      <div className="space-y-2">
        <Label>Initial Meters</Label>
        <Input name="initial_meters" type="number" step="1" value={initialMetersValue} readOnly={!isAdmin} disabled={isSaving} onChange={(event) => setInitialMetersInput(event.target.value)} />
      </div>
      <div className="space-y-2">
        <Label>Gross Weight</Label>
        <Input name="gross_weight" type="number" step="0.01" value={gross} required disabled={isSaving} onChange={(event) => setGross(event.target.value)} />
      </div>
      <div className="space-y-2">
        <Label>Core Weight</Label>
        <Input name="core_weight" type="number" step="0.01" value={core} required disabled={isSaving} onChange={(event) => setCore(event.target.value)} />
      </div>
      <div className="space-y-2">
        <Label>End Meters</Label>
        <Input name="end_meters" type="number" step="1" value={endMeters} required disabled={isSaving} onChange={(event) => setEndMeters(event.target.value)} />
      </div>
      <div className="rounded-md border bg-muted/40 p-3 text-sm">
        <div className="text-muted-foreground">Net Weight</div>
        <div className="font-semibold">{summary.netWeight.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</div>
      </div>
      <div className="rounded-md border bg-muted/40 p-3 text-sm">
        <div className="text-muted-foreground">Net Meters</div>
        <div className="font-semibold">{summary.netMeters.toLocaleString("en-IN", { minimumFractionDigits: 0, maximumFractionDigits: 0 })}</div>
      </div>
      <div className="rounded-md border bg-muted/40 p-3 text-sm">
        <div className="text-muted-foreground">Average Meter Weight</div>
        <div className="font-semibold">{summary.avg.toLocaleString("en-IN", { minimumFractionDigits: 0, maximumFractionDigits: 0 })}</div>
      </div>
      <div className="md:col-span-3">
        {errorText ? <p className="mb-2 text-sm text-destructive">{errorText}</p> : null}
        <ConfirmSubmitButton
          confirmTitle={row?.id ? "Save production entry?" : "Create production entry?"}
          confirmDescription="Confirm the loom, fabric, weight, and meter readings before saving."
          summary={confirmSummary}
          disabled={isSaving}
        >
          {isSaving ? "Saving..." : (row?.id ? "Save Entry" : "Create Production Entry")}
        </ConfirmSubmitButton>
      </div>
    </form>
  );
}
