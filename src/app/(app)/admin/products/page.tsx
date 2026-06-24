import Link from "next/link";
import { saveRotoProduct, deactivateRotoProduct, saveOffsetProduct, deactivateOffsetProduct } from "@/app/(app)/_actions";
import { MasterPage } from "@/components/app/master-page";
import { ConfirmSubmitButton } from "@/components/app/confirm-submit-button";
import { PageHeader } from "@/components/app/page-header";
import { StatusBadge } from "@/components/app/status-badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { requirePermission } from "@/lib/auth";
import { fetchMasterRows } from "@/lib/master-query";
import { modules } from "@/lib/modules";
import { createClient } from "@/lib/supabase/server";
import { cn } from "@/lib/utils";

type Params = { tab?: string; search?: string; page?: string; sort?: string; direction?: "asc" | "desc" };

function ProductPager({ tab, page, totalRows, shownRows }: { tab: string; page: number; totalRows: number; shownRows: number }) {
  const totalPages = Math.max(Math.ceil(totalRows / 10), 1);
  const href = (nextPage: number) => `/admin/products?tab=${tab}${nextPage > 1 ? `&page=${nextPage}` : ""}`;
  return (
    <div className="mt-4 flex flex-col gap-3 text-sm text-muted-foreground sm:flex-row sm:items-center sm:justify-between">
      <div>Showing {shownRows} of {totalRows} records</div>
      <div className="flex gap-2">
        {page <= 1 ? (
          <button className="h-9 rounded-md border px-3 opacity-50" disabled>Previous</button>
        ) : (
          <Link href={href(page - 1) as any} className="inline-flex h-9 items-center rounded-md border px-3">Previous</Link>
        )}
        {page >= totalPages ? (
          <button className="h-9 rounded-md border px-3 opacity-50" disabled>Next</button>
        ) : (
          <Link href={href(page + 1) as any} className="inline-flex h-9 items-center rounded-md border px-3">Next</Link>
        )}
      </div>
    </div>
  );
}

