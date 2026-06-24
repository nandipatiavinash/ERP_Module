import { createClient } from "@supabase/supabase-js";
import { readFileSync } from "fs";
import { resolve } from "path";

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
  } catch (e) {
    console.error("Error reading env file:", e);
  }
  return env;
}

const env = { ...loadEnvFile(resolve(".env.local")), ...process.env };
const url = env.NEXT_PUBLIC_SUPABASE_URL;
const serviceKey = env.SUPABASE_SERVICE_ROLE_KEY;

const supabase = createClient(url, serviceKey);

async function run() {
  console.log("Deleting all records from fabric_rolls...");
  const { error: rollsError } = await supabase
    .from("fabric_rolls")
    .delete()
    .neq("id", "00000000-0000-0000-0000-000000000000"); // deletes all

  if (rollsError) {
    console.error("Failed to delete fabric rolls:", rollsError);
  } else {
    console.log("Successfully cleared fabric_rolls.");
  }

  console.log("Deleting all records from loom_production_entries...");
  const { error: prodError } = await supabase
    .from("loom_production_entries")
    .delete()
    .neq("id", "00000000-0000-0000-0000-000000000000"); // deletes all

  if (prodError) {
    console.error("Failed to delete production entries:", prodError);
  } else {
    console.log("Successfully cleared loom_production_entries.");
  }
}

run();
