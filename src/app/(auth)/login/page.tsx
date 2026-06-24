import Link from "next/link";
import { LoginForm } from "@/components/app/auth-forms";

export default function LoginPage() {
  return (
    <main className="flex min-h-screen items-center justify-center bg-muted/30 p-4">
      <div className="w-full max-w-md space-y-4">
        <LoginForm />
        <div className="text-center text-sm">
          <Link href="/reset-password" className="text-primary underline-offset-4 hover:underline">
            Forgot password?
          </Link>
        </div>
      </div>
    </main>
  );
}
