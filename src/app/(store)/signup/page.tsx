import type { Metadata } from "next";
import { Suspense } from "react";
import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { SignupForm } from "@/components/auth-forms";
import { Skeleton } from "@/components/ui";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Create account",
  description: "Create a FreshCut account for faster checkout, order tracking and WhatsApp ordering.",
};

export default async function SignupPage() {
  const user = await getCurrentUser();
  if (user) redirect("/");
  return (
    <div className="py-6">
      <Suspense fallback={<Skeleton className="mx-auto h-96 w-full max-w-md" />}>
        <SignupForm />
      </Suspense>
    </div>
  );
}
