const { createClient } = require("@supabase/supabase-js");
const https = require("https");
const fs = require("fs");
const path = require("path");

function loadEnvFile(path) {
  const env = {};
  try {
    const content = fs.readFileSync(path, "utf8");
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

const env = { ...loadEnvFile(path.resolve(".env.local")), ...process.env };
const url = env.NEXT_PUBLIC_SUPABASE_URL;
const serviceKey = env.SUPABASE_SERVICE_ROLE_KEY;

if (!url || !serviceKey) {
  console.error("Supabase credentials missing.");
  process.exit(1);
}

function fetchJson(targetUrl, apiKey) {
  return new Promise((resolve, reject) => {
    https.get(
      targetUrl,
      {
        headers: {
          "User-Agent": "NodeJS-App",
          "apikey": apiKey,
        },
      },
      (res) => {
        let data = "";
        res.on("data", (chunk) => (data += chunk));
        res.on("end", () => {
          try {
            resolve(JSON.parse(data));
          } catch (e) {
            reject(new Error("Failed to parse JSON: " + data.substring(0, 100)));
          }
        });
      }
    ).on("error", reject);
  });
}

async function main() {
  try {
    console.log("Fetching OpenAPI schema from PostgREST...");
    const schema = await fetchJson(url + "/rest/v1/", serviceKey);
    console.log("\nAvailable database paths (tables, views, RPCs):");
    const paths = Object.keys(schema.paths || {});
    console.log(JSON.stringify(paths, null, 2));
  } catch (err) {
    console.error("Error:", err.message);
  }
}

main();
