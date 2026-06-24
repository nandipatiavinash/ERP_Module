import Link from "next/link";
import { requirePermission } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { todayInIndia } from "@/lib/utils";
import { PageHeader } from "@/components/app/page-header";
import { DateFilter } from "@/components/app/date-filter";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { AlertCircle } from "lucide-react";
import { ProfitLossReportClient } from "./ProfitLossReportClient";

export default async function ProfitLossReportPage({
  searchParams,
}: {
  searchParams: Promise<{ date?: string }>;
}) {
  await requirePermission("reports.profit_loss");
  const params = await searchParams;
  const date = params.date || todayInIndia();

  const supabase = await createClient();

  // 1. Fetch closing stock submission from settings
  const { data: closingStockSetting } = await supabase
    .from("settings")
    .select("value")
    .eq("key", `closing_stock_${date}`)
    .maybeSingle();

  const submittedClosingStock = (closingStockSetting as any)?.value || null;

  if (!submittedClosingStock) {
    return (
      <div className="space-y-6">
        <PageHeader
          title="Profit & Loss Account"
          description="View company financial performance statements."
        />
        <div className="flex justify-end">
          <DateFilter date={date} baseUrl="/reports/profit-loss" />
        </div>
        <Card className="border-amber-200 bg-amber-50/30">
          <CardContent className="flex flex-col items-center justify-center py-12 text-center space-y-4">
            <AlertCircle className="h-12 w-12 text-amber-600" />
            <div className="space-y-2 max-w-md">
              <h3 className="text-lg font-bold text-amber-950">Closing Stock Required</h3>
              <p className="text-sm text-amber-800">
                To open the Profit & Loss statement for any given day, the Closing Stock must be submitted first. No submission found for {date}.
              </p>
            </div>
            <Button asChild className="bg-amber-600 hover:bg-amber-700 text-white mt-2">
              <Link href={`/reports/closing-stock?date=${date}`}>
                Go Submit Closing Stock
              </Link>
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  // 2. Fetch P&L accounts from customers (since general ledger accounts are in customers table)
  const { data: plAccounts } = await supabase
    .from("customers")
    .select("id, customer_name, alias, opening_debit, opening_credit, is_internal")
    .or("is_internal.eq.profit and loss a/c,is_internal.eq.p&l")
    .is("deleted_at", null);

  // 3. Fetch journal entries up to the selected date
  const { data: journalEntries } = await supabase
    .from("accounts_journal")
    .select("account_id, account_name, entry_type, amount")
    .lte("entry_date", date)
    .is("deleted_at", null);

  // 4. Fetch existing P&L submission
  const { data: plSetting } = await supabase
    .from("settings")
    .select("value")
    .eq("key", `profit_loss_${date}`)
    .maybeSingle();

  const submittedPL = (plSetting as any)?.value || null;

  return (
    <div className="space-y-6">
      <div className="no-print">
        <PageHeader
          title="Profit & Loss Account"
          description="View company financial performance statements."
        />
      </div>

      <div className="flex flex-col gap-4">
        <div className="flex justify-end no-print">
          <DateFilter date={date} baseUrl="/reports/profit-loss" />
        </div>

        <ProfitLossReportClient
          date={date}
          accounts={plAccounts || []}
          entries={journalEntries || []}
          closingStockValue={submittedClosingStock.grandTotal}
          submittedPL={submittedPL}
        />
      </div>
    </div>
  );
}
