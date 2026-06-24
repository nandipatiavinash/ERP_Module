import { linkEmployeeUser } from "@/app/(app)/_actions";
import { ConfirmSubmitButton } from "@/components/app/confirm-submit-button";
import { PageHeader } from "@/components/app/page-header";
import { StatusBadge } from "@/components/app/status-badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { UserForm } from "@/components/app/user-form";
import { requirePermission } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";

export default async function CredentialsPage() {
  await requirePermission("admin.credentials");
  const supabase = await createClient();
  const [{ data }, { data: roles }, { data: employees }] = await Promise.all([
    supabase.from("users").select("*, roles(name)").is("deleted_at", null).order("full_name", { ascending: true }),
    supabase.from("roles").select("id, name").eq("is_active", true).is("deleted_at", null).order("name"),
    supabase.from("employees").select("id, user_id, employee_code, name").eq("status", "active").is("deleted_at", null).order("name"),
  ]);
  const users = (data ?? []) as any[];
  const employeeRows = (employees ?? []) as any[];
  const linkedEmployeeByUser = new Map(employeeRows.filter((employee) => employee.user_id).map((employee) => [employee.user_id, employee]));
  return (
    <>
      <PageHeader title="Login Credentials" description="Create Supabase Auth users and link them to ERP roles." />
      <Card className="mb-5">
        <CardHeader><CardTitle>Create User</CardTitle></CardHeader>
        <CardContent><UserForm roles={((roles ?? []) as any[]).map((role) => ({ id: role.id, name: role.name }))} /></CardContent>
      </Card>
      <Card>
        <CardHeader><CardTitle>ERP Users</CardTitle></CardHeader>
        <CardContent>
          {users.length === 0 ? <EmptyState /> : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader><TableRow><TableHead>Name</TableHead><TableHead>Email</TableHead><TableHead>Phone</TableHead><TableHead>Role</TableHead><TableHead>Employee Link</TableHead><TableHead>Status</TableHead></TableRow></TableHeader>
                <TableBody>
                  {users.map((user) => (
                    <TableRow key={user.id}>
                      <TableCell>{user.full_name}</TableCell>
                      <TableCell>{user.email}</TableCell>
                      <TableCell>{user.phone ?? "-"}</TableCell>
                      <TableCell className="capitalize">{user.roles?.name}</TableCell>
                      <TableCell className="min-w-72">
                        <form action={linkEmployeeUser} className="flex flex-col gap-2 sm:flex-row">
                          <input type="hidden" name="user_id" value={user.id} />
                          <select name="employee_id" defaultValue={linkedEmployeeByUser.get(user.id)?.id ?? ""} className="h-9 w-full rounded-md border bg-background px-3 text-sm">
                            <option value="">No employee link</option>
                            {employeeRows.map((employee) => (
                              <option key={employee.id} value={employee.id}>
                                {employee.employee_code} - {employee.name}
                              </option>
                            ))}
                          </select>
                          <ConfirmSubmitButton size="sm" variant="outline" confirmTitle="Update employee link?" confirmDescription="Confirm this user-to-employee attendance link before saving.">Link</ConfirmSubmitButton>
                        </form>
                      </TableCell>
                      <TableCell><StatusBadge value={user.status} /></TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
    </>
  );
}
