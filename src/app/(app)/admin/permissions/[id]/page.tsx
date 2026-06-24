import { deactivateRole, saveRoleDetails, saveRolePermissions } from "@/app/(app)/_actions";
import { ConfirmSubmitButton } from "@/components/app/confirm-submit-button";
import { PageHeader } from "@/components/app/page-header";
import { StatusBadge } from "@/components/app/status-badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { requirePermission } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { ArrowLeft } from "lucide-react";
import Link from "next/link";
import { notFound } from "next/navigation";

// Section grouping for display
const SECTION_META: Record<string, { label: string; order: number }> = {
  admin:           { label: "Admin",           order: 0 },
  fabric:          { label: "Fabric",          order: 1 },
  roto_printing:   { label: "Roto Printing",   order: 2 },
  lamination:      { label: "Lamination",      order: 3 },
  offset_printing: { label: "Offset Printing", order: 4 },
  finishing:       { label: "Finishing",       order: 5 },
  sales:           { label: "Sales",           order: 6 },
  accounts:        { label: "Accounts",        order: 7 },
  reports:         { label: "Reports",         order: 8 },
};

const ACTION_LABELS: Record<string, string> = {
  credentials:        "Login Credentials",
  permissions:        "Login Permissions",
  raw_materials:      "Raw Material IDs",
  products:           "Product IDs",
  clients:            "Account / Client IDs",
  looms:              "Loom IDs",
  colors:             "Printing Colour IDs",
  critical_levels:    "Raw Material Critical Levels",
  employees:          "Employees",
  attendance:         "Attendance",
  reset:              "System Reset",
  production:         "Production",
  consumption:        "Consumption",
  stock:              "Stock",
  order_confirmation: "Order Confirmation",
  delivery_entry:     "Delivery Entry",
  journal:            "Journal Entry",
  purchase:           "Purchase Entry",
  sales:              "Sales Entry",
  material:           "Material Sales",
  sales_confirmation: "Sales Confirmation",
  accounts:           "Account Reports",
  opening_balance:    "Opening Balance",
  profit_loss:        "Profit & Loss",
  balance_sheet:      "Balance Sheet",
};

