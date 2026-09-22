"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { apiFetch } from "@/lib/client";
import { Alert, Button, Card, Field, Input } from "@/components/ui";
import { useCartUi } from "@/components/store";

function useNextParam() {
  const params = useSearchParams();
  const next = params.get("next");
  return next && next.startsWith("/") ? next : "/";
}

export function LoginForm() {
  const router = useRouter();
  const next = useNextParam();
  const setCount = useCartUi((s) => s.setCount);
  const [identifier, setIdentifier] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setLoading(true);
    setError(null);
    try {
      const data = await apiFetch<{ user: { role: string } }>("/api/auth/login", {
        method: "POST",
        json: { identifier, password },
      });
      // Cart is merged server-side on login; refresh the UI count from the API.
      const me = await apiFetch<{ cartCount: number }>("/api/auth/me");
      setCount(me.cartCount);
      router.push(data.user.role === "ADMIN" && next === "/" ? "/admin" : next);
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not sign in");
    } finally {
      setLoading(false);
    }
  }

  return (
    <Card className="mx-auto w-full max-w-md">
      <h1 className="text-xl font-bold text-ink">Sign in to FreshCut</h1>
      <p className="mt-1 text-sm text-neutral-600">
        Use your email or phone number. Sessions are HttpOnly cookie based — never stored in the browser.
      </p>
      <form onSubmit={submit} className="mt-4 space-y-3">
        <Field label="Email or phone" htmlFor="identifier">
          <Input
            id="identifier"
            value={identifier}
            onChange={(event) => setIdentifier(event.target.value)}
            autoComplete="username"
            placeholder="demo@freshcut.local"
            required
          />
        </Field>
        <Field label="Password" htmlFor="password">
          <Input
            id="password"
            type="password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            autoComplete="current-password"
            required
          />
        </Field>
        {error ? <Alert tone="danger" title="Sign in failed">{error}</Alert> : null}
        <Button type="submit" size="lg" className="w-full" loading={loading}>
          Sign in
        </Button>
      </form>
      <div className="mt-4 space-y-2 text-xs text-neutral-600">
        <p>
          New here?{" "}
          <Link href="/signup" className="font-semibold text-brand-700 hover:underline">
            Create an account
          </Link>
        </p>
        <p>
          <Link href="/forgot-password" className="font-semibold text-brand-700 hover:underline">
            Forgot password?
          </Link>
        </p>
        <Alert tone="info" title="Demo accounts (development only)">
          <span className="block">Admin: admin@freshcut.local / Admin@12345</span>
          <span className="block">Customer: demo@freshcut.local / Demo@12345</span>
        </Alert>
      </div>
    </Card>
  );
}

export function SignupForm() {
  const router = useRouter();
  const next = useNextParam();
  const [values, setValues] = useState({ name: "", email: "", phone: "", password: "" });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setLoading(true);
    setError(null);
    try {
      await apiFetch("/api/auth/signup", { method: "POST", json: values });
      router.push(next);
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not create account");
    } finally {
      setLoading(false);
    }
  }

  return (
    <Card className="mx-auto w-full max-w-md">
      <h1 className="text-xl font-bold text-ink">Create your FreshCut account</h1>
      <p className="mt-1 text-sm text-neutral-600">
        One account works on the website and on WhatsApp — same cart, same orders.
      </p>
      <form onSubmit={submit} className="mt-4 space-y-3">
        <Field label="Full name" htmlFor="name">
          <Input
            id="name"
            value={values.name}
            onChange={(event) => setValues((v) => ({ ...v, name: event.target.value }))}
            required
            minLength={2}
          />
        </Field>
        <Field label="Email" htmlFor="email">
          <Input
            id="email"
            type="email"
            value={values.email}
            onChange={(event) => setValues((v) => ({ ...v, email: event.target.value }))}
            autoComplete="email"
            required
          />
        </Field>
        <Field label="Phone (optional)" htmlFor="phone" hint="Used for WhatsApp order updates.">
          <Input
            id="phone"
            value={values.phone}
            onChange={(event) => setValues((v) => ({ ...v, phone: event.target.value }))}
            placeholder="+91 98765 43210"
          />
        </Field>
        <Field label="Password" htmlFor="password" hint="Minimum 8 characters. Hashed with bcrypt.">
          <Input
            id="password"
            type="password"
            value={values.password}
            onChange={(event) => setValues((v) => ({ ...v, password: event.target.value }))}
            autoComplete="new-password"
            minLength={8}
            required
          />
        </Field>
        {error ? <Alert tone="danger" title="Signup failed">{error}</Alert> : null}
        <Button type="submit" size="lg" className="w-full" loading={loading}>
          Create account
        </Button>
      </form>
      <p className="mt-4 text-xs text-neutral-600">
        Already have an account?{" "}
        <Link href="/login" className="font-semibold text-brand-700 hover:underline">
          Sign in
        </Link>
      </p>
    </Card>
  );
}

