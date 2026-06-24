"use client";

import { useActionState } from "react";
import { signIn, resetPassword } from "@/app/actions";
import { BrandLogo } from "@/components/app/brand-logo";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export function LoginForm() {
  const [state, action, pending] = useActionState(signIn, null);
  return (
    <Card className="w-full max-w-md">
      <CardHeader>
        <BrandLogo className="mb-2 h-16 w-16 rounded-full" />
        <CardTitle>RK Global</CardTitle>
        <CardDescription>Sign in to the fabric ERP.</CardDescription>
      </CardHeader>
      <CardContent>
        <form action={action} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="email">Email</Label>
            <Input id="email" name="email" type="email" required autoComplete="email" />
          </div>
          <div className="space-y-2">
            <Label htmlFor="password">Password</Label>
            <Input id="password" name="password" type="password" required autoComplete="current-password" />
          </div>
          {"error" in (state ?? {}) ? <p className="text-sm text-destructive">{state?.error}</p> : null}
          <Button className="w-full" disabled={pending}>{pending ? "Signing in..." : "Login"}</Button>
        </form>
      </CardContent>
    </Card>
  );
}

export function ResetPasswordForm() {
  const [state, action, pending] = useActionState(resetPassword, null);
  return (
    <Card className="w-full max-w-md">
      <CardHeader>
        <BrandLogo className="mb-2 h-16 w-16 rounded-full" />
        <CardTitle>Password Reset</CardTitle>
        <CardDescription>Supabase will send a secure reset link.</CardDescription>
      </CardHeader>
      <CardContent>
        <form action={action} className="space-y-4">
          <input type="hidden" name="origin" value={typeof window === "undefined" ? "" : window.location.origin} />
          <div className="space-y-2">
            <Label htmlFor="email">Email</Label>
            <Input id="email" name="email" type="email" required autoComplete="email" />
          </div>
          {"error" in (state ?? {}) ? <p className="text-sm text-destructive">{state?.error}</p> : null}
          {"success" in (state ?? {}) ? <p className="text-sm text-emerald-700">{state?.success}</p> : null}
          <Button className="w-full" disabled={pending}>{pending ? "Sending..." : "Send Reset Link"}</Button>
        </form>
      </CardContent>
    </Card>
  );
}
