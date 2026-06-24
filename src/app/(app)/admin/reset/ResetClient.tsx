"use client";

import { useState, useTransition } from "react";
import { AlertTriangle, ShieldAlert, CheckCircle2, RefreshCw } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { clearSystemTransactions } from "@/app/(app)/_actions";
import { PageHeader } from "@/components/app/page-header";

export function ResetClient() {
  const [confirmText, setConfirmText] = useState("");
  const [isPending, startTransition] = useTransition();
  const [errorText, setErrorText] = useState<string | null>(null);
  const [successText, setSuccessText] = useState<string | null>(null);

  const handleReset = () => {
    if (confirmText !== "RESET") return;
    setErrorText(null);
    setSuccessText(null);

    startTransition(async () => {
      try {
        await clearSystemTransactions();
        setSuccessText("System reset successful. All transaction data has been cleared, and stock levels have been restored.");
        setConfirmText("");
      } catch (err: any) {
        setErrorText(err.message || "Failed to reset system.");
      }
    });
  };

  const isButtonEnabled = confirmText === "RESET" && !isPending;

  return (
    <div className="space-y-6 max-w-3xl mx-auto">
      <PageHeader
        title="System Reset"
        description="Administrative tools to clear transactional records and restore starting inventory levels."
      />

      <Card className="border-rose-200 shadow-md">
        <CardHeader className="bg-rose-50/50 border-b border-rose-100 pb-4">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-rose-100 text-rose-700 rounded-lg">
              <ShieldAlert className="h-6 w-6" />
            </div>
            <div>
              <CardTitle className="text-rose-950 font-black">Danger Zone</CardTitle>
              <CardDescription className="text-rose-700 font-medium">
                This action is permanent and cannot be undone.
              </CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent className="pt-6 space-y-6">
          <div className="bg-rose-50/40 border border-rose-100 rounded-xl p-4 text-sm text-rose-900 space-y-3">
            <div className="flex items-start gap-2.5 font-semibold text-rose-950">
              <AlertTriangle className="h-4 w-4 shrink-0 text-rose-600 mt-0.5" />
              <span>Warning: The following data will be permanently deleted:</span>
            </div>
            <ul className="list-disc list-inside pl-2 space-y-1.5 text-rose-800">
              <li>All sales invoices and raw material sales records</li>
              <li>All raw material purchase records</li>
              <li>All raw material consumption logs</li>
              <li>All double-entry accounting journal lines</li>
              <li>All sales orders, items, and billing summaries</li>
              <li>All shift and stage production entries</li>
            </ul>
            <div className="pt-2 border-t border-rose-200/50 text-rose-900">
              <span className="font-semibold">System adjustments applied:</span>
              <ul className="list-disc list-inside pl-2 mt-1 space-y-1 text-rose-800">
                <li>All fabric roll statuses will be reverted to <span className="font-bold text-slate-800">available</span></li>
                <li>All active raw material stock levels will be reset back to their <span className="font-bold text-slate-800">opening stock</span> values</li>
              </ul>
            </div>
          </div>

          {errorText && (
            <div className="p-4 bg-destructive/10 text-destructive text-sm rounded-lg font-medium border border-destructive/20">
              {errorText}
            </div>
          )}

          {successText && (
            <div className="p-4 bg-emerald-50 text-emerald-800 text-sm rounded-lg font-medium border border-emerald-200 flex items-start gap-3">
              <CheckCircle2 className="h-5 w-5 shrink-0 text-emerald-600 mt-0.5" />
              <span>{successText}</span>
            </div>
          )}

          <div className="space-y-3">
            <Label htmlFor="confirm-reset" className="text-slate-700 font-bold text-sm block">
              To confirm, type <span className="font-black text-rose-700 select-all">RESET</span> in the box below:
            </Label>
            <Input
              id="confirm-reset"
              value={confirmText}
              onChange={(e) => setConfirmText(e.target.value)}
              placeholder="Type RESET to confirm"
              disabled={isPending}
              className="max-w-md border-slate-300 focus-visible:ring-rose-500 font-medium"
            />
          </div>

          <div className="pt-4 border-t border-slate-100 flex items-center justify-end gap-3">
            <Button
              onClick={handleReset}
              disabled={!isButtonEnabled}
              variant="destructive"
              className="font-bold px-8 shadow-sm flex items-center gap-2 h-10 select-none"
            >
              {isPending ? (
                <>
                  <RefreshCw className="h-4 w-4 animate-spin" />
                  Resetting System...
                </>
              ) : (
                "Delete All Transactions & Reset System"
              )}
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
