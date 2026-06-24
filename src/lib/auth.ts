import { cache } from "react";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { navGroups } from "@/lib/navigation";
import type { AppUser, RoleName } from "@/lib/database.types";

export const getSessionUser = cache(async function getSessionUser() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return null;

  const { data: profile, error } = await supabase
    .from("users")
    .select("id, full_name, email, phone, status, role_id, roles(name, is_active, deleted_at)")
    .eq("id", user.id)
    .eq("status", "active")
    .is("deleted_at", null)
    .single();

  if (error || !profile) return null;

  const appUser = profile as AppUser;
  if (!appUser.roles?.name || appUser.roles.is_active === false || appUser.roles.deleted_at) return null;

  return appUser;
});

export async function requireUser() {
  const user = await getSessionUser();
  if (!user) redirect("/login");
  return user;
}

export async function requireRole(roles: RoleName[]) {
  const user = await requireUser();
  const role = user.roles?.name;
  if (!role || !roles.includes(role)) redirect("/dashboard");
  return user;
}

/** All page-level permission keys available in the system */
export const ALL_PAGE_PERMISSIONS: string[] = [
  // Admin
  "admin.credentials", "admin.permissions", "admin.raw_materials", "admin.products",
  "admin.clients", "admin.looms", "admin.colors", "admin.critical_levels",
  "admin.employees", "admin.attendance", "admin.reset",
  // Fabric
  "fabric.production", "fabric.consumption", "fabric.stock",
  // Roto Printing
  "roto_printing.production", "roto_printing.consumption", "roto_printing.stock",
  // Lamination
  "lamination.production", "lamination.consumption", "lamination.stock",
  // Offset Printing
  "offset_printing.production", "offset_printing.consumption", "offset_printing.stock",
  // Finishing
  "finishing.production", "finishing.consumption", "finishing.stock",
  // Sales
  "sales.order_confirmation", "sales.delivery_entry",
  // Accounts
  "accounts.journal", "accounts.purchase", "accounts.sales", "accounts.material",
  // Reports
  "reports.sales_confirmation", "reports.accounts", "reports.opening_balance",
  "reports.stock", "reports.closing_stock", "reports.profit_loss", "reports.balance_sheet",
  // Dashboard
  "dashboard.view",
];

export function fallbackPermissions(role: RoleName | undefined) {
  if (role === "admin") return ALL_PAGE_PERMISSIONS;
  if (role === "operator") return [
    "dashboard.view",
    "fabric.production", "fabric.consumption", "fabric.stock",
    "roto_printing.production", "roto_printing.consumption", "roto_printing.stock",
    "lamination.production", "lamination.consumption", "lamination.stock",
    "offset_printing.production", "offset_printing.consumption", "offset_printing.stock",
    "finishing.production", "finishing.consumption", "finishing.stock",
    "reports.stock", "reports.closing_stock",
  ];
  return [];
}

const getPermissionsForRole = cache(async function getPermissionsForRole(roleId: string, role: RoleName | undefined) {
  if (role === "admin") return ALL_PAGE_PERMISSIONS;

  const supabase = await createClient();
  const { data, error } = await (supabase
    .from("role_permissions")
    .select("permissions(module, action)")
    .eq("role_id", roleId) as any);

  if (error || !data?.length) return fallbackPermissions(role);

  return data
    .map((row: any) => row.permissions ? `${row.permissions.module}.${row.permissions.action}` : null)
    .filter(Boolean) as string[];
});

export async function getSessionPermissions(user?: AppUser) {
  const activeUser = user ?? await getSessionUser();
  if (!activeUser) return [];
  return getPermissionsForRole(activeUser.role_id, activeUser.roles?.name);
}

export async function requirePermission(permission: string) {
  const user = await requireUser();
  if (user.roles?.name === "admin") return user;
  const permissions = await getSessionPermissions(user);
  if (!permissions.includes(permission)) redirect("/403");
  return user;
}

export function isAdmin(user: AppUser | null) {
  return user?.roles?.name === "admin";
}
