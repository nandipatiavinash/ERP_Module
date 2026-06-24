import { PageHeader } from "@/components/app/page-header";
import { ExportButtons } from "@/components/app/export-buttons";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { requirePermission } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { formatDate, formatNumber } from "@/lib/utils";
import type { Database } from "@/lib/database.types";

type Params = { from?: string; to?: string; search?: string };

type DailyProductionRow = Database["public"]["Tables"]["loom_production_entries"]["Row"] & {
  fabric_types?: { fabric_name: string | null };
  looms?: { loom_number: string | null };
};

type FabricRollRow = Database["public"]["Tables"]["fabric_rolls"]["Row"] & {
  fabric_types?: { fabric_name: string | null };
};

type SalesOrderRow = Database["public"]["Tables"]["sales_orders"]["Row"] & {
  customers?: { customer_name: string | null };
  fabric_types?: { fabric_name: string | null };
};

type AttendanceRow = Database["public"]["Tables"]["attendance"]["Row"] & {
  employees?: { name: string | null; employee_code: string | null };
};

type EmployeeRow = Database["public"]["Tables"]["employees"]["Row"];

type RawMaterialRow = Database["public"]["Tables"]["raw_materials"]["Row"];

type RawMaterialPurchaseRow = Database["public"]["Tables"]["raw_material_purchases"]["Row"] & {
  raw_materials?: { material_name: string | null; unit: string | null };
};

type ReportRow = Record<string, unknown>;

function inText(row: Record<string, unknown>, search: string) {
  if (!search) return true;
  return Object.values(row).join(" ").toLowerCase().includes(search.toLowerCase());
}

function reportColumnLabel(column: string) {
  const labels: Record<string, string> = {
    weight: "Weight",
    meters: "Meters",
    quantity: "Quantity",
    rate: "Rate",
    amount: "Amount",
    salary: "Salary",
    working_hours: "Working Hours",
    overtime_hours: "Overtime Hours",
    current_stock: "Current Stock",
    opening_stock: "Opening Stock",
  };
  return labels[column] ?? column.replaceAll("_", " ");
}

function reportCell(column: string, value: unknown, row: Record<string, unknown>) {
  if (column.includes("date")) return formatDate(String(value));
  if (typeof value === "number") {
    if (column === "weight") return `${formatNumber(value, 2)} kg`;
    if (column === "meters" || column === "quantity") {
      const unit = String(row.unit ?? (column === "meters" ? "m" : ""));
      return `${formatNumber(value, 2)} ${unit}`.trim();
    }
    if (column === "rate" || column === "amount" || column === "salary") return `₹${formatNumber(value, 2)}`;
    if (column.includes("hours")) return `${formatNumber(value, 2)} hrs`;
    return formatNumber(value, 2);
  }
  if ((column === "opening_stock" || column === "current_stock") && value != null) return `${formatNumber(String(value), 2)} ${row.unit ?? ""}`.trim();
  return String(value ?? "-");
}

