import { requirePermission, requireRole } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { OpeningBalanceClient } from "./OpeningBalanceClient";

export default async function OpeningBalancePage() {
  await requireRole(["admin"]);
  await requirePermission("reports.opening_balance");

  const supabase = await createClient();

  // Fetch all active accounts ordered alphabetically by customer_name
  const { data: accounts } = await supabase
    .from("customers")
    .select("id, customer_name, alias, opening_debit, opening_credit, is_internal")
    .eq("status", "active")
    .is("deleted_at", null)
    .order("customer_name");

  return (
    <OpeningBalanceClient
      accounts={(accounts ?? []) as any[]}
    />
  );
}
