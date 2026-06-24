import { Boxes, CalendarCheck, Factory, Package, Scale, ScrollText } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { DashboardChart } from "@/components/app/dashboard-chart";
import { PageHeader } from "@/components/app/page-header";
import { requirePermission } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { formatNumber } from "@/lib/utils";

function todayInIndia() {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Kolkata",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
}

function StatCard({ title, value, icon: Icon }: { title: string; value: string; icon: typeof Factory }) {
  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-sm font-medium text-muted-foreground">{title}</CardTitle>
        <Icon className="h-4 w-4 text-muted-foreground" />
      </CardHeader>
      <CardContent>
        <div className="text-2xl font-semibold">{value}</div>
      </CardContent>
    </Card>
  );
}

export default async function DashboardPage() {
  await requirePermission("dashboard.view");
  const supabase = await createClient();
  const today = todayInIndia();

  const [{ data: summaryData }, { data: chartRows }] = await Promise.all([
    (supabase as any).rpc("get_dashboard_summary", { p_entry_date: today }),
    (supabase as any).rpc("get_daily_fabric_output", { p_entry_date: today }),
  ]);

  const summary = ((summaryData ?? []) as any[])[0] ?? {};
  const productionEntries = Number(summary.production_entries ?? 0);
  const todayWeight = Number(summary.total_weight ?? 0);
  const todayMeters = Number(summary.total_meters ?? 0);
  const availableRolls = Number(summary.available_rolls ?? 0);
  const materialStock = Number(summary.material_stock ?? 0);
  const presentEmployees = Number(summary.present_employees ?? 0);
  const chartData = ((chartRows ?? []) as any[]).map((row) => ({ name: row.name, meters: Number(row.meters ?? 0), weight: Number(row.weight ?? 0) }));

  return (
    <>
      <PageHeader title="Dashboard" description="Daily production, inventory, HR, and sales snapshot." />
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <StatCard title="Today's Production" value={`${productionEntries} entries`} icon={Factory} />
        <StatCard title="Total Rolls Today" value={String(productionEntries)} icon={Package} />
        <StatCard title="Weight Today" value={`${formatNumber(todayWeight, 2)} kg`} icon={Scale} />
        <StatCard title="Meters Today" value={`${formatNumber(todayMeters, 2)} m`} icon={ScrollText} />
        <StatCard title="Available Fabric Stock" value={`${availableRolls} rolls`} icon={Package} />
        <StatCard title="Raw Material Stock" value={formatNumber(materialStock, 2)} icon={Boxes} />
        <StatCard title="Employees Present" value={String(presentEmployees)} icon={CalendarCheck} />
      </div>
      <Card className="mt-5">
        <CardHeader><CardTitle>Today's Fabric Output</CardTitle></CardHeader>
        <CardContent><DashboardChart data={chartData} /></CardContent>
      </Card>
    </>
  );
}
