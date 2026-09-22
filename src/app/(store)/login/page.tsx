import type { Metadata } from "next";
import { Suspense } from "react";
import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { LoginForm } from "@/components/auth-forms";
import { Skeleton } from "@/components/ui";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Sign in",
  description: "Sign in to FreshCut to sync your cart, orders and WhatsApp account.",
};

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string }>;
}) {
  const user = await getCurrentUser();
  const { next } = await searchParams;
  if (user) redirect(next && next.startsWith("/") ? next : "/");

  return (
    <div className="py-6">
      <Suspense fallback={<Skeleton className="mx-auto h-80 w-full max-w-md" />}>
        <LoginForm />
      </Suspense>
    </div>
  );
}
