import { redirect } from "next/navigation";
import { AppShell } from "@/components/app/app-shell";
import { getSessionPermissions, requireUser } from "@/lib/auth";
import type { RoleName } from "@/lib/database.types";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const user = await requireUser();
  if (!user.roles?.name) redirect("/login");
  const role = user.roles.name;
  const permissions = await getSessionPermissions(user);

  return <AppShell user={{ ...user, roles: { name: role as RoleName } }} permissions={permissions}>{children}</AppShell>;
}
