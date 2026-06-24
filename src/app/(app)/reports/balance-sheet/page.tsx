import Link from "next/link";
import { requirePermission } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { todayInIndia } from "@/lib/utils";
import { PageHeader } from "@/components/app/page-header";
import { DateFilter } from "@/components/app/date-filter";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { AlertCircle } from "lucide-react";
import { BalanceSheetClient } from "./BalanceSheetClient";

export default async function BalanceSheetPage({
  searchParams,
}: {
  searchParams: Promise<{ date?: string }>;
}) {
  await requirePermission("reports.balance_sheet");
  const params = await searchParams;
  const date = params.date || todayInIndia();

  const supabase = await createClient();

  // 1. Fetch closing stock and P&L submissions
  const [{ data: csSetting }, { data: plSetting }] = await Promise.all([
    supabase
      .from("settings")
      .select("value")
      .eq("key", `closing_stock_${date}`)
      .maybeSingle(),
    supabase
      .from("settings")
      .select("value")
      .eq("key", `profit_loss_${date}`)
      .maybeSingle(),
  ]);

  const closingStock = (csSetting as any)?.value || null;
  const profitLoss = (plSetting as any)?.value || null;

  const isCsMissing = !closingStock;
  const isPlMissing = !profitLoss;

  if (isCsMissing || isPlMissing) {
    return (
      <div className="space-y-6">
        <PageHeader
          title="Balance Sheet"
          description="Company balance sheet statement of liabilities and assets."
        />
        <div className="flex justify-end">
          <DateFilter date={date} baseUrl="/reports/balance-sheet" />
        </div>
        <Card className="border-amber-200 bg-amber-50/30">
          <CardContent className="flex flex-col items-center justify-center py-12 text-center space-y-4">
            <AlertCircle className="h-12 w-12 text-amber-600" />
            <div className="space-y-2 max-w-md">
              <h3 className="text-lg font-bold text-amber-950">Submissions Required First</h3>
              <p className="text-sm text-amber-800">
                To view the Balance Sheet for any given day, both the Closing Stock and the Profit & Loss statement must be submitted first.
              </p>
              <div className="text-left text-xs bg-white border border-amber-200 p-3 rounded mt-2 space-y-1 font-semibold text-slate-700">
                <div className="flex items-center gap-2">
                  <span className={closingStock ? "text-emerald-600" : "text-rose-600"}>
                    {closingStock ? "✓" : "✗"}
                  </span>
                  <span>Closing Stock Submission</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className={profitLoss ? "text-emerald-600" : "text-rose-600"}>
                    {profitLoss ? "✓" : "✗"}
                  </span>
                  <span>Profit & Loss Submission</span>
                </div>
              </div>
            </div>
            <div className="flex gap-3 mt-4">
              {isCsMissing && (
                <Button asChild className="bg-amber-600 hover:bg-amber-700 text-white">
                  <Link href={`/reports/closing-stock?date=${date}`}>
                    Submit Closing Stock
                  </Link>
                </Button>
              )}
              {isPlMissing && !isCsMissing && (
                <Button asChild className="bg-amber-600 hover:bg-amber-700 text-white">
                  <Link href={`/reports/profit-loss?date=${date}`}>
                    Submit Profit & Loss
                  </Link>
                </Button>
              )}
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  // 2. Fetch all active ledger accounts (customers table contains client, capital, loan, balance sheet a/c)
  const { data: accounts } = await supabase
    .from("customers")
    .select("id, customer_name, alias, opening_debit, opening_credit, is_internal")
    .is("deleted_at", null);

  // 3. Fetch all journal entries up to the selected date
  const { data: journalEntries } = await supabase
    .from("accounts_journal")
    .select("account_id, account_name, entry_type, amount")
    .lte("entry_date", date)
    .is("deleted_at", null);

  return (
    <div className="space-y-6">
      <div className="no-print">
        <PageHeader
          title="Balance Sheet"
          description="Company balance sheet statement of liabilities and assets."
        />
      </div>

      <div className="flex flex-col gap-4">
        <div className="flex justify-end no-print">
          <DateFilter date={date} baseUrl="/reports/balance-sheet" />
        </div>

        <BalanceSheetClient
          date={date}
          accounts={accounts || []}
          entries={journalEntries || []}
          closingStockValue={closingStock.grandTotal}
          netProfit={profitLoss.netProfit || 0}
          netLoss={profitLoss.netLoss || 0}
        />
      </div>
    </div>
  );
}
