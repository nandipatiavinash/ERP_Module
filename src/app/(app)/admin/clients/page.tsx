import { MasterPage } from "@/components/app/master-page";
import { requirePermission } from "@/lib/auth";
import { modules } from "@/lib/modules";
import { fetchMasterRows } from "@/lib/master-query";
import { createClient } from "@/lib/supabase/server";

type Params = { search?: string; page?: string; sort?: string; direction?: "asc" | "desc" };

export default async function ClientsPage({ searchParams }: { searchParams: Promise<Params> }) {
  await requirePermission("admin.clients");
  const supabase = await createClient();
  const params = await searchParams;
  const result = await fetchMasterRows({ supabase, config: modules.customers, select: "id, customer_name, alias, phone, gst_number, address, is_internal, status", params, defaultSort: "customer_name" });
  return <MasterPage config={modules.customers} rows={result.rows as never} search={params.search ?? ""} page={result.page} sort={result.sort} direction={result.direction} totalRows={result.totalRows} />;
}
