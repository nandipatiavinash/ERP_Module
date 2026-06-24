import { MasterPage } from "@/components/app/master-page";
import { requirePermission } from "@/lib/auth";
import { modules } from "@/lib/modules";
import { fetchMasterRows } from "@/lib/master-query";
import { createClient } from "@/lib/supabase/server";

type Params = { search?: string; page?: string; sort?: string; direction?: "asc" | "desc" };

export default async function EmployeesAdminPage({ searchParams }: { searchParams: Promise<Params> }) {
  await requirePermission("admin.employees");
  const supabase = await createClient();
  const params = await searchParams;
  const result = await fetchMasterRows({ supabase, config: modules.employees, select: "id, employee_code, name, department, designation, salary, joining_date, shift_start, shift_end, status", params, defaultSort: "name" });
  return <MasterPage config={modules.employees} rows={result.rows as never} search={params.search ?? ""} page={result.page} sort={result.sort} direction={result.direction} totalRows={result.totalRows} />;
}