export function ForgotPasswordForm() {
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [devToken, setDevToken] = useState<string | null>(null);

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setLoading(true);
    setMessage(null);
    try {
      const data = await apiFetch<{ sent: boolean; devToken: string | null }>("/api/auth/password", {
        method: "POST",
        json: { mode: "request", email },
      });
      setDevToken(data.devToken);
      setMessage("If that email exists, a reset link has been sent.");
    } catch (err) {
      setMessage(err instanceof Error ? err.message : "Could not request a reset link");
    } finally {
      setLoading(false);
    }
  }

  return (
    <Card className="mx-auto w-full max-w-md">
      <h1 className="text-xl font-bold text-ink">Reset your password</h1>
      <p className="mt-1 text-sm text-neutral-600">
        We email a single-use link that expires in 30 minutes. Sessions are revoked after a reset.
      </p>
      <form onSubmit={submit} className="mt-4 space-y-3">
        <Field label="Email" htmlFor="reset-email">
          <Input
            id="reset-email"
            type="email"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            required
          />
        </Field>
        <Button type="submit" className="w-full" loading={loading}>
          Send reset link
        </Button>
      </form>
      {message ? <Alert tone="info" title="Reset requested">{message}</Alert> : null}
      {devToken ? (
        <Alert tone="warn" title="No mail provider configured in this environment">
          <span className="block">
            Use this link to continue:{" "}
            <Link href={`/reset-password?token=${devToken}`} className="font-semibold underline">
              /reset-password?token={devToken.slice(0, 10)}…
            </Link>
          </span>
        </Alert>
      ) : null}
      <p className="mt-4 text-xs text-neutral-600">
        <Link href="/login" className="font-semibold text-brand-700 hover:underline">
          Back to sign in
        </Link>
      </p>
    </Card>
  );
}

export function ResetPasswordForm({ token }: { token: string }) {
  const router = useRouter();
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setLoading(true);
    setError(null);
    try {
      await apiFetch("/api/auth/password", { method: "POST", json: { mode: "reset", token, password } });
      setDone(true);
      setTimeout(() => {
        router.push("/login");
        router.refresh();
      }, 1600);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not reset password");
    } finally {
      setLoading(false);
    }
  }

  return (
    <Card className="mx-auto w-full max-w-md">
      <h1 className="text-xl font-bold text-ink">Choose a new password</h1>
      <p className="mt-1 text-sm text-neutral-600">Passwords are hashed with bcrypt (10 rounds).</p>
      <form onSubmit={submit} className="mt-4 space-y-3">
        <Field label="New password" htmlFor="new-password" hint="Minimum 8 characters.">
          <Input
            id="new-password"
            type="password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            minLength={8}
            required
          />
        </Field>
        {error ? <Alert tone="danger" title="Reset failed">{error}</Alert> : null}
        {done ? <Alert tone="success" title="Password updated">Redirecting you to sign in…</Alert> : null}
        <Button type="submit" className="w-full" loading={loading}>
          Update password
        </Button>
      </form>
    </Card>
  );
}
