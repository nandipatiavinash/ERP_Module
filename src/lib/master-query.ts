import type { ModuleConfig } from "@/lib/modules";

export const MASTER_PAGE_SIZE = 10;

type MasterParams = {
  search?: string;
  page?: string;
  sort?: string;
  direction?: "asc" | "desc";
};

function cleanSearch(value: string) {
  return value.trim().replace(/[%,()]/g, " ");
}

export async function fetchMasterRows({
  supabase,
  config,
  select,
  params,
  defaultSort,
}: {
  supabase: any;
  config: ModuleConfig;
  select: string;
  params: MasterParams;
  defaultSort: string;
}) {
  const page = Math.max(Number(params.page ?? 1) || 1, 1);
  const offset = (page - 1) * MASTER_PAGE_SIZE;
  const direction: "asc" | "desc" = params.direction === "desc" ? "desc" : "asc";
  const sort = config.columns.some((column) => column.key === params.sort) ? String(params.sort) : defaultSort;
  const search = cleanSearch(params.search ?? "");

  let query = supabase
    .from(config.table)
    .select(select, { count: "exact" })
    .is("deleted_at", null);

  if (search) {
    query = query.or(config.searchColumns.map((column) => `${column}.ilike.%${search}%`).join(","));
  }

  let response = await query
    .order(sort, { ascending: direction === "asc" })
    .range(offset, offset + MASTER_PAGE_SIZE - 1);

  if (
    response.error &&
    /deleted_at.*does not exist|column .*deleted_at.*does not exist/i.test(response.error.message)
  ) {
    let fallbackQuery = supabase
      .from(config.table)
      .select(select, { count: "exact" });

    if (search) {
      fallbackQuery = fallbackQuery.or(config.searchColumns.map((column) => `${column}.ilike.%${search}%`).join(","));
    }

    response = await fallbackQuery
      .order(sort, { ascending: direction === "asc" })
      .range(offset, offset + MASTER_PAGE_SIZE - 1);
  }

  const { data, error, count } = response;
  if (error) throw new Error(error.message);

  return {
    rows: data ?? [],
    totalRows: count ?? 0,
    page,
    sort,
    direction,
  };
}