export default async function ProductsAdminPage({ searchParams }: { searchParams: Promise<Params> }) {
  await requirePermission("admin.products");
  const params = await searchParams;
  const tab = params.tab || "fabric";
  const supabase = await createClient();

  // Fetch based on active tab
  let fabricData: any[] = [];
  let rotoData: any[] = [];
  let offsetData: any[] = [];
  let fabricTotal = 0;
  let rotoTotal = 0;
  let offsetTotal = 0;
  const productPage = Math.max(Number(params.page ?? 1) || 1, 1);

  // Fetch customer clients list for selection dropdown
  const { data: dbCustomers } = await supabase
    .from("customers")
    .select("id, customer_name, alias")
    .eq("status", "active")
    .eq("is_internal", "client a/c")
    .is("deleted_at", null)
    .order("customer_name");

  const clientList = ((dbCustomers ?? []) as any[])
    .filter((c) => !c.customer_name.endsWith(" A/c"))
    .map((c) => ({ id: c.id, name: c.customer_name, alias: c.alias }));

  if (tab === "fabric") {
    const result = await fetchMasterRows({ supabase, config: modules["fabric-types"], select: "id, fabric_name, description, status", params, defaultSort: "fabric_name" });
    fabricData = result.rows;
    fabricTotal = result.totalRows;
  } else if (tab === "roto") {
    const offset = (productPage - 1) * 10;
    const { data, count } = await supabase
      .from("roto_products")
      .select("id, brand, width, height, num_cylinders, image_url, status, customer_id, customers:customer_id(customer_name, alias)", { count: "exact" })
      .order("brand", { ascending: true })
      .range(offset, offset + 9);
    rotoData = data ?? [];
    rotoTotal = count ?? 0;
  } else if (tab === "offset") {
    const offset = (productPage - 1) * 10;
    const { data, count } = await supabase
      .from("offset_products")
      .select("id, brand, width, height, image_url, status, customer_id, customers:customer_id(customer_name, alias)", { count: "exact" })
      .order("brand", { ascending: true })
      .range(offset, offset + 9);
    offsetData = data ?? [];
    offsetTotal = count ?? 0;
  }

  const tabClass = (key: string) =>
    cn(
      "px-4 py-2 text-sm font-semibold rounded-t-lg border-b-2 transition-colors",
      tab === key
        ? "border-primary text-primary bg-background"
        : "border-transparent text-muted-foreground hover:text-foreground hover:bg-muted/50"
    );

  return (
    <>
      <PageHeader title="Product Profiles" description="Manage fabric type templates and custom printing products for the factory." />

      <div className="flex border-b border-muted mb-6">
        <Link href={"/admin/products?tab=fabric" as any} className={tabClass("fabric")}>
          Fabric Products
        </Link>
        <Link href={"/admin/products?tab=roto" as any} className={tabClass("roto")}>
          Roto Printing Products
        </Link>
        <Link href={"/admin/products?tab=offset" as any} className={tabClass("offset")}>
          Offset Printing Products
        </Link>
      </div>

      {tab === "fabric" && (
        <MasterPage
          config={modules["fabric-types"]}
          rows={fabricData as never}
          search={params.search ?? ""}
          page={Number(params.page ?? 1)}
          sort={params.sort}
          direction={params.direction}
          totalRows={fabricTotal}
          queryParams={{ tab: "fabric" }}
        />
      )}

      {tab === "roto" && (
        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Add Roto Printing Product</CardTitle>
            </CardHeader>
            <CardContent>
              <form action={saveRotoProduct} className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                <div className="space-y-2">
                  <Label htmlFor="brand">Brand</Label>
                  <Input id="brand" name="brand" placeholder="e.g. RK-Rotogravure" required />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="width">Width (inches)</Label>
                  <Input id="width" name="width" type="number" step="0.01" placeholder="e.g. 24.50" required />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="height">Height (inches)</Label>
                  <Input id="height" name="height" type="number" step="0.01" placeholder="e.g. 36.00" required />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="num_cylinders">Number of Cylinders</Label>
                  <Input id="num_cylinders" name="num_cylinders" type="number" placeholder="e.g. 6" required />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="image_file">Product Image File</Label>
                  <Input id="image_file" name="image_file" type="file" accept="image/*" required />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="customer_id">Client / Customer</Label>
                  <select name="customer_id" id="customer_id" required className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm">
                    <option value="general">General (No Client)</option>
                    {clientList.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.name} {c.alias ? `(${c.alias})` : ""}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="status">Status</Label>
                  <select name="status" id="status" required className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm">
                    <option value="active">Active</option>
                    <option value="inactive">Inactive</option>
                  </select>
                </div>
                <div className="flex items-end md:col-span-2 lg:col-span-3">
                  <ConfirmSubmitButton confirmTitle="Add Roto Product?" confirmDescription="Review product brand, dimensions, cylinders, client, and image file before adding.">
                    Add Product
                  </ConfirmSubmitButton>
                </div>
              </form>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Roto Products</CardTitle>
            </CardHeader>
            <CardContent>
              {rotoData.length === 0 ? (
                <EmptyState />
              ) : (
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Preview</TableHead>
                        <TableHead>Client</TableHead>
                        <TableHead>Brand</TableHead>
                        <TableHead>Dimensions</TableHead>
                        <TableHead>Cylinders</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead>Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {rotoData.map((row) => (
                        <TableRow key={row.id}>
                          <TableCell>
                            {row.image_url ? (
                              <img src={row.image_url} alt={row.brand} className="h-12 w-12 rounded object-cover border" />
                            ) : (
                              <div className="h-12 w-12 rounded bg-muted flex items-center justify-center text-xs text-muted-foreground">No image</div>
                            )}
                          </TableCell>
                          <TableCell>
                            {row.customers?.customer_name ? (
                              <span className="font-semibold text-slate-800">
                                {row.customers.customer_name} {row.customers.alias ? `(${row.customers.alias})` : ""}
                              </span>
                            ) : (
                              <span className="text-slate-400 italic">General</span>
                            )}
                          </TableCell>
                          <TableCell className="font-semibold">{row.brand}</TableCell>
                          <TableCell>{row.width} &times; {row.height} in</TableCell>
                          <TableCell>{row.num_cylinders}</TableCell>
                          <TableCell>
                            <StatusBadge value={row.status} />
                          </TableCell>
                          <TableCell className="min-w-80">
                            <details className="space-y-3" name="roto-products-accordion">
                              <summary className="cursor-pointer text-sm font-medium text-primary">Edit</summary>
                              <form action={saveRotoProduct} className="grid gap-4 md:grid-cols-2 bg-muted/20 p-4 rounded-md border mt-2">
                                <input type="hidden" name="id" value={row.id} />
                                <input type="hidden" name="image_url" value={row.image_url || ""} />
                                <div className="space-y-2">
                                  <Label>Brand</Label>
                                  <Input name="brand" defaultValue={row.brand} required />
                                </div>
                                <div className="space-y-2">
                                  <Label>Width (inches)</Label>
                                  <Input name="width" type="number" step="0.01" defaultValue={row.width} required />
                                </div>
                                <div className="space-y-2">
                                  <Label>Height (inches)</Label>
                                  <Input name="height" type="number" step="0.01" defaultValue={row.height} required />
                                </div>
                                <div className="space-y-2">
                                  <Label>Cylinders</Label>
                                  <Input name="num_cylinders" type="number" defaultValue={row.num_cylinders} required />
                                </div>
                                <div className="space-y-2">
                                  <Label>Client / Customer</Label>
                                  <select name="customer_id" defaultValue={row.customer_id || "general"} className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm">
                                    <option value="general">General (No Client)</option>
                                    {clientList.map((c) => (
                                      <option key={c.id} value={c.id}>
                                        {c.name} {c.alias ? `(${c.alias})` : ""}
                                      </option>
                                    ))}
                                  </select>
                                </div>
                                <div className="space-y-2">
                                  <Label>Update Image File</Label>
                                  <Input name="image_file" type="file" accept="image/*" />
                                </div>
                                <div className="space-y-2">
                                  <Label>Status</Label>
                                  <select name="status" defaultValue={row.status} className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm">
                                    <option value="active">Active</option>
                                    <option value="inactive">Inactive</option>
                                  </select>
                                </div>
                                <div className="md:col-span-2">
                                  <ConfirmSubmitButton confirmTitle="Save changes?" confirmDescription="Confirm Roto product changes before saving.">
                                    Save Product
                                  </ConfirmSubmitButton>
                                </div>
                              </form>
                            </details>
                            <form action={deactivateRotoProduct} className="mt-3">
                              <input type="hidden" name="id" value={row.id} />
                              <ConfirmSubmitButton size="sm" variant="outline" confirmTitle="Deactivate Roto product?" confirmDescription="Are you sure you want to deactivate this Roto printing product?">
                                deactivate
                              </ConfirmSubmitButton>
                            </form>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                  <ProductPager tab="roto" page={productPage} totalRows={rotoTotal} shownRows={rotoData.length} />
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      )}

      {tab === "offset" && (
        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Add Offset Printing Product</CardTitle>
            </CardHeader>
            <CardContent>
              <form action={saveOffsetProduct} className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                <div className="space-y-2">
                  <Label htmlFor="brand">Brand</Label>
                  <Input id="brand" name="brand" placeholder="e.g. RK-Offset" required />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="width">Width (inches)</Label>
                  <Input id="width" name="width" type="number" step="0.01" placeholder="e.g. 18.00" required />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="height">Height (inches)</Label>
                  <Input id="height" name="height" type="number" step="0.01" placeholder="e.g. 24.00" required />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="image_file">Product Image File</Label>
                  <Input id="image_file" name="image_file" type="file" accept="image/*" required />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="customer_id">Client / Customer</Label>
                  <select name="customer_id" id="customer_id" required className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm">
                    <option value="general">General (No Client)</option>
                    {clientList.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.name} {c.alias ? `(${c.alias})` : ""}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="status">Status</Label>
                  <select name="status" id="status" required className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm">
                    <option value="active">Active</option>
                    <option value="inactive">Inactive</option>
                  </select>
                </div>
                <div className="flex items-end md:col-span-2 lg:col-span-3">
                  <ConfirmSubmitButton confirmTitle="Add Offset Product?" confirmDescription="Review product brand, dimensions, client, and image file before adding.">
                    Add Product
                  </ConfirmSubmitButton>
                </div>
              </form>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Offset Products</CardTitle>
            </CardHeader>
            <CardContent>
              {offsetData.length === 0 ? (
                <EmptyState />
              ) : (
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Preview</TableHead>
                        <TableHead>Client</TableHead>
                        <TableHead>Brand</TableHead>
                        <TableHead>Dimensions</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead>Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {offsetData.map((row) => (
                        <TableRow key={row.id}>
                          <TableCell>
                            {row.image_url ? (
                              <img src={row.image_url} alt={row.brand} className="h-12 w-12 rounded object-cover border" />
                            ) : (
                              <div className="h-12 w-12 rounded bg-muted flex items-center justify-center text-xs text-muted-foreground">No image</div>
                            )}
                          </TableCell>
                          <TableCell>
                            {row.customers?.customer_name ? (
                              <span className="font-semibold text-slate-800">
                                {row.customers.customer_name} {row.customers.alias ? `(${row.customers.alias})` : ""}
                              </span>
                            ) : (
                              <span className="text-slate-400 italic">General</span>
                            )}
                          </TableCell>
                          <TableCell className="font-semibold">{row.brand}</TableCell>
                          <TableCell>{row.width} &times; {row.height} in</TableCell>
                          <TableCell>
                            <StatusBadge value={row.status} />
                          </TableCell>
                          <TableCell className="min-w-80">
                            <details className="space-y-3" name="offset-products-accordion">
                              <summary className="cursor-pointer text-sm font-medium text-primary">Edit</summary>
                              <form action={saveOffsetProduct} className="grid gap-4 md:grid-cols-2 bg-muted/20 p-4 rounded-md border mt-2">
                                <input type="hidden" name="id" value={row.id} />
                                <input type="hidden" name="image_url" value={row.image_url || ""} />
                                <div className="space-y-2">
                                  <Label>Brand</Label>
                                  <Input name="brand" defaultValue={row.brand} required />
                                </div>
                                <div className="space-y-2">
                                  <Label>Width (inches)</Label>
                                  <Input name="width" type="number" step="0.01" defaultValue={row.width} required />
                                </div>
                                <div className="space-y-2">
                                  <Label>Height (inches)</Label>
                                  <Input name="height" type="number" step="0.01" defaultValue={row.height} required />
                                </div>
                                <div className="space-y-2">
                                  <Label>Client / Customer</Label>
                                  <select name="customer_id" defaultValue={row.customer_id || "general"} className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm">
                                    <option value="general">General (No Client)</option>
                                    {clientList.map((c) => (
                                      <option key={c.id} value={c.id}>
                                        {c.name} {c.alias ? `(${c.alias})` : ""}
                                      </option>
                                    ))}
                                  </select>
                                </div>
                                <div className="space-y-2">
                                  <Label>Update Image File</Label>
                                  <Input name="image_file" type="file" accept="image/*" />
                                </div>
                                <div className="space-y-2">
                                  <Label>Status</Label>
                                  <select name="status" defaultValue={row.status} className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm">
                                    <option value="active">Active</option>
                                    <option value="inactive">Inactive</option>
                                  </select>
                                </div>
                                <div className="md:col-span-2">
                                  <ConfirmSubmitButton confirmTitle="Save changes?" confirmDescription="Confirm Offset product changes before saving.">
                                    Save Product
                                  </ConfirmSubmitButton>
                                </div>
                              </form>
                            </details>
                            <form action={deactivateOffsetProduct} className="mt-3">
                              <input type="hidden" name="id" value={row.id} />
                              <ConfirmSubmitButton size="sm" variant="outline" confirmTitle="Deactivate Offset product?" confirmDescription="Are you sure you want to deactivate this Offset printing product?">
                                Deactivate
                              </ConfirmSubmitButton>
                            </form>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                  <ProductPager tab="offset" page={productPage} totalRows={offsetTotal} shownRows={offsetData.length} />
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      )}
    </>
  );
}