function sectionLabel(module: string) {
  return SECTION_META[module]?.label ?? module.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

function actionLabel(action: string) {
  return ACTION_LABELS[action] ?? action.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

export default async function RolePermissionsPage({ params }: { params: Promise<{ id: string }> }) {
  await requirePermission("admin.permissions");
  const { id: roleId } = await params;

  const supabase = await createClient();
  const [{ data: roleData }, { data: permissions }, { data: assigned }] = await Promise.all([
    (supabase.from("roles") as any).select("*").eq("id", roleId).is("deleted_at", null).single(),
    supabase.from("permissions").select("*").order("module").order("action"),
    supabase.from("role_permissions").select("permission_id").eq("role_id", roleId),
  ]);

  if (!roleData) notFound();

  const role = roleData as any;
  const permissionRows = (permissions ?? []) as any[];
  const assignedIds = new Set(((assigned ?? []) as any[]).map((r) => r.permission_id));

  // Group by module, sorted by section order
  const groupedPermissions = permissionRows.reduce<Record<string, any[]>>((acc, p) => {
    acc[p.module] ??= [];
    acc[p.module].push(p);
    return acc;
  }, {});

  const sortedModules = Object.keys(groupedPermissions).sort((a, b) => {
    const oa = SECTION_META[a]?.order ?? 99;
    const ob = SECTION_META[b]?.order ?? 99;
    return oa - ob;
  });

  const totalAssigned = permissionRows.filter((p) => assignedIds.has(p.id)).length;

  return (
    <>
      {/* Back link */}
      <div className="mb-4">
        <Link
          href="/admin/permissions"
          className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to Roles
        </Link>
      </div>

      <PageHeader
        title={role.name.charAt(0).toUpperCase() + role.name.slice(1)}
        description={role.description || "No description"}
      >
        <StatusBadge value={role.is_active ? "active" : "inactive"} />
      </PageHeader>

      <div className="mt-6 space-y-6">
        {/* Edit role name / description */}
        <Card>
          <CardHeader><CardTitle>Role Details</CardTitle></CardHeader>
          <CardContent>
            <form action={saveRoleDetails} className="grid gap-4 md:grid-cols-[1fr_2fr_auto] md:items-end">
              <input type="hidden" name="role_id" value={role.id} />
              <div className="space-y-2">
                <Label htmlFor="name">Role Name</Label>
                <Input id="name" name="name" defaultValue={role.name} required />
              </div>
              <div className="space-y-2">
                <Label htmlFor="description">Description</Label>
                <Input id="description" name="description" defaultValue={role.description ?? ""} />
              </div>
              <ConfirmSubmitButton
                variant="outline"
                confirmTitle="Save role changes?"
                confirmDescription="Confirm the role name and description before saving."
              >
                Save Details
              </ConfirmSubmitButton>
            </form>
          </CardContent>
        </Card>

        {/* Permission assignment */}
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle>Page Permissions</CardTitle>
              <span className="text-sm text-muted-foreground font-normal">
                {totalAssigned} / {permissionRows.length} enabled
              </span>
            </div>
          </CardHeader>
          <CardContent>
            <form action={saveRolePermissions} className="space-y-5">
              <input type="hidden" name="role_id" value={role.id} />

              <div className="space-y-4">
                {sortedModules.map((module) => {
                  const modulePerms = groupedPermissions[module];
                  const checkedCount = modulePerms.filter((p: any) => assignedIds.has(p.id)).length;

                  return (
                    <div key={module} className="rounded-lg border overflow-hidden">
                      {/* Section header */}
                      <div className="flex items-center justify-between bg-muted/50 px-4 py-3 border-b">
                        <span className="text-sm font-semibold tracking-wide">{sectionLabel(module)}</span>
                        <span className="text-xs text-muted-foreground tabular-nums">
                          {checkedCount}/{modulePerms.length} enabled
                        </span>
                      </div>

                      {/* Page-level checkboxes */}
                      <div className="divide-y">
                        {modulePerms.map((permission: any) => (
                          <label
                            key={permission.id}
                            className="flex items-center gap-3 px-4 py-3 text-sm hover:bg-muted/30 cursor-pointer transition-colors"
                          >
                            <input
                              type="checkbox"
                              name="permission_ids"
                              value={permission.id}
                              defaultChecked={assignedIds.has(permission.id)}
                              className="h-4 w-4 accent-primary shrink-0"
                            />
                            <div className="flex flex-col gap-0.5">
                              <span className="font-medium">{actionLabel(permission.action)}</span>
                              {permission.description && (
                                <span className="text-xs text-muted-foreground">{permission.description}</span>
                              )}
                            </div>
                          </label>
                        ))}
                      </div>
                    </div>
                  );
                })}
              </div>

              <ConfirmSubmitButton
                confirmTitle="Save permission matrix?"
                confirmDescription="This will replace the role's current permission assignments."
              >
                Save Permissions
              </ConfirmSubmitButton>
            </form>
          </CardContent>
        </Card>

        {/* Danger zone */}
        <Card className="border-destructive/30">
          <CardHeader>
            <CardTitle className="text-destructive text-base">Danger Zone</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium">Deactivate this role</p>
                <p className="text-xs text-muted-foreground mt-0.5">
                  This role will be marked inactive and users with this role will lose access.
                </p>
              </div>
              <form action={deactivateRole}>
                <input type="hidden" name="role_id" value={role.id} />
                <ConfirmSubmitButton
                  variant="outline"
                  confirmTitle="Deactivate role?"
                  confirmDescription="This role will be marked inactive. Users assigned this role will lose access."
                >
                  Deactivate Role
                </ConfirmSubmitButton>
              </form>
            </div>
          </CardContent>
        </Card>
      </div>
    </>
  );
}
