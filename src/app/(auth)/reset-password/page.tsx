import Link from "next/link";
import { ResetPasswordForm } from "@/components/app/auth-forms";

export default function ResetPasswordPage() {
  return (
    <main className="flex min-h-screen items-center justify-center bg-muted/30 p-4">
      <div className="w-full max-w-md space-y-4">
        <ResetPasswordForm />
        <div className="text-center text-sm">
          <Link href="/login" className="text-primary underline-offset-4 hover:underline">
            Back to login
          </Link>
        </div>
      </div>
    </main>
  );
}
