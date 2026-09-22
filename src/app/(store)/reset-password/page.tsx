import type { Metadata } from "next";
import Link from "next/link";
import { ResetPasswordForm } from "@/components/auth-forms";
import { Alert } from "@/components/ui";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Set a new password",
  robots: { index: false },
};

export default async function ResetPasswordPage({
  searchParams,
}: {
  searchParams: Promise<{ token?: string }>;
}) {
  const { token } = await searchParams;
  if (!token) {
    return (
      <div className="mx-auto max-w-md py-10 text-center">
        <Alert tone="warn" title="Missing reset token">
          <span className="block">
            Open the reset link from your email, or{" "}
            <Link href="/forgot-password" className="font-semibold underline">
              request a new one
            </Link>
            .
          </span>
        </Alert>
      </div>
    );
  }
  return (
    <div className="py-6">
      <ResetPasswordForm token={token} />
    </div>
  );
}
