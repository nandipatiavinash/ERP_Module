import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { createClient } from "@supabase/supabase-js";

function loadEnvFile(path) {
  const env = {};
  const content = readFileSync(path, "utf8");
  for (const line of content.split(/\r?\n/)) {
    if (!line || line.trim().startsWith("#")) continue;
    const index = line.indexOf("=");
    if (index === -1) continue;
    const key = line.slice(0, index).trim();
    const value = line.slice(index + 1).trim().replace(/^["']|["']$/g, "");
    env[key] = value;
  }
  return env;
}

const env = { ...loadEnvFile(resolve("c:/Users/nandi/Downloads/polymer-fabric-erp (2)/polymer-fabric-erp/.env.local")), ...process.env };
const url = env.NEXT_PUBLIC_SUPABASE_URL;
const serviceRoleKey = env.SUPABASE_SERVICE_ROLE_KEY;

const supabase = createClient(url, serviceRoleKey);
const { data, error } = await supabase
  .from("customers")
  .select("id, customer_name, is_internal")
  .neq("is_internal", "client a/c")
  .is("deleted_at", null);

console.log("Non-client accounts:", data);
console.log("Error:", error);
