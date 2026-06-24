"use client";

import { useActionState } from "react";
import { createErpUser } from "@/app/(app)/_actions";
import { ConfirmSubmitButton } from "@/components/app/confirm-submit-button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { statusOptions } from "@/lib/modules";

type RoleOption = { id: string; name: string };

export function UserForm({ roles }: { roles: RoleOption[] }) {
  const [state, action, pending] = useActionState(createErpUser, null);

  return (
    <form action={action} className="grid gap-4 md:grid-cols-2">
      <div className="space-y-2">
        <Label htmlFor="full_name">Full Name</Label>
        <Input id="full_name" name="full_name" required />
      </div>
      <div className="space-y-2">
        <Label htmlFor="email">Email</Label>
        <Input id="email" name="email" type="email" required autoComplete="email" />
      </div>
      <div className="space-y-2">
        <Label htmlFor="password">Temporary Password</Label>
        <Input id="password" name="password" type="password" required minLength={8} autoComplete="new-password" />
      </div>
      <div className="space-y-2">
        <Label htmlFor="phone">Phone</Label>
        <Input id="phone" name="phone" autoComplete="tel" />
      </div>
      <div className="space-y-2">
        <Label htmlFor="role_id">Role</Label>
        <select id="role_id" name="role_id" required className="h-10 w-full rounded-md border bg-background px-3 text-sm">
          <option value="" disabled>Select role</option>
          {roles.map((role) => (
            <option key={role.id} value={role.id}>{role.name}</option>
          ))}
        </select>
      </div>
      <div className="space-y-2">
        <Label htmlFor="status">Status</Label>
        <select id="status" name="status" defaultValue="active" className="h-10 w-full rounded-md border bg-background px-3 text-sm">
          {statusOptions.map((status) => (
            <option key={status.value} value={status.value}>{status.label}</option>
          ))}
        </select>
      </div>
      {"error" in (state ?? {}) ? <p className="text-sm text-destructive md:col-span-2">{state?.error}</p> : null}
      {"success" in (state ?? {}) ? <p className="text-sm text-emerald-700 md:col-span-2">{state?.success}</p> : null}
      <div className="md:col-span-2">
        <ConfirmSubmitButton disabled={pending} confirmTitle="Create Supabase user?" confirmDescription="Confirm the user details and role before creating the authentication account.">
          {pending ? "Creating..." : "Create Supabase User"}
        </ConfirmSubmitButton>
      </div>
    </form>
  );
}
