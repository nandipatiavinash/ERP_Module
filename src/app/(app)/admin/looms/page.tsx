import { MasterPage } from "@/components/app/master-page";
import { requirePermission } from "@/lib/auth";
import { modules } from "@/lib/modules";
import { fetchMasterRows } from "@/lib/master-query";
import { createClient } from "@/lib/supabase/server";

type Params = { search?: string; page?: string; sort?: string; direction?: "asc" | "desc" };

export default async function LoomsAdminPage({ searchParams }: { searchParams: Promise<Params> }) {
  await requirePermission("admin.looms");
  const supabase = await createClient();
  const params = await searchParams;
  const result = await fetchMasterRows({ supabase, config: modules.looms, select: "id, loom_number, description, status", params, defaultSort: "loom_number" });
  return <MasterPage config={modules.looms} rows={result.rows as never} search={params.search ?? ""} page={result.page} sort={result.sort} direction={result.direction} totalRows={result.totalRows} />;
}
