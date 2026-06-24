import { requirePermission } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { todayInIndia } from "@/lib/utils";
import { AccountReportsClient } from "./AccountReportsClient";

type Params = { from?: string; to?: string; accountId?: string };

export default async function AccountReportsPage({ searchParams }: { searchParams: Promise<Params> }) {
  await requirePermission("reports.accounts");
  const params = await searchParams;
  const today = todayInIndia();
  const from = params.from || (today.slice(0, 8) + "01"); // Default to start of month
  const to = params.to || today;
  const accountId = params.accountId || "";

  const supabase = await createClient();

  // Fetch active customers for the dropdown selection
  const { data: customersData } = await supabase
    .from("customers")
    .select("id, customer_name, alias, is_internal, opening_debit, opening_credit")
    .eq("status", "active")
    .is("deleted_at", null)
    .order("customer_name");

  const customers = (customersData ?? []) as any[];

  let journalEntries: any[] = [];
  let selectedAccount: any = null;

  if (accountId) {
    selectedAccount = customers?.find((c) => c.id === accountId) || null;
    
    // Fetch all journal entries for this account up to the 'to' date
    // (This includes historical ones before 'from' to compute the opening balance)
    let query = supabase
      .from("accounts_journal")
      .select("*")
      .lte("entry_date", to)
      .is("deleted_at", null);

    if (selectedAccount) {
      const conditions = [`account_id.eq.${accountId}`];
      // Escape spaces in the search string for Supabase OR query (we can use %20 or just quotes, but in Postgres ilike filter, backslash escaping or simple quotes works. Wait, in Supabase PostgREST, spaces inside ilike are represented by wrapping in double quotes: account_name.ilike."KVR & COMPANY")
      conditions.push(`account_name.ilike."${selectedAccount.customer_name}"`);
      if (selectedAccount.alias) {
        conditions.push(`account_name.ilike."${selectedAccount.alias}"`);
        conditions.push(`account_name.ilike."${selectedAccount.alias} A/c"`);
      }
      const nameWithAc = selectedAccount.customer_name.toLowerCase().endsWith(" a/c")
        ? selectedAccount.customer_name
        : `${selectedAccount.customer_name} A/c`;
      conditions.push(`account_name.ilike."${nameWithAc}"`);
      
      query = query.or(conditions.join(","));
    } else {
      query = query.eq("account_id", accountId);
    }

    const { data: entries } = await query
      .order("entry_date", { ascending: true })
      .order("created_at", { ascending: true });

    journalEntries = entries || [];
  } else {
    // If nothing selected, fetch all journal entries up to the 'to' date
    const { data: entries } = await supabase
      .from("accounts_journal")
      .select("*, customers(customer_name, alias)")
      .lte("entry_date", to)
      .is("deleted_at", null)
      .order("entry_date", { ascending: true })
      .order("created_at", { ascending: true });

    journalEntries = entries || [];
  }

  return (
    <AccountReportsClient
      from={from}
      to={to}
      accountId={accountId}
      accounts={(customers ?? []) as any[]}
      selectedAccount={selectedAccount}
      entries={journalEntries}
    />
  );
}
