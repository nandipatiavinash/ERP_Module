import { createRole } from "@/app/(app)/_actions";
import { ConfirmSubmitButton } from "@/components/app/confirm-submit-button";
import { PageHeader } from "@/components/app/page-header";
import { StatusBadge } from "@/components/app/status-badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { requirePermission } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { ChevronRight, Users } from "lucide-react";
import Link from "next/link";

export default async function PermissionsPage() {
  await requirePermission("admin.permissions");
  const supabase = await createClient();
  const [{ data: roles }, { data: permissions }, { data: assigned }] = await Promise.all([
    supabase.from("roles").select("*").is("deleted_at", null).order("name"),
    supabase.from("permissions").select("id, module, action").order("module").order("action"),
    supabase.from("role_permissions").select("role_id, permission_id"),
  ]);

  const roleRows = (roles ?? []) as any[];
  const permissionRows = (permissions ?? []) as any[];
  const totalPermissions = permissionRows.length;

  // Build count of assigned permissions per role
  const assignedByRole = ((assigned ?? []) as any[]).reduce<Record<string, number>>((acc, row) => {
    acc[row.role_id] = (acc[row.role_id] ?? 0) + 1;
    return acc;
  }, {});

  return (
    <>
      <PageHeader title="Login Permissions" description="Create roles and assign page-level access permissions to control what each role can see." />

      {/* Create Role */}
      <Card className="mb-6">
        <CardHeader><CardTitle>Create Role</CardTitle></CardHeader>
        <CardContent>
          <form action={createRole} className="grid gap-4 md:grid-cols-[1fr_2fr_auto] md:items-end">
            <div className="space-y-2">
              <Label htmlFor="name">Role Name</Label>
              <Input id="name" name="name" placeholder="e.g. Fabric Operator" required />
            </div>
            <div className="space-y-2">
              <Label htmlFor="description">Description</Label>
              <Input id="description" name="description" placeholder="Optional role description" />
            </div>
            <ConfirmSubmitButton confirmTitle="Create role?" confirmDescription="Confirm the role name before creating it.">
              Create Role
            </ConfirmSubmitButton>
          </form>
        </CardContent>
      </Card>

      {/* Role List */}
      {roleRows.length === 0 ? (
        <EmptyState title="No roles found" description="Create a role before assigning permissions." />
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {roleRows.map((role) => {
            const assignedCount = assignedByRole[role.id] ?? 0;
            const pct = totalPermissions > 0 ? Math.round((assignedCount / totalPermissions) * 100) : 0;

            return (
              <Link key={role.id} href={`/admin/permissions/${role.id}` as any} className="group block">
                <Card className="h-full transition-all duration-200 hover:shadow-md hover:border-primary/40 group-hover:bg-muted/20">
                  <CardContent className="p-5">
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex items-center gap-3 min-w-0">
                        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary">
                          <Users className="h-5 w-5" />
                        </div>
                        <div className="min-w-0">
                          <div className="truncate font-semibold capitalize">{role.name}</div>
                          <div className="truncate text-xs text-muted-foreground mt-0.5">
                            {role.description || "No description"}
                          </div>
                        </div>
                      </div>
                      <div className="flex flex-col items-end gap-1.5 shrink-0">
                        <StatusBadge value={role.is_active ? "active" : "inactive"} />
                        <ChevronRight className="h-4 w-4 text-muted-foreground transition-transform group-hover:translate-x-0.5" />
                      </div>
                    </div>

                    {/* Permission progress bar */}
                    <div className="mt-4 space-y-1.5">
                      <div className="flex items-center justify-between text-xs text-muted-foreground">
                        <span>Permissions</span>
                        <span>{assignedCount}/{totalPermissions}</span>
                      </div>
                      <div className="h-1.5 w-full rounded-full bg-muted overflow-hidden">
                        <div
                          className="h-full rounded-full bg-primary transition-all"
                          style={{ width: `${pct}%` }}
                        />
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </Link>
            );
          })}
        </div>
      )}
    </>
  );
}