export default async function ReportsPage({ searchParams }: { searchParams: Promise<Params> }) {
  await requirePermission("reports.stock");
  const params = await searchParams;
  const from = params.from || new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString().slice(0, 10);
  const to = params.to || new Date().toISOString().slice(0, 10);
  const search = params.search ?? "";
  const supabase = await createClient();
  const [productionResult, rollsResult, rawResult, rawPurchaseResult, salesResult, attendanceResult, employeeResult] = await Promise.all([
    supabase.from("loom_production_entries").select("entry_date, serial_number, net_weight, net_meters, fabric_types(fabric_name), looms(loom_number)").gte("entry_date", from).lte("entry_date", to).is("deleted_at", null).order("entry_date", { ascending: false }).limit(500),
    (supabase as any).rpc("get_fabric_stock_summary"),
    supabase.from("raw_materials").select("material_name, unit, opening_stock, current_stock, status").is("deleted_at", null).order("material_name"),
    supabase.from("raw_material_purchases").select("purchase_date, supplier_name, bill_number, quantity, rate, total_amount, raw_materials(material_name, unit)").gte("purchase_date", from).lte("purchase_date", to).is("deleted_at", null).order("purchase_date", { ascending: false }).limit(500),
    supabase.from("sales_orders").select("order_date, order_number, quantity_meters, total_amount, status, customers(customer_name), fabric_types(fabric_name)").gte("order_date", from).lte("order_date", to).is("deleted_at", null).order("order_date", { ascending: false }).limit(500),
    supabase.from("attendance").select("attendance_date, check_in, check_out, working_hours, overtime_hours, status, employees(name, employee_code)").gte("attendance_date", from).lte("attendance_date", to).is("deleted_at", null).order("attendance_date", { ascending: false }).limit(500),
    supabase.from("employees").select("employee_code, name, department, designation, salary, status").is("deleted_at", null).order("name").limit(500),
  ]);

  const production = ((productionResult.data ?? []) as DailyProductionRow[]).map((row) => ({
    date: row.entry_date,
    serial: row.serial_number,
    fabric: row.fabric_types?.fabric_name ?? "",
    loom: row.looms?.loom_number ?? "",
    weight: Number(row.net_weight),
    meters: Number(row.net_meters),
  })).filter((row) => inText(row, search));

  const fabricStock = ((rollsResult.data ?? []) as any[]).map((row) => ({
    fabric: row.fabric_name ?? null,
    rolls: Number(row.rolls ?? 0),
    weight: Number(row.weight ?? 0),
    meters: Number(row.meters ?? 0),
  })).filter((row) => inText(row, search));

  const rawPurchases = ((rawPurchaseResult.data ?? []) as RawMaterialPurchaseRow[]).map((row) => ({
    date: row.purchase_date,
    material: row.raw_materials?.material_name ?? "",
    unit: row.raw_materials?.unit ?? "",
    supplier: row.supplier_name ?? "",
    bill: row.bill_number ?? "",
    quantity: Number(row.quantity),
    rate: Number(row.rate),
    amount: Number(row.total_amount),
  })).filter((row) => inText(row, search));

  const sales = ((salesResult.data ?? []) as SalesOrderRow[]).map((row) => ({
    date: row.order_date,
    order: row.order_number,
    customer: row.customers?.customer_name ?? "",
    fabric: row.fabric_types?.fabric_name ?? "",
    quantity: Number(row.quantity_meters),
    amount: Number(row.total_amount),
    status: row.status,
  })).filter((row) => inText(row, search));

  return (
    <>
      <PageHeader title="Reports" description="Production, inventory, sales, and HR reports with date filters and export." />
      <form className="no-print mb-5 grid gap-3 rounded-lg border bg-card p-4 md:grid-cols-4">
        <Input type="date" name="from" defaultValue={from} />
        <Input type="date" name="to" defaultValue={to} />
        <Input name="search" defaultValue={search} placeholder="Search reports" />
        <button className="h-10 rounded-md bg-primary px-4 text-sm font-medium text-primary-foreground">Apply Filters</button>
      </form>
      <div className="space-y-5">
        <ReportTable title="Daily Production" filename="daily-production" rows={production} columns={["date", "serial", "fabric", "loom", "weight", "meters"]} />
        <ReportTable title="Fabric Stock" filename="fabric-stock" rows={fabricStock as ReportRow[]} columns={["fabric", "rolls", "weight", "meters"]} />
        <ReportTable title="Raw Material Stock" filename="raw-material-stock" rows={(rawResult.data ?? []) as unknown as ReportRow[]} columns={["material_name", "unit", "opening_stock", "current_stock", "status"]} />
        <ReportTable title="Raw Material Purchases" filename="raw-material-purchases" rows={rawPurchases} columns={["date", "material", "supplier", "bill", "quantity", "rate", "amount"]} />
        <ReportTable title="Customer Wise Sales" filename="sales" rows={sales} columns={["date", "order", "customer", "fabric", "quantity", "amount", "status"]} />
        <ReportTable title="Attendance Report" filename="attendance" rows={((attendanceResult.data ?? []) as AttendanceRow[]).map((row) => ({ date: row.attendance_date, employee: `${row.employees?.employee_code ?? ""} ${row.employees?.name ?? ""}`.trim(), check_in: row.check_in, check_out: row.check_out, working_hours: Number(row.working_hours ?? 0), overtime_hours: Number(row.overtime_hours ?? 0), status: row.status })).filter((row) => inText(row, search))} columns={["date", "employee", "check_in", "check_out", "working_hours", "overtime_hours", "status"]} />
        <ReportTable title="Employee Report" filename="employees" rows={(employeeResult.data ?? []) as unknown as ReportRow[]} columns={["employee_code", "name", "department", "designation", "salary", "status"]} />
      </div>
    </>
  );
}

function ReportTable({ title, filename, rows, columns }: { title: string; filename: string; rows: Record<string, unknown>[]; columns: string[] }) {
  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0">
        <CardTitle>{title}</CardTitle>
        <ExportButtons filename={filename} rows={rows} />
      </CardHeader>
      <CardContent>
        <div className="overflow-x-auto">
          <Table>
            <TableHeader><TableRow>{columns.map((column) => <TableHead key={column}>{reportColumnLabel(column)}</TableHead>)}</TableRow></TableHeader>
            <TableBody>
              {rows.map((row, index) => (
                <TableRow key={index}>
                  {columns.map((column) => {
                    const value = row[column];
                    return <TableCell key={column}>{reportCell(column, value, row)}</TableCell>;
                  })}
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </CardContent>
    </Card>
  );
}
