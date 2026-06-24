import { requirePermission } from "@/lib/auth";
import { ResetClient } from "./ResetClient";

export default async function SystemResetPage() {
  // Enforce users.view / global admin view permissions
  await requirePermission("admin.reset");

  return <ResetClient />;
}
