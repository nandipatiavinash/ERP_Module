import { MasterPage } from "@/components/app/master-page";
import { requirePermission } from "@/lib/auth";
import { modules } from "@/lib/modules";
import { fetchMasterRows } from "@/lib/master-query";
import { createClient } from "@/lib/supabase/server";

type Params = { search?: string; page?: string; sort?: string; direction?: "asc" | "desc" };

export default async function ColorsPage({ searchParams }: { searchParams: Promise<Params> }) {
  await requirePermission("admin.colors"); // Using existing permission, or colors permission if custom
  const supabase = await createClient();
  const params = await searchParams;
  const result = await fetchMasterRows({ supabase, config: modules["roto-colors"], select: "id, color_name, description, status", params, defaultSort: "color_name" });
  return <MasterPage config={modules["roto-colors"]} rows={result.rows as never} search={params.search ?? ""} page={result.page} sort={result.sort} direction={result.direction} totalRows={result.totalRows} />;
}
