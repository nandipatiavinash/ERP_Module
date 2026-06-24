"use server";

import { revalidatePath } from "next/cache";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

export async function signIn(_: unknown, formData: FormData) {
  const supabase = await createClient();
  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  const password = String(formData.get("password") ?? "");
  const { data, error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) return { error: "Invalid email or password." };

  const userId = data.user?.id;
  if (!userId) {
    await supabase.auth.signOut();
    return { error: "Supabase did not return a user session." };
  }

  const { data: profile, error: profileError } = await (supabase
    .from("users")
    .select("id, status, deleted_at, roles(name, is_active, deleted_at)")
    .eq("id", userId)
    .single() as any);

  const role = profile?.roles as { name?: string; is_active?: boolean; deleted_at?: string | null } | null | undefined;
  if (profileError || !profile || profile.status !== "active" || profile.deleted_at || !role?.name || role.is_active === false || role.deleted_at) {
    await supabase.auth.signOut();
    return { error: "Your login exists in Supabase Auth, but no active ERP profile/role is assigned. Ask an admin to activate your ERP user." };
  }

  redirect("/dashboard");
}

export async function signOut() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect("/login");
}

export async function resetPassword(_: unknown, formData: FormData) {
  const supabase = await createClient();
  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  const requestOrigin = (await headers()).get("origin") ?? "";
  const origin = process.env.NEXT_PUBLIC_SITE_URL || requestOrigin;
  if (!origin) return { error: "Password reset is not configured for this deployment." };
  const { error } = await supabase.auth.resetPasswordForEmail(email, {
    redirectTo: `${origin}/reset-password`,
  });
  if (error) return { error: "Unable to send password reset email." };
  return { success: "Password reset email sent." };
}

export async function revalidateApp(paths: string[]) {
  for (const path of paths) revalidatePath(path);
}
