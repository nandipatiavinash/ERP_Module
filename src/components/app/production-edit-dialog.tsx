"use client";

import { useState } from "react";
import { Pencil } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { ProductionForm } from "@/components/app/production-form";

type Option = { id: string; label: string };

interface ProductionEditDialogProps {
  row: Record<string, any>;
  fabrics: Option[];
  looms: Option[];
  lastMeters: Record<string, number>;
  nextSerials: Record<string, string>;
  isAdmin: boolean;
}

export function ProductionEditDialog({
  row,
  fabrics,
  looms,
  lastMeters,
  nextSerials,
  isAdmin,
}: ProductionEditDialogProps) {
  const [open, setOpen] = useState(false);

  return (
    <>
      <Button
        variant="outline"
        size="sm"
        className="gap-1.5 h-8"
        onClick={() => setOpen(true)}
      >
        <Pencil className="h-3.5 w-3.5" />
        Edit
      </Button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Edit Production Entry</DialogTitle>
            <DialogDescription>
              S.No: <span className="font-bold text-emerald-700">{row.serial_number}</span>
              {" — "}
              {row.fabric_types?.fabric_name}
            </DialogDescription>
          </DialogHeader>
          <ProductionForm
            row={row}
            fabrics={fabrics}
            looms={looms}
            lastMeters={lastMeters}
            nextSerials={nextSerials}
            isAdmin={isAdmin}
            onSaved={() => setOpen(false)}
          />
        </DialogContent>
      </Dialog>
    </>
  );
}
