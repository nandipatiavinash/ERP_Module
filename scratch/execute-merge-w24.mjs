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
const activeId = "856750d9-eaf1-4469-a374-f1c683658e73";
const newLpeId = "8017eb92-d5b1-45a1-adb3-480d2b8fb0f4";

console.log("=== EXECUTING MERGE FOR W-24-3 ===");

try {
  // 1. Rename the active roll's production entry serial number from "1" to "10"
  // (which will trigger updating the fabric_roll's roll_number to "10")
  console.log('Renaming active roll (serial "1" -> "10") to avoid unique key conflicts...');
  const { error: renameErr } = await supabase
    .from("loom_production_entries")
    .update({ serial_number: "10" })
    .eq("id", newLpeId);
  if (renameErr) throw renameErr;
  console.log("✅ Active roll renamed successfully.");

  // 2. Update the fabric_type_id on all old production entries from oldId to activeId
  // (which will trigger updating the corresponding fabric_rolls.fabric_type_id)
  console.log(`Migrating 9 production entries from old ID (${oldId}) to active ID (${activeId})...`);
  const { error: migrateErr } = await supabase
    .from("loom_production_entries")
    .update({ fabric_type_id: activeId })
    .eq("fabric_type_id", oldId);
  if (migrateErr) throw migrateErr;
  console.log("✅ Loom production entries migrated successfully.");

  // 3. Let's verify the counts
  console.log("\nVerifying migration results...");
  const { data: activeRolls } = await supabase
    .from("fabric_rolls")
    .select("roll_number, status, weight, meters")
    .eq("fabric_type_id", activeId)
    .is("deleted_at", null);
  
  const { data: oldRolls } = await supabase
    .from("fabric_rolls")
    .select("roll_number")
    .eq("fabric_type_id", oldId)
    .is("deleted_at", null);

  console.log(`- Rolls count under active ID (${activeId}): ${activeRolls?.length ?? 0}`);
  console.log(`- Rolls count under old ID (${oldId}): ${oldRolls?.length ?? 0}`);
  console.log(`- Active rolls detail:`, activeRolls?.sort((a,b) => Number(a.roll_number) - Number(b.roll_number)));

  console.log("\n🎉 Merge completed successfully with zero errors!");
} catch (err) {
  console.error("❌ Merge failed:", err.message || err);
  process.exit(1);
}
