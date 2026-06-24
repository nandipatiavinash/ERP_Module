"use client";

import { useState, useMemo } from "react";
import { ChevronDown, ChevronRight, Printer } from "lucide-react";
import { formatNumber } from "@/lib/utils";
import { Button } from "@/components/ui/button";

interface BSAccount {
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

interface BalanceSheetClientProps {
  date: string;
  accounts: BSAccount[];
  entries: JournalEntry[];
  closingStockValue: number;
  netProfit: number;
  netLoss: number;
}

export function BalanceSheetClient({
  date,
  accounts,
  entries,
  closingStockValue,
  netProfit,
  netLoss,
}: BalanceSheetClientProps) {
  // Collapse/Expand state for each group of details
  const [expandedGroups, setExpandedGroups] = useState<Record<string, boolean>>({});

  const toggleGroup = (key: string) => {
    setExpandedGroups((prev) => ({ ...prev, [key]: !prev[key] }));
  };

  const calculations = useMemo(() => {
    // 1. Calculate balance for each account up to date D
    const accountBalances: Record<
      string,
      { name: string; alias?: string | null; balance: number; category: string }
    > = {};

    accounts.forEach((acc) => {
      accountBalances[acc.id] = {
        name: acc.customer_name,
        alias: acc.alias,
        balance: Number(acc.opening_debit ?? 0) - Number(acc.opening_credit ?? 0),
        category: acc.is_internal || "other",
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

      if (accId && accountBalances[accId]) {
        if (entry.entry_type === "debit") {
          accountBalances[accId].balance += amt;
        } else {
          accountBalances[accId].balance -= amt;
        }
      }
    });

    // 2. Classify into Liabilities (Credit) and Assets (Debit) categories
    const groups = {
      capital: { dr: [] as any[], cr: [] as any[], drSum: 0, crSum: 0 },
      loan: { dr: [] as any[], cr: [] as any[], drSum: 0, crSum: 0 },
      client: { dr: [] as any[], cr: [] as any[], drSum: 0, crSum: 0 },
      otherBs: { dr: [] as any[], cr: [] as any[], drSum: 0, crSum: 0 },
    };

    Object.entries(accountBalances).forEach(([id, data]) => {
      const net = data.balance;
      const cat = data.category.toLowerCase();

      // Skip profit and loss accounts as they are closed into Net Profit/Loss
      if (cat === "profit and loss a/c" || cat === "p&l") {
        return;
      }

      let groupKey: "capital" | "loan" | "client" | "otherBs" = "otherBs";
      if (cat === "capital a/c" || cat === "capital") {
        groupKey = "capital";
      } else if (cat === "loan a/c" || cat === "loan") {
        groupKey = "loan";
      } else if (cat === "client a/c" || cat === "client") {
        groupKey = "client";
      }

      const accInfo = {
        id,
        name: data.name,
        alias: data.alias,
        amount: Math.abs(net),
      };

      if (net > 0) {
        groups[groupKey].dr.push(accInfo);
        groups[groupKey].drSum += net;
      } else if (net < 0) {
        groups[groupKey].cr.push(accInfo);
        groups[groupKey].crSum += Math.abs(net);
      }
    });

    return groups;
  }, [accounts, entries]);

  // Sort detail lists
  const sortedCapitalCr = useMemo(() => [...calculations.capital.cr].sort((a, b) => b.amount - a.amount), [calculations]);
  const sortedCapitalDr = useMemo(() => [...calculations.capital.dr].sort((a, b) => b.amount - a.amount), [calculations]);
  const sortedLoanCr = useMemo(() => [...calculations.loan.cr].sort((a, b) => b.amount - a.amount), [calculations]);
  const sortedLoanDr = useMemo(() => [...calculations.loan.dr].sort((a, b) => b.amount - a.amount), [calculations]);
  const sortedClientCr = useMemo(() => [...calculations.client.cr].sort((a, b) => b.amount - a.amount), [calculations]);
  const sortedClientDr = useMemo(() => [...calculations.client.dr].sort((a, b) => b.amount - a.amount), [calculations]);
  const sortedOtherCr = useMemo(() => [...calculations.otherBs.cr].sort((a, b) => b.amount - a.amount), [calculations]);
  const sortedOtherDr = useMemo(() => [...calculations.otherBs.dr].sort((a, b) => b.amount - a.amount), [calculations]);

  // Sum sides
  const totalLiabilities =
    calculations.capital.crSum +
    netProfit +
    calculations.loan.crSum +
    calculations.client.crSum +
    calculations.otherBs.crSum;

  const totalAssets =
    closingStockValue +
    netLoss +
    calculations.loan.drSum +
    calculations.client.drSum +
    calculations.otherBs.drSum;

  const formattedDate = new Date(date + "T00:00:00").toLocaleDateString("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });

  const difference = Math.abs(totalLiabilities - totalAssets);
  const isBalanced = difference < 0.01;

  // ─── Build print T-account rows ────────────────────────────────────────────
  // Liabilities side rows
  type PrintRow = { label: string; amount?: number; isGroup?: boolean; isDetail?: boolean; isTotal?: boolean };

  const liabRows: PrintRow[] = [];
  // 1. Capital
  liabRows.push({ label: "1. Capital Accounts", amount: calculations.capital.crSum, isGroup: true });
  sortedCapitalCr.forEach((item) =>
    liabRows.push({ label: `   ${item.name}${item.alias ? ` (${item.alias})` : ""}`, amount: item.amount, isDetail: true })
  );
  // 2. P&L Net Profit
  liabRows.push({ label: "2. Profit & Loss A/c (Net Profit)", amount: netProfit > 0 ? netProfit : undefined, isGroup: true });
  // 3. Loan (Cr)
  liabRows.push({ label: "3. Loan Accounts (Credit Balance)", amount: calculations.loan.crSum, isGroup: true });
  sortedLoanCr.forEach((item) =>
    liabRows.push({ label: `   ${item.name}${item.alias ? ` (${item.alias})` : ""}`, amount: item.amount, isDetail: true })
  );
  // 4. Clients (Cr)
  liabRows.push({ label: "4. Client Accounts (Credit Balance)", amount: calculations.client.crSum, isGroup: true });
  sortedClientCr.forEach((item) =>
    liabRows.push({ label: `   ${item.name}${item.alias ? ` (${item.alias})` : ""}`, amount: item.amount, isDetail: true })
  );
  // 5. Other BS (Cr)
  liabRows.push({ label: "5. Other BS Accounts (Credit Balance)", amount: calculations.otherBs.crSum, isGroup: true });
  sortedOtherCr.forEach((item) =>
    liabRows.push({ label: `   ${item.name}${item.alias ? ` (${item.alias})` : ""}`, amount: item.amount, isDetail: true })
  );
  liabRows.push({ label: "Total Liabilities", amount: totalLiabilities, isTotal: true });

  // Assets side rows
  const assetRows: PrintRow[] = [];
  // 1. Closing Stock
  assetRows.push({ label: "1. Closing Stock Value", amount: closingStockValue, isGroup: true });
  // 2. P&L Net Loss
  assetRows.push({ label: "2. Profit & Loss A/c (Net Loss)", amount: netLoss > 0 ? netLoss : undefined, isGroup: true });
  // 3. Loan (Dr)
  assetRows.push({ label: "3. Loan Accounts (Debit Balance)", amount: calculations.loan.drSum, isGroup: true });
  sortedLoanDr.forEach((item) =>
    assetRows.push({ label: `   ${item.name}${item.alias ? ` (${item.alias})` : ""}`, amount: item.amount, isDetail: true })
  );
  // 4. Clients (Dr)
  assetRows.push({ label: "4. Client Accounts (Debit Balance)", amount: calculations.client.drSum, isGroup: true });
  sortedClientDr.forEach((item) =>
    assetRows.push({ label: `   ${item.name}${item.alias ? ` (${item.alias})` : ""}`, amount: item.amount, isDetail: true })
  );
  // 5. Other BS (Dr)
  assetRows.push({ label: "5. Other BS Accounts (Debit Balance)", amount: calculations.otherBs.drSum, isGroup: true });
  sortedOtherDr.forEach((item) =>
    assetRows.push({ label: `   ${item.name}${item.alias ? ` (${item.alias})` : ""}`, amount: item.amount, isDetail: true })
  );
  assetRows.push({ label: "Total Assets", amount: totalAssets, isTotal: true });

  const maxLen = Math.max(liabRows.length, assetRows.length);
  const printRows = Array.from({ length: maxLen }, (_, i) => ({
    liab: liabRows[i] ?? null,
    asset: assetRows[i] ?? null,
  }));

  const cellStyle = (row: PrintRow | null): React.CSSProperties => ({
    border: "1px solid #000",
    padding: row?.isTotal ? "5px 8px" : row?.isDetail ? "3px 8px" : "4px 8px",
    fontSize: row?.isDetail ? "10px" : "11px",
    fontWeight: row?.isTotal ? 900 : row?.isGroup ? 700 : 400,
    textTransform: row?.isTotal ? "uppercase" : "none",
    letterSpacing: row?.isTotal ? "0.04em" : "normal",
    background: row?.isTotal ? "#f1f5f9" : row?.isDetail ? "#fafafa" : "transparent",
    borderTop: row?.isTotal ? "2px solid #000" : undefined,
    color: row?.isDetail ? "#475569" : "#111",
  });

  return (
    <div className="space-y-6 pb-12">
      {/* ═══════════════════════════════════════════════════════
          PRINT-ONLY — Official Audit-Grade Balance Sheet
      ═══════════════════════════════════════════════════════ */}
      <div className="hidden print:block">
        {/* Letterhead */}
        <div className="text-center mb-6">
          <div style={{ fontSize: "22px", fontWeight: 900, textTransform: "uppercase", letterSpacing: "0.1em", fontFamily: "serif" }}>
            RK GLOBAL
          </div>
          <div style={{ fontSize: "14px", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.06em", marginTop: "4px", fontFamily: "serif" }}>
            Balance Sheet
          </div>
          <div style={{ fontSize: "11px", fontWeight: 600, marginTop: "4px", fontFamily: "serif" }}>
            As on {formattedDate}
          </div>
          <div style={{ borderBottom: "2px solid #000", marginTop: "10px" }} />
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
                colSpan={2}
                style={{
                  border: "1px solid #000",
                  padding: "6px 8px",
                  textAlign: "center",
                  fontWeight: 900,
                  fontSize: "11px",
                  background: "#f1f5f9",
                  textTransform: "uppercase",
                  letterSpacing: "0.05em",
                  width: "50%",
                }}
              >
                Liabilities &amp; Capital
              </th>
              <th
                colSpan={2}
                style={{
                  border: "1px solid #000",
                  padding: "6px 8px",
                  textAlign: "center",
                  fontWeight: 900,
                  fontSize: "11px",
                  background: "#f1f5f9",
                  textTransform: "uppercase",
                  letterSpacing: "0.05em",
                  width: "50%",
                }}
              >
                Assets
              </th>
            </tr>
            <tr>
              {["Particulars", "Amount (₹)", "Particulars", "Amount (₹)"].map((h, i) => (
                <th
                  key={i}
                  style={{
                    border: "1px solid #000",
                    padding: "4px 6px",
                    fontWeight: 700,
                    fontSize: "10px",
                    background: "#f8fafc",
                    textAlign: i % 2 === 1 ? "right" : "left",
                    width: i % 2 === 1 ? "25%" : "25%",
                  }}
                >
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {printRows.map((row, i) => (
              <tr key={i}>
                {/* Liabilities side */}
                <td style={cellStyle(row.liab)}>
                  {row.liab?.label ?? ""}
                </td>
                <td
                  style={{
                    ...cellStyle(row.liab),
                    textAlign: "right",
                    fontVariantNumeric: "tabular-nums",
                  }}
                >
                  {row.liab?.amount != null
                    ? `₹${formatNumber(row.liab.amount, 2)}`
                    : row.liab != null
                    ? "—"
                    : ""}
                </td>
                {/* Assets side */}
                <td style={cellStyle(row.asset)}>
                  {row.asset?.label ?? ""}
                </td>
                <td
                  style={{
                    ...cellStyle(row.asset),
                    textAlign: "right",
                    fontVariantNumeric: "tabular-nums",
                  }}
                >
                  {row.asset?.amount != null
                    ? `₹${formatNumber(row.asset.amount, 2)}`
                    : row.asset != null
                    ? "—"
                    : ""}
                </td>
              </tr>
            ))}
          </tbody>
        </table>

        {/* Balance status */}
        {!isBalanced && (
          <div style={{ marginTop: "8px", fontSize: "11px", color: "#b91c1c", fontWeight: 700, fontFamily: "serif", textAlign: "right" }}>
            Note: Difference of ₹{formatNumber(difference, 2)} — Balance Sheet not balanced.
          </div>
        )}

        {/* Signature Block */}
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            marginTop: "48px",
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
        <div className="bg-white rounded-lg border border-slate-200 shadow-sm overflow-hidden">
          <div className="px-6 py-4 border-b border-slate-200 bg-slate-50 flex items-center justify-between">
            <div>
              <h2 className="font-black text-slate-800 text-sm uppercase tracking-wider">
                Balance Sheet Statement
              </h2>
              <p className="text-xs text-slate-500 mt-0.5">As on {formattedDate}</p>
            </div>
            <div className="flex items-center gap-3">
              {isBalanced ? (
                <span className="text-xs font-bold text-emerald-600 bg-emerald-50 border border-emerald-200 px-3 py-1 rounded-full">
                  Balanced
                </span>
              ) : (
                <span className="text-xs font-bold text-rose-600 bg-rose-50 border border-rose-200 px-3 py-1 rounded-full">
                  Difference: ₹{formatNumber(difference, 2)}
                </span>
              )}
              <Button onClick={() => window.print()} variant="outline" size="sm" className="flex items-center gap-1.5 border-slate-200 shadow-none">
                <Printer className="h-4 w-4" /> Print Statement
              </Button>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 divide-y md:divide-y-0 md:divide-x divide-slate-200">
            {/* LIABILITIES SIDE */}
            <div className="flex flex-col h-full">
              <div className="bg-slate-100/50 px-4 py-2.5 text-xs font-bold text-slate-700 border-b border-slate-200 flex justify-between uppercase">
                <span>Liabilities &amp; Capital</span>
                <span>Amount (₹)</span>
              </div>

              <div className="flex-1 divide-y divide-slate-100 min-h-[350px]">
                {/* 1. CAPITAL ACCOUNTS */}
                <div className="flex flex-col">
                  <button
                    onClick={() => toggleGroup("capitalCr")}
                    className="w-full px-4 py-3.5 flex justify-between items-center text-left hover:bg-slate-50/50 transition-colors"
                  >
                    <div className="flex items-center gap-2">
                      {expandedGroups["capitalCr"] ? (
                        <ChevronDown className="h-4 w-4 text-slate-400 shrink-0" />
                      ) : (
                        <ChevronRight className="h-4 w-4 text-slate-400 shrink-0" />
                      )}
                      <span className="font-bold text-slate-700 text-sm uppercase tracking-wide">
                        1. Capital Accounts
                      </span>
                    </div>
                    <span className="font-bold text-slate-900 font-mono">
                      ₹{formatNumber(calculations.capital.crSum, 2)}
                    </span>
                  </button>

                  {expandedGroups["capitalCr"] && sortedCapitalCr.length > 0 && (
                    <div className="bg-slate-50/40 px-8 py-2 divide-y divide-slate-100/80 text-xs">
                      {sortedCapitalCr.map((item) => (
                        <div key={item.id} className="py-2 flex justify-between text-slate-600">
                          <span className="capitalize">{item.name} {item.alias ? `(${item.alias})` : ""}</span>
                          <span className="font-semibold font-mono">₹{formatNumber(item.amount, 2)}</span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {/* 2. PROFIT / LOSS Cr. BALANCE */}
                <div className="px-4 py-3.5 flex justify-between items-center text-sm">
                  <span className="font-bold text-slate-700 uppercase tracking-wide pl-6">
                    2. Profit &amp; Loss A/c (Net Profit)
                  </span>
                  <span className="font-bold text-slate-900 font-mono">
                    {netProfit > 0 ? `₹${formatNumber(netProfit, 2)}` : "—"}
                  </span>
                </div>

                {/* 3. LOAN ACCOUNTS (CREDIT) */}
                <div className="flex flex-col">
                  <button
                    onClick={() => toggleGroup("loanCr")}
                    className="w-full px-4 py-3.5 flex justify-between items-center text-left hover:bg-slate-50/50 transition-colors"
                  >
                    <div className="flex items-center gap-2">
                      {expandedGroups["loanCr"] ? (
                        <ChevronDown className="h-4 w-4 text-slate-400 shrink-0" />
                      ) : (
                        <ChevronRight className="h-4 w-4 text-slate-400 shrink-0" />
                      )}
                      <span className="font-bold text-slate-700 text-sm uppercase tracking-wide">
                        3. Loan Accounts (Credit Balance)
                      </span>
                    </div>
                    <span className="font-bold text-slate-900 font-mono">
                      ₹{formatNumber(calculations.loan.crSum, 2)}
                    </span>
                  </button>

                  {expandedGroups["loanCr"] && sortedLoanCr.length > 0 && (
                    <div className="bg-slate-50/40 px-8 py-2 divide-y divide-slate-100/80 text-xs">
                      {sortedLoanCr.map((item) => (
                        <div key={item.id} className="py-2 flex justify-between text-slate-600">
                          <span className="capitalize">{item.name} {item.alias ? `(${item.alias})` : ""}</span>
                          <span className="font-semibold font-mono">₹{formatNumber(item.amount, 2)}</span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {/* 4. CLIENTS WITH CREDIT BALANCE */}
                <div className="flex flex-col">
                  <button
                    onClick={() => toggleGroup("clientCr")}
                    className="w-full px-4 py-3.5 flex justify-between items-center text-left hover:bg-slate-50/50 transition-colors"
                  >
                    <div className="flex items-center gap-2">
                      {expandedGroups["clientCr"] ? (
                        <ChevronDown className="h-4 w-4 text-slate-400 shrink-0" />
                      ) : (
                        <ChevronRight className="h-4 w-4 text-slate-400 shrink-0" />
                      )}
                      <span className="font-bold text-slate-700 text-sm uppercase tracking-wide">
                        4. Client Accounts (Credit Balance)
                      </span>
                    </div>
                    <span className="font-bold text-slate-900 font-mono">
                      ₹{formatNumber(calculations.client.crSum, 2)}
                    </span>
                  </button>

                  {expandedGroups["clientCr"] && sortedClientCr.length > 0 && (
                    <div className="bg-slate-50/40 px-8 py-2 divide-y divide-slate-100/80 text-xs">
                      {sortedClientCr.map((item) => (
                        <div key={item.id} className="py-2 flex justify-between text-slate-600">
                          <span className="capitalize">{item.name} {item.alias ? `(${item.alias})` : ""}</span>
                          <span className="font-semibold font-mono">₹{formatNumber(item.amount, 2)}</span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {/* 5. OTHER BALANCE SHEET CREDIT */}
                <div className="flex flex-col">
                  <button
                    onClick={() => toggleGroup("otherCr")}
                    className="w-full px-4 py-3.5 flex justify-between items-center text-left hover:bg-slate-50/50 transition-colors"
                  >
                    <div className="flex items-center gap-2">
                      {expandedGroups["otherCr"] ? (
                        <ChevronDown className="h-4 w-4 text-slate-400 shrink-0" />
                      ) : (
                        <ChevronRight className="h-4 w-4 text-slate-400 shrink-0" />
                      )}
                      <span className="font-bold text-slate-700 text-sm uppercase tracking-wide">
                        5. Other BS Accounts (Credit Balance)
                      </span>
                    </div>
                    <span className="font-bold text-slate-900 font-mono">
                      ₹{formatNumber(calculations.otherBs.crSum, 2)}
                    </span>
                  </button>

                  {expandedGroups["otherCr"] && sortedOtherCr.length > 0 && (
                    <div className="bg-slate-50/40 px-8 py-2 divide-y divide-slate-100/80 text-xs">
                      {sortedOtherCr.map((item) => (
                        <div key={item.id} className="py-2 flex justify-between text-slate-600">
                          <span className="capitalize">{item.name} {item.alias ? `(${item.alias})` : ""}</span>
                          <span className="font-semibold font-mono">₹{formatNumber(item.amount, 2)}</span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>

              {/* Liabilities Grand Total */}
              <div className="bg-slate-50 border-t border-slate-200 px-4 py-3 flex justify-between items-center font-black text-sm text-slate-900">
                <span className="uppercase tracking-wider">Total Liabilities</span>
                <span className="font-mono text-base">₹{formatNumber(totalLiabilities, 2)}</span>
              </div>
            </div>

            {/* ASSETS SIDE */}
            <div className="flex flex-col h-full">
              <div className="bg-slate-100/50 px-4 py-2.5 text-xs font-bold text-slate-700 border-b border-slate-200 flex justify-between uppercase">
                <span>Assets</span>
                <span>Amount (₹)</span>
              </div>

              <div className="flex-1 divide-y divide-slate-100 min-h-[350px]">
                {/* 1. CLOSING STOCK VALUE */}
                <div className="px-4 py-3.5 flex justify-between items-center text-sm">
                  <span className="font-bold text-slate-700 uppercase tracking-wide pl-6">
                    1. Closing Stock Value
                  </span>
                  <span className="font-bold text-slate-900 font-mono">
                    ₹{formatNumber(closingStockValue, 2)}
                  </span>
                </div>

                {/* 2. PROFIT / LOSS Dr. BALANCE */}
                <div className="px-4 py-3.5 flex justify-between items-center text-sm">
                  <span className="font-bold text-slate-700 uppercase tracking-wide pl-6">
                    2. Profit &amp; Loss A/c (Net Loss)
                  </span>
                  <span className="font-bold text-slate-900 font-mono">
                    {netLoss > 0 ? `₹${formatNumber(netLoss, 2)}` : "—"}
                  </span>
                </div>

                {/* 3. LOAN ACCOUNTS (DEBIT) */}
                <div className="flex flex-col">
                  <button
                    onClick={() => toggleGroup("loanDr")}
                    className="w-full px-4 py-3.5 flex justify-between items-center text-left hover:bg-slate-50/50 transition-colors"
                  >
                    <div className="flex items-center gap-2">
                      {expandedGroups["loanDr"] ? (
                        <ChevronDown className="h-4 w-4 text-slate-400 shrink-0" />
                      ) : (
                        <ChevronRight className="h-4 w-4 text-slate-400 shrink-0" />
                      )}
                      <span className="font-bold text-slate-700 text-sm uppercase tracking-wide">
                        3. Loan Accounts (Debit Balance)
                      </span>
                    </div>
                    <span className="font-bold text-slate-900 font-mono">
                      ₹{formatNumber(calculations.loan.drSum, 2)}
                    </span>
                  </button>

                  {expandedGroups["loanDr"] && sortedLoanDr.length > 0 && (
                    <div className="bg-slate-50/40 px-8 py-2 divide-y divide-slate-100/80 text-xs">
                      {sortedLoanDr.map((item) => (
                        <div key={item.id} className="py-2 flex justify-between text-slate-600">
                          <span className="capitalize">{item.name} {item.alias ? `(${item.alias})` : ""}</span>
                          <span className="font-semibold font-mono">₹{formatNumber(item.amount, 2)}</span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {/* 4. CLIENTS WITH DEBIT BALANCE */}
                <div className="flex flex-col">
                  <button
                    onClick={() => toggleGroup("clientDr")}
                    className="w-full px-4 py-3.5 flex justify-between items-center text-left hover:bg-slate-50/50 transition-colors"
                  >
                    <div className="flex items-center gap-2">
                      {expandedGroups["clientDr"] ? (
                        <ChevronDown className="h-4 w-4 text-slate-400 shrink-0" />
                      ) : (
                        <ChevronRight className="h-4 w-4 text-slate-400 shrink-0" />
                      )}
                      <span className="font-bold text-slate-700 text-sm uppercase tracking-wide">
                        4. Client Accounts (Debit Balance)
                      </span>
                    </div>
                    <span className="font-bold text-slate-900 font-mono">
                      ₹{formatNumber(calculations.client.drSum, 2)}
                    </span>
                  </button>

                  {expandedGroups["clientDr"] && sortedClientDr.length > 0 && (
                    <div className="bg-slate-50/40 px-8 py-2 divide-y divide-slate-100/80 text-xs">
                      {sortedClientDr.map((item) => (
                        <div key={item.id} className="py-2 flex justify-between text-slate-600">
                          <span className="capitalize">{item.name} {item.alias ? `(${item.alias})` : ""}</span>
                          <span className="font-semibold font-mono">₹{formatNumber(item.amount, 2)}</span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {/* 5. OTHER BALANCE SHEET DEBIT */}
                <div className="flex flex-col">
                  <button
                    onClick={() => toggleGroup("otherDr")}
                    className="w-full px-4 py-3.5 flex justify-between items-center text-left hover:bg-slate-50/50 transition-colors"
                  >
                    <div className="flex items-center gap-2">
                      {expandedGroups["otherDr"] ? (
                        <ChevronDown className="h-4 w-4 text-slate-400 shrink-0" />
                      ) : (
                        <ChevronRight className="h-4 w-4 text-slate-400 shrink-0" />
                      )}
                      <span className="font-bold text-slate-700 text-sm uppercase tracking-wide">
                        5. Other BS Accounts (Debit Balance)
                      </span>
                    </div>
                    <span className="font-bold text-slate-900 font-mono">
                      ₹{formatNumber(calculations.otherBs.drSum, 2)}
                    </span>
                  </button>

                  {expandedGroups["otherDr"] && sortedOtherDr.length > 0 && (
                    <div className="bg-slate-50/40 px-8 py-2 divide-y divide-slate-100/80 text-xs">
                      {sortedOtherDr.map((item) => (
                        <div key={item.id} className="py-2 flex justify-between text-slate-600">
                          <span className="capitalize">{item.name} {item.alias ? `(${item.alias})` : ""}</span>
                          <span className="font-semibold font-mono">₹{formatNumber(item.amount, 2)}</span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>

              {/* Assets Grand Total */}
              <div className="bg-slate-50 border-t border-slate-200 px-4 py-3 flex justify-between items-center font-black text-sm text-slate-900">
                <span className="uppercase tracking-wider">Total Assets</span>
                <span className="font-mono text-base">₹{formatNumber(totalAssets, 2)}</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
