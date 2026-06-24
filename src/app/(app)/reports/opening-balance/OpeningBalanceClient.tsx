"use client";

import { useState } from "react";
import { Check, Loader2 } from "lucide-react";
import { PageHeader } from "@/components/app/page-header";
import { Card, CardContent } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { EmptyState } from "@/components/ui/empty-state";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { saveAccountOpeningBalance } from "@/app/(app)/_actions";

interface Account {
  id: string;
  customer_name: string;
  alias: string | null;
  opening_debit: string | number;
  opening_credit: string | number;
  is_internal: string;
}

interface OpeningBalanceClientProps {
  accounts: Account[];
}

export function OpeningBalanceClient({ accounts }: OpeningBalanceClientProps) {
  const [debits, setDebits] = useState<Record<string, number>>(() => {
    const initial: Record<string, number> = {};
    accounts.forEach((acc) => {
      initial[acc.id] = Math.floor(Number(acc.opening_debit ?? 0));
    });
    return initial;
  });

  const [credits, setCredits] = useState<Record<string, number>>(() => {
    const initial: Record<string, number> = {};
    accounts.forEach((acc) => {
      initial[acc.id] = Math.floor(Number(acc.opening_credit ?? 0));
    });
    return initial;
  });

  const [saving, setSaving] = useState<Record<string, boolean>>({});
  const [success, setSuccess] = useState<Record<string, boolean>>({});
  const [errorText, setErrorText] = useState<Record<string, string | null>>({});

  const handleDebitChange = (id: string, val: string) => {
    const num = Math.floor(Number(val));
    setDebits((prev) => ({ ...prev, [id]: isNaN(num) ? 0 : num }));
  };

  const handleCreditChange = (id: string, val: string) => {
    const num = Math.floor(Number(val));
    setCredits((prev) => ({ ...prev, [id]: isNaN(num) ? 0 : num }));
  };

  const handleSaveRow = async (id: string) => {
    const dr = debits[id] ?? 0;
    const cr = credits[id] ?? 0;

    if (dr < 0 || cr < 0) {
      setErrorText((prev) => ({ ...prev, [id]: "Values cannot be negative" }));
      return;
    }

    setSaving((prev) => ({ ...prev, [id]: true }));
    setErrorText((prev) => ({ ...prev, [id]: null }));

    try {
      const formData = new FormData();
      formData.append("id", id);
      formData.append("opening_debit", String(dr));
      formData.append("opening_credit", String(cr));

      await saveAccountOpeningBalance(formData);

      setSuccess((prev) => ({ ...prev, [id]: true }));
      setTimeout(() => {
        setSuccess((prev) => ({ ...prev, [id]: false }));
      }, 2500);
    } catch (err: any) {
      setErrorText((prev) => ({ ...prev, [id]: err.message || "Failed to save" }));
    } finally {
      setSaving((prev) => ({ ...prev, [id]: false }));
    }
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="Opening Values"
        description="Configure starting ledger balances (debits and credits) for customers, suppliers, and internal accounts."
      />

      <Card className="border border-slate-200 shadow-sm overflow-hidden">
        <CardContent className="p-0">
          {accounts.length === 0 ? (
            <EmptyState
              title="No Accounts Found"
              description="Register ledger accounts/clients in Client Management to set opening values."
            />
          ) : (
            <Table>
              <TableHeader>
                <TableRow className="bg-slate-50 border-b border-slate-200">
                  <TableHead className="font-semibold text-slate-700">Client / Account ID</TableHead>
                  <TableHead className="font-semibold text-slate-700">Account Type</TableHead>
                  <TableHead className="font-semibold text-slate-700 w-44">Dr. (Debit)</TableHead>
                  <TableHead className="font-semibold text-slate-700 w-44">Cr. (Credit)</TableHead>
                  <TableHead className="font-semibold text-slate-700 w-44 text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {accounts.map((acc) => {
                  const id = acc.id;
                  const isSaving = saving[id];
                  const isSuccess = success[id];
                  const err = errorText[id];
                  const drVal = debits[id] ?? 0;
                  const crVal = credits[id] ?? 0;

                  const clientName = acc.customer_name;
                  const alias = acc.alias;
                  const displayName = alias ? `${clientName} (${alias})` : clientName;

                  return (
                    <TableRow key={id} className="border-b border-slate-200 hover:bg-slate-50/30">
                      <TableCell className="py-3 font-medium text-slate-900 text-sm">
                        {displayName}
                      </TableCell>
                      <TableCell className="py-3 text-xs text-slate-500 capitalize">
                        {acc.is_internal?.replaceAll("_", " ") ?? "client a/c"}
                      </TableCell>
                      <TableCell className="py-3">
                        <Input
                          type="number"
                          value={drVal === 0 ? "" : drVal}
                          placeholder="0"
                          onChange={(e) => handleDebitChange(id, e.target.value)}
                          disabled={isSaving}
                          className="h-9 text-sm"
                        />
                      </TableCell>
                      <TableCell className="py-3">
                        <Input
                          type="number"
                          value={crVal === 0 ? "" : crVal}
                          placeholder="0"
                          onChange={(e) => handleCreditChange(id, e.target.value)}
                          disabled={isSaving}
                          className="h-9 text-sm"
                        />
                      </TableCell>
                      <TableCell className="py-3 text-right">
                        <div className="flex flex-col items-end gap-1">
                          <Button
                            size="sm"
                            disabled={isSaving}
                            onClick={() => handleSaveRow(id)}
                            className={`rounded-full px-5 text-xs font-semibold h-8 transition-colors ${
                              isSuccess
                                ? "bg-emerald-600 hover:bg-emerald-700 text-white"
                                : "bg-slate-800 hover:bg-slate-700 text-white"
                            }`}
                          >
                            {isSaving ? (
                              <Loader2 className="h-3 w-3 animate-spin mr-1" />
                            ) : isSuccess ? (
                              <Check className="h-3 w-3 mr-1" />
                            ) : null}
                            {isSuccess ? "Saved" : "Save"}
                          </Button>
                          {err && (
                            <span className="text-[10px] text-red-500 font-medium leading-none block mt-1">
                              {err}
                            </span>
                          )}
                        </div>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
