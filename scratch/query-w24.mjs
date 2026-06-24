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

console.log("=== DIAGNOSING W-24-3 STOCK SPLIT ===");

// 1. Fetch fabric_types where name is W-24-3
const { data: fabricTypes, error: ftErr } = await supabase
  .from("fabric_types")
  .select("*")
  .eq("fabric_name", "W-24-3");

if (ftErr) {
  console.error("Error fetching fabric types:", ftErr);
} else {
  console.log("\nFabric Types in Database:");
  console.log(JSON.stringify(fabricTypes, null, 2));
}

// 2. Fetch fabric_rolls grouped by type
if (fabricTypes && fabricTypes.length > 0) {
  const ftIds = fabricTypes.map((ft) => ft.id);
  const { data: rolls, error: rErr } = await supabase
    .from("fabric_rolls")
    .select("*")
    .in("fabric_type_id", ftIds)
    .is("deleted_at", null);

  if (rErr) {
    console.error("Error fetching rolls:", rErr);
  } else {
    console.log("\nFabric Rolls count per Type ID:");
    for (const ft of fabricTypes) {
      const ftRolls = (rolls || []).filter((r) => r.fabric_type_id === ft.id);
      console.log(`Fabric Type: ${ft.fabric_name} (ID: ${ft.id})`);
      console.log(`- Status: ${ft.status}`);
      console.log(`- Deleted At: ${ft.deleted_at}`);
      console.log(`- Rolls Count: ${ftRolls.length}`);
      console.log(`- Rolls:`, ftRolls.map((r) => ({ id: r.id, roll_number: r.roll_number, status: r.status, weight: r.weight, meters: r.meters })));
    }
  }
}
