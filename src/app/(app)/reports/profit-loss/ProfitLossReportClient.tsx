"use client";

import { useState, useMemo, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { formatNumber } from "@/lib/utils";
import { saveProfitLoss } from "@/app/(app)/_actions";
import { Printer } from "lucide-react";


interface PLAccount {
  id: string;
  customer_name: string;
  alias: string | null;
  opening_debit: number;
  opening_credit: number;
  is_internal: string;
}

interface JournalEntry {
  account_id: string | null;
  account_name: string;
  entry_type: "debit" | "credit";
  amount: string | number;
}

interface ProfitLossReportClientProps {
  date: string;
  accounts: PLAccount[];
  entries: JournalEntry[];
  closingStockValue: number;
  submittedPL: any;
}

export function ProfitLossReportClient({
  date,
  accounts,
  entries,
  closingStockValue,
  submittedPL,
}: ProfitLossReportClientProps) {
  const router = useRouter();

  // Manual Expenses till date state
  const [manualExpensesInput, setManualExpensesInput] = useState<string>(() => {
    return submittedPL?.manualExpenses !== undefined ? String(submittedPL.manualExpenses) : "0";
  });

  const [submitted, setSubmitted] = useState(() => !!submittedPL);
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    setManualExpensesInput(submittedPL?.manualExpenses !== undefined ? String(submittedPL.manualExpenses) : "0");
    setSubmitted(!!submittedPL);
  }, [submittedPL]);

  const manualExpenses = Math.max(0, Number(manualExpensesInput) || 0);

  // Calculate net balances for each P&L account
  const accountBalances = useMemo(() => {
    const balances: Record<string, { name: string; alias?: string | null; balance: number }> = {};

    accounts.forEach((acc) => {
      balances[acc.id] = {
        name: acc.customer_name,
        alias: acc.alias,
        balance: Number(acc.opening_debit ?? 0) - Number(acc.opening_credit ?? 0),
      };
    });

    entries.forEach((entry) => {
      const amt = Number(entry.amount);
      let accId = entry.account_id;

      if (!accId && entry.account_name) {
        const match = accounts.find(
          (acc) =>
            acc.customer_name.toLowerCase().trim() === entry.account_name.toLowerCase().trim() ||
            (acc.alias && acc.alias.toLowerCase().trim() === entry.account_name.toLowerCase().trim())
        );
        if (match) accId = match.id;
      }

      if (accId && balances[accId]) {
        if (entry.entry_type === "debit") {
          balances[accId].balance += amt;
        } else {
          balances[accId].balance -= amt;
        }
      }
    });

    return Object.entries(balances)
      .map(([id, data]) => {
        const net = data.balance;
        return {
          id,
          name: data.name,
          alias: data.alias,
          amount: Math.abs(net),
          type: net >= 0 ? ("debit" as const) : ("credit" as const),
        };
      })
      .filter((acc) => acc.amount > 0);
  }, [accounts, entries]);

  // Group and sort
  const debitAccounts = useMemo(() => {
    return accountBalances.filter((a) => a.type === "debit").sort((a, b) => b.amount - a.amount);
  }, [accountBalances]);

  const creditAccounts = useMemo(() => {
    return accountBalances.filter((a) => a.type === "credit").sort((a, b) => b.amount - a.amount);
  }, [accountBalances]);

  // Summarize sides
  const debitAccountsSum = debitAccounts.reduce((s, a) => s + a.amount, 0);
  const creditAccountsSum = creditAccounts.reduce((s, a) => s + a.amount, 0);

  const baseCreditTotal = closingStockValue + creditAccountsSum;
  const baseDebitTotal = debitAccountsSum + manualExpenses;

  // Balancing logic
  let netProfit = 0;
  let netLoss = 0;
  if (baseCreditTotal > baseDebitTotal) {
    netProfit = baseCreditTotal - baseDebitTotal;
  } else if (baseDebitTotal > baseCreditTotal) {
    netLoss = baseDebitTotal - baseCreditTotal;
  }

  const finalCreditTotal = baseCreditTotal + netLoss;
  const finalDebitTotal = baseDebitTotal + netProfit;

  const handleSubmit = async () => {
    setIsSaving(true);
    try {
      await saveProfitLoss(date, manualExpenses, netProfit, netLoss);
      setSubmitted(true);
      router.refresh();
    } catch (err: any) {
      alert("Failed to submit Profit & Loss: " + err.message);
    } finally {
      setIsSaving(false);
    }
  };

  const formattedDate = new Date(date + "T00:00:00").toLocaleDateString("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });

  // Build rows for the print T-account table (max rows of both sides)
  const drRows: { label: string; amount: number | null }[] = [
    ...debitAccounts.map((a) => ({ label: `${a.name}${a.alias ? ` (${a.alias})` : ""}`, amount: a.amount })),
    { label: "Expenses Till Date", amount: manualExpenses },
    ...(netProfit > 0 ? [{ label: "Net Profit (transferred to Balance Sheet)", amount: netProfit }] : []),
    { label: "__TOTAL__", amount: finalDebitTotal },
  ];
  const crRows: { label: string; amount: number | null }[] = [
    ...creditAccounts.map((a) => ({ label: `${a.name}${a.alias ? ` (${a.alias})` : ""}`, amount: a.amount })),
    { label: "Closing Stock Value", amount: closingStockValue },
    ...(netLoss > 0 ? [{ label: "Net Loss (transferred to Balance Sheet)", amount: netLoss }] : []),
    { label: "__TOTAL__", amount: finalCreditTotal },
  ];
  const maxLen = Math.max(drRows.length, crRows.length);
  const tableRows = Array.from({ length: maxLen }, (_, i) => ({
    dr: drRows[i] ?? null,
    cr: crRows[i] ?? null,
  }));

  return (
    <div className="space-y-6 pb-12">
      {/* ═══════════════════════════════════════════════════════
          PRINT-ONLY — Official Audit-Grade T-Account Layout
      ═══════════════════════════════════════════════════════ */}
      <div className="hidden print:block">
        {/* Letterhead */}
        <div className="text-center mb-6">
          <div className="text-2xl font-black uppercase tracking-widest text-black">RK GLOBAL</div>
          <div className="text-base font-bold uppercase tracking-wide text-black mt-1">
            Profit &amp; Loss Account
          </div>
          <div className="text-sm font-semibold text-black mt-0.5">
            For the Period Ending {formattedDate}
          </div>
          <div className="border-b-2 border-black mt-3" />
        </div>

        {/* T-Account Table */}
        <table
          style={{
            width: "100%",
            borderCollapse: "collapse",
            fontSize: "11px",
            fontFamily: "serif",
          }}
        >
          <thead>
            <tr>
              <th
                colSpan={3}
                style={{
                  width: "50%",
                  border: "1px solid #000",
                  padding: "6px 8px",
                  textAlign: "center",
                  fontWeight: 900,
                  fontSize: "11px",
                  background: "#f1f5f9",
                  textTransform: "uppercase",
                  letterSpacing: "0.05em",
                }}
              >
                Dr (Expenditure)
              </th>
              <th
                colSpan={3}
                style={{
                  width: "50%",
                  border: "1px solid #000",
                  padding: "6px 8px",
                  textAlign: "center",
                  fontWeight: 900,
                  fontSize: "11px",
                  background: "#f1f5f9",
                  textTransform: "uppercase",
                  letterSpacing: "0.05em",
                }}
              >
                Cr (Income)
              </th>
            </tr>
            <tr>
              {["Particulars", "₹", ""].map((h) => (
                <th
                  key={h}
                  style={{
                    border: "1px solid #000",
                    padding: "4px 6px",
                    fontWeight: 700,
                    fontSize: "10px",
                    background: "#f8fafc",
                    textAlign: h === "₹" ? "right" : "left",
                  }}
                >
                  {h}
                </th>
              ))}
              {["Particulars", "₹", ""].map((h, i) => (
                <th
                  key={`cr-${i}`}
                  style={{
                    border: "1px solid #000",
                    padding: "4px 6px",
                    fontWeight: 700,
                    fontSize: "10px",
                    background: "#f8fafc",
                    textAlign: h === "₹" ? "right" : "left",
                  }}
                >
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {tableRows.map((row, i) => {
              const drIsTotal = row.dr?.label === "__TOTAL__";
              const crIsTotal = row.cr?.label === "__TOTAL__";
              const rowStyle: React.CSSProperties = drIsTotal || crIsTotal
                ? { fontWeight: 900, background: "#f1f5f9", borderTop: "2px solid #000" }
                : { fontWeight: "normal" };
              return (
                <tr key={i} style={rowStyle}>
                  {/* DR side */}
                  <td
                    colSpan={drIsTotal ? 1 : 2}
                    style={{
                      border: "1px solid #000",
                      padding: "4px 8px",
                      fontSize: "11px",
                      textTransform: drIsTotal ? "uppercase" : "capitalize",
                      letterSpacing: drIsTotal ? "0.04em" : "normal",
                    }}
                  >
                    {drIsTotal ? "Total Dr" : (row.dr?.label ?? "")}
                  </td>
                  {drIsTotal && (
                    <td style={{ border: "1px solid #000", padding: "4px 8px", textAlign: "right", fontSize: "11px", fontWeight: 900 }}>
                      ₹{formatNumber(row.dr?.amount ?? 0, 2)}
                    </td>
                  )}
                  {!drIsTotal && (
                    <td style={{ border: "1px solid #000", padding: "4px 8px", textAlign: "right", fontSize: "11px", fontWeight: 600 }}>
                      {row.dr != null ? `₹${formatNumber(row.dr.amount ?? 0, 2)}` : ""}
                    </td>
                  )}
                  {/* Empty 3rd Dr col (used for sub-cols if needed) */}
                  <td style={{ border: "none", width: "0px", padding: "0" }} />

                  {/* CR side */}
                  <td
                    colSpan={crIsTotal ? 1 : 2}
                    style={{
                      border: "1px solid #000",
                      padding: "4px 8px",
                      fontSize: "11px",
                      textTransform: crIsTotal ? "uppercase" : "capitalize",
                      letterSpacing: crIsTotal ? "0.04em" : "normal",
                    }}
                  >
                    {crIsTotal ? "Total Cr" : (row.cr?.label ?? "")}
                  </td>
                  {crIsTotal && (
                    <td style={{ border: "1px solid #000", padding: "4px 8px", textAlign: "right", fontSize: "11px", fontWeight: 900 }}>
                      ₹{formatNumber(row.cr?.amount ?? 0, 2)}
                    </td>
                  )}
                  {!crIsTotal && (
                    <td style={{ border: "1px solid #000", padding: "4px 8px", textAlign: "right", fontSize: "11px", fontWeight: 600 }}>
                      {row.cr != null ? `₹${formatNumber(row.cr.amount ?? 0, 2)}` : ""}
                    </td>
                  )}
                  {/* Empty 3rd Cr col */}
                  <td style={{ border: "none", width: "0px", padding: "0" }} />
                </tr>
              );
            })}
          </tbody>
        </table>

        {/* Net Result */}
        <div style={{ marginTop: "12px", fontSize: "12px", fontWeight: 700, textAlign: "right", fontFamily: "serif" }}>
          {netProfit > 0 && (
            <span>Net Profit: ₹{formatNumber(netProfit, 2)}</span>
          )}
          {netLoss > 0 && (
            <span>Net Loss: ₹{formatNumber(netLoss, 2)}</span>
          )}
        </div>

        {/* Signature Block */}
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            marginTop: "40px",
            fontSize: "11px",
            fontFamily: "serif",
          }}
        >
          <div style={{ textAlign: "center", minWidth: "160px" }}>
            <div style={{ borderTop: "1px solid #000", paddingTop: "4px", marginTop: "32px" }}>
              Prepared By
            </div>
          </div>
          <div style={{ textAlign: "center", minWidth: "160px" }}>
            <div style={{ borderTop: "1px solid #000", paddingTop: "4px", marginTop: "32px" }}>
              Verified By
            </div>
          </div>
          <div style={{ textAlign: "center", minWidth: "160px" }}>
            <div style={{ borderTop: "1px solid #000", paddingTop: "4px", marginTop: "32px" }}>
              Authorised Signatory
            </div>
          </div>
        </div>
      </div>

      {/* ═══════════════════════════════════════════════════════
          SCREEN-ONLY — Original on-screen layout
      ═══════════════════════════════════════════════════════ */}
      <div className="print:hidden">
        {/* Pre-population/Submission Banner */}
        {submitted && (
          <div className="p-4 bg-emerald-50 border border-emerald-200 text-emerald-800 rounded-lg text-sm flex items-center justify-between">
            <span className="font-semibold">✓ Profit & Loss statement for {formattedDate} has been submitted.</span>
            <span className="text-xs text-emerald-600">
              Net: {netProfit > 0 ? `₹${formatNumber(netProfit, 0)} Profit` : `₹${formatNumber(netLoss, 0)} Loss`}
            </span>
          </div>
        )}

        {/* Header and Print Actions */}
        <div className="bg-white rounded-lg border border-slate-200 shadow-sm overflow-hidden">
          <div className="px-6 py-4 bg-slate-50 flex items-center justify-between">
            <div>
              <h2 className="font-black text-slate-800 text-sm uppercase tracking-wider">
                PROFIT &amp; LOSS UPTO THE DATE {formattedDate}
              </h2>
              <p className="text-xs text-slate-500 mt-0.5">Financial Statement</p>
            </div>
            <Button onClick={() => window.print()} variant="outline" size="sm" className="flex items-center gap-1.5 border-slate-200 shadow-none">
              <Printer className="h-4 w-4" /> Print Statement
            </Button>
          </div>
        </div>

        {/* Stacked Layout with Gap */}
        <div className="space-y-8">
          {/* CREDIT / INCOME CARD */}
          <div className="bg-white rounded-lg border border-slate-200 shadow-sm overflow-hidden flex flex-col">
            <div className="bg-slate-100/50 px-4 py-2.5 text-xs font-bold text-slate-700 border-b border-slate-200 flex justify-between uppercase">
              <span>Credit Particulars (Incomes)</span>
              <span>Amount (₹)</span>
            </div>

            <div className="divide-y divide-slate-100 min-h-[150px]">
              {creditAccounts.map((acc) => (
                <div key={acc.id} className="px-4 py-3 flex justify-between items-center text-sm">
                  <span className="font-medium text-slate-700 capitalize">
                    {acc.name} {acc.alias ? `(${acc.alias})` : ""}
                  </span>
                  <span className="font-bold text-slate-900 font-mono">
                    ₹{formatNumber(acc.amount, 2)}
                  </span>
                </div>
              ))}

              {/* Closing Stock Value item */}
              <div className="px-4 py-3.5 flex justify-between items-center text-sm bg-emerald-50/10 border-b border-slate-100">
                <div className="flex flex-col gap-0.5">
                  <span className="font-bold text-emerald-950">CLOSING STOCK VALUE</span>
                  <span className="text-[10px] text-emerald-600 font-semibold uppercase">Submitted Value</span>
                </div>
                <span className="font-bold text-emerald-900 font-mono text-sm">
                  ₹{formatNumber(closingStockValue, 2)}
                </span>
              </div>

              {/* Net Loss Balancing Line */}
              {netLoss > 0 && (
                <div className="px-4 py-3 flex justify-between items-center text-sm bg-rose-50/20 font-bold border-t border-rose-100">
                  <span className="text-rose-800 uppercase tracking-wide">
                    Net Loss transferred to Balance Sheet
                  </span>
                  <span className="text-rose-800 font-mono text-base">
                    ₹{formatNumber(netLoss, 2)}
                  </span>
                </div>
              )}
            </div>

            {/* Credit Grand Total */}
            <div className="bg-slate-50 border-t border-slate-200 px-4 py-3 flex justify-between items-center font-black text-sm text-slate-900">
              <span className="uppercase tracking-wider">Total Cr</span>
              <span className="font-mono text-base">₹{formatNumber(finalCreditTotal, 2)}</span>
            </div>
          </div>

          {/* DEBIT / EXPENSES CARD */}
          <div className="bg-white rounded-lg border border-slate-200 shadow-sm overflow-hidden flex flex-col">
            <div className="bg-slate-100/50 px-4 py-2.5 text-xs font-bold text-slate-700 border-b border-slate-200 flex justify-between uppercase">
              <span>Debit Particulars (Expenses)</span>
              <span>Amount (₹)</span>
            </div>

            <div className="divide-y divide-slate-100 min-h-[150px]">
              {debitAccounts.map((acc) => (
                <div key={acc.id} className="px-4 py-3 flex justify-between items-center text-sm">
                  <span className="font-medium text-slate-700 capitalize">
                    {acc.name} {acc.alias ? `(${acc.alias})` : ""}
                  </span>
                  <span className="font-bold text-slate-900 font-mono">
                    ₹{formatNumber(acc.amount, 2)}
                  </span>
                </div>
              ))}

              {/* Manual Expenses entry cell */}
              <div className="px-4 py-3.5 flex justify-between items-center text-sm bg-slate-50/50">
                <div className="flex flex-col gap-0.5">
                  <span className="font-bold text-rose-950">EXPENSES TILL DATE</span>
                  <span className="text-[10px] text-rose-600 font-semibold uppercase">Manual Entry</span>
                </div>
                <div className="relative flex items-center">
                  <span className="absolute left-2.5 text-muted-foreground text-xs">₹</span>
                  <Input
                    type="number"
                    min="0"
                    step="any"
                    value={manualExpensesInput === "0" ? "" : manualExpensesInput}
                    placeholder="0.00"
                    onChange={(e) => setManualExpensesInput(e.target.value)}
                    className="w-36 h-8 pl-6 pr-2 text-right text-sm font-semibold border-slate-300 focus-visible:ring-emerald-500 shadow-none ml-auto"
                  />
                </div>
              </div>

              {/* Net Profit Balancing Line */}
              {netProfit > 0 && (
                <div className="px-4 py-3 flex justify-between items-center text-sm bg-emerald-50/20 font-bold border-t border-emerald-100">
                  <span className="text-emerald-800 uppercase tracking-wide">
                    Net Profit transferred to Balance Sheet
                  </span>
                  <span className="text-emerald-800 font-mono text-base">
                    ₹{formatNumber(netProfit, 2)}
                  </span>
                </div>
              )}
            </div>

            {/* Debit Grand Total */}
            <div className="bg-slate-50 border-t border-slate-200 px-4 py-3 flex justify-between items-center font-black text-sm text-slate-900">
              <span className="uppercase tracking-wider">Total Dr</span>
              <span className="font-mono text-base">₹{formatNumber(finalDebitTotal, 2)}</span>
            </div>
          </div>
        </div>

        {/* Submit Block */}
        <div className="flex justify-end px-5 py-4 border border-slate-200 rounded-lg bg-white shadow-sm">
          {submitted ? (
            <div className="flex items-center gap-4">
              <span className="text-sm font-semibold text-emerald-600">✓ Submitted successfully</span>
              <Button onClick={handleSubmit} disabled={isSaving} variant="outline" className="px-8 border-slate-200">
                {isSaving ? "Updating..." : "Update Submission"}
              </Button>
            </div>
          ) : (
            <Button
              onClick={handleSubmit}
              disabled={isSaving}
              className="px-8"
            >
              {isSaving ? "Submitting..." : "Submit"}
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}
