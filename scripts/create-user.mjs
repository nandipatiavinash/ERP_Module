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

function readArgs() {
  const args = new Map();
  for (let index = 2; index < process.argv.length; index += 2) {
    const key = process.argv[index]?.replace(/^--/, "");
    const value = process.argv[index + 1];
    if (key && value) args.set(key, value);
  }
  return args;
}

const args = readArgs();
const env = { ...loadEnvFile(resolve(".env.local")), ...process.env };
const url = env.NEXT_PUBLIC_SUPABASE_URL;
const serviceRoleKey = env.SUPABASE_SERVICE_ROLE_KEY;
const email = args.get("email");
const password = args.get("password");
const fullName = args.get("name");
const phone = args.get("phone") ?? null;
const roleName = args.get("role") ?? "admin";

if (!url || !serviceRoleKey) {
  throw new Error("Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in .env.local.");
}

if (!email || !password || !fullName) {
  throw new Error("Usage: npm run create-user -- --email user@example.com --password StrongPass123 --name \"Full Name\" --role admin");
}

const supabase = createClient(url, serviceRoleKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false,
  },
});

const { data: role, error: roleError } = await supabase
  .from("roles")
  .select("id, name")
  .eq("name", roleName)
  .is("deleted_at", null)
  .single();

if (roleError || !role) {
  throw new Error(`Role "${roleName}" was not found. Run the database migration first.`);
}

const { data: authData, error: authError } = await supabase.auth.admin.createUser({
  email,
  password,
  email_confirm: true,
  user_metadata: {
    full_name: fullName,
    phone,
  },
});

if (authError) throw new Error(authError.message);
const userId = authData.user?.id;
if (!userId) throw new Error("Supabase did not return a user id.");

const { error: profileError } = await supabase.from("users").upsert({
  id: userId,
  role_id: role.id,
  full_name: fullName,
  email,
  phone,
  status: "active",
});

if (profileError) {
  await supabase.auth.admin.deleteUser(userId);
  throw new Error(profileError.message);
}

console.log(`Created ${role.name} user: ${email}`);
