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

const supabase = createClient(url, serviceRoleKey);

const oldId = "7a247df2-2196-45e7-af82-fac7b7dd27da";
const newId = "856750d9-eaf1-4469-a374-f1c683658e73";

console.log(`Checking references for old fabric_type_id: ${oldId}`);

// 1. Check loom_production_entries
const { data: lpeRows } = await supabase
  .from("loom_production_entries")
  .select("id, serial_number, entry_date")
  .eq("fabric_type_id", oldId);
console.log(`Loom Production Entries referencing old ID: ${lpeRows?.length ?? 0}`);
if (lpeRows?.length) console.log(lpeRows);

// 2. Check fabric_rolls
const { data: rollRows } = await supabase
  .from("fabric_rolls")
  .select("id, roll_number, status")
  .eq("fabric_type_id", oldId);
console.log(`Fabric Rolls referencing old ID: ${rollRows?.length ?? 0}`);
if (rollRows?.length) console.log(rollRows);

// 3. Check sales_orders
const { data: orderRows } = await supabase
  .from("sales_orders")
  .select("id, order_number, status")
  .eq("fabric_type_id", oldId);
console.log(`Sales Orders referencing old ID: ${orderRows?.length ?? 0}`);
if (orderRows?.length) console.log(orderRows);
