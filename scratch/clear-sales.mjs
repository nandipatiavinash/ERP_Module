import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { createClient } from "@supabase/supabase-js";

function loadEnvFile(path) {
  const env = {};
  try {
    const content = readFileSync(path, "utf8");
    for (const line of content.split(/\r?\n/)) {
      if (!line || line.trim().startsWith("#")) continue;
      const index = line.indexOf("=");
      if (index === -1) continue;
      const key = line.slice(0, index).trim();
      const value = line.slice(index + 1).trim().replace(/^["']|["']$/g, "");
      env[key] = value;
    }
  } catch (e) {}
  return env;
}

const env = { ...loadEnvFile(resolve(".env.local")), ...process.env };
const url = env.NEXT_PUBLIC_SUPABASE_URL;
const serviceRoleKey = env.SUPABASE_SERVICE_ROLE_KEY;

if (!url || !serviceRoleKey) {
  console.error("Supabase URL or Service Role Key missing in .env.local!");
  process.exit(1);
}

const supabase = createClient(url, serviceRoleKey);

console.log("=== CLEARING ALL SALES ENTRIES ===");

try {
  // 1. Reset fabric rolls status
  console.log("Resetting sold fabric rolls back to 'available'...");
  const { error: rollErr } = await supabase
    .from("fabric_rolls")
    .update({ status: "available" })
    .eq("status", "sold");
  if (rollErr) throw rollErr;

  // 2. Fetch journal entry numbers to delete
  console.log("Identifying Sales journal entries...");
  const { data: salesAc } = await supabase
    .from("customers")
    .select("id")
    .eq("customer_name", "Sales A/c")
    .maybeSingle();

  if (salesAc) {
    const { data: journalRows } = await supabase
      .from("accounts_journal")
      .select("journal_no")
      .eq("account_id", salesAc.id);

    const journalNos = (journalRows || []).map((r) => r.journal_no);
    if (journalNos.length > 0) {
      console.log(`Deleting ${journalNos.length} sales journal entries...`);
      const { error: jErr } = await supabase
        .from("accounts_journal")
        .delete()
        .in("journal_no", journalNos);
      if (jErr) throw jErr;
    }
  }

  // 3. Delete Sales Order Items (cascaded by DB but let's delete explicitly to be safe)
  console.log("Deleting sales order items...");
  const { error: itemsErr } = await supabase
    .from("sales_order_items")
    .delete()
    .neq("id", "00000000-0000-0000-0000-000000000000"); // deletes all
  if (itemsErr) throw itemsErr;

  // 4. Delete Sales Orders
  console.log("Deleting sales orders...");
  const { error: ordersErr } = await supabase
    .from("sales_orders")
    .delete()
    .neq("id", "00000000-0000-0000-0000-000000000000"); // deletes all
  if (ordersErr) throw ordersErr;

  console.log("🎉 Successfully cleared all sales entries, reset roll allocations, and deleted matching double-entry bookkeeping lines!");
} catch (err) {
  console.error("❌ Failed to clear sales entries:", err.message || err);
  process.exit(1);
}
