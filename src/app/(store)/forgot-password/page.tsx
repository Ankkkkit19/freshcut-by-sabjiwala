import type { Metadata } from "next";
import { ForgotPasswordForm } from "@/components/auth-forms";

export const metadata: Metadata = {
  title: "Forgot password",
  description: "Request a single-use FreshCut password reset link.",
};

export default function ForgotPasswordPage() {
  return (
    <div className="py-6">
      <ForgotPasswordForm />
    </div>
  );
}
