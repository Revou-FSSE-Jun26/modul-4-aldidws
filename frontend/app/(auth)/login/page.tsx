"use client";

import { type FormEvent, Suspense, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Eye, EyeOff } from "lucide-react";
import { safeNextPath } from "@/lib/safeNextPath";
import { useAuth } from "@/context/AuthContext";
import { BaseButton } from "@/components/shared/BaseButton";
import { AuthBackground } from "@/components/shared/AuthBackground";

/**
 * Login page — Client Component.
 *
 * Calls useAuth().login() on submit and redirects to '/' on success.
 * On failure, displays an inline error message identified by
 * data-testid="login-error" for Playwright test targeting.
 */
export default function LoginPage() {
  // useSearchParams needs a Suspense boundary so the rest of the route can be prerendered.
  return (
    <Suspense fallback={null}>
      <LoginForm />
    </Suspense>
  );
}

function LoginForm() {
  const { login } = useAuth();
  const router = useRouter();
  const searchParams = useSearchParams();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);

    if (!email.trim()) {
      setError("Email is required.");
      return;
    }
    if (!password) {
      setError("Password is required.");
      return;
    }

    setIsSubmitting(true);

    try {
      await login(email.trim(), password);
      router.push(safeNextPath(searchParams.get("next")));
    } catch {
      // AuthContext throws the raw error body or a plain Error.
      // We show a generic message so we never leak internal details.
      setError("Invalid email or password. Please try again.");
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <AuthBackground>
      <div className="w-full max-w-sm space-y-6 rounded-[var(--radius-panel)] bg-[var(--bg-panel)] p-8 shadow-[var(--shadow-panel)]">
        <header className="text-center">
          <h1 className="text-3xl font-black tracking-tight text-foreground">
            Sign in
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Welcome back !
          </p>
        </header>

        {/* Inline error — data-testid used by Playwright */}
        {error && (
          <p
            role="alert"
            data-testid="login-error"
            className="rounded-md border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive"
          >
            {error}
          </p>
        )}

        <form onSubmit={handleSubmit} noValidate className="flex flex-col gap-4">
          <div className="flex flex-col gap-1.5">
            <label htmlFor="login-email" className="text-sm font-medium text-foreground">
              Email
            </label>
            <input
              id="login-email"
              type="email"
              autoComplete="email"
              value={email}
              onChange={(e) => { setEmail(e.target.value); setError(null); }}
              disabled={isSubmitting}
              className="rounded-md border border-border bg-background px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring disabled:opacity-50"
            />
          </div>

          <div className="flex flex-col gap-1.5">
            <label htmlFor="login-password" className="text-sm font-medium text-foreground">
              Password
            </label>
            <div className="relative">
              <input
                id="login-password"
                type={showPassword ? "text" : "password"}
                autoComplete="current-password"
                value={password}
                onChange={(e) => { setPassword(e.target.value); setError(null); }}
                disabled={isSubmitting}
                className="w-full rounded-md border border-border bg-background px-3 py-2 pr-10 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring disabled:opacity-50"
              />
              <button
                type="button"
                onClick={() => setShowPassword((v) => !v)}
                aria-label={showPassword ? "Hide password" : "Show password"}
                className="absolute inset-y-0 right-0 flex items-center px-3 text-[var(--text-muted)] hover:text-[var(--text-secondary)]"
              >
                {showPassword ? <EyeOff size={16} strokeWidth={1.5} /> : <Eye size={16} strokeWidth={1.5} />}
              </button>
            </div>
          </div>

          <BaseButton type="submit" variant="primary" disabled={isSubmitting}>
            {isSubmitting ? "Signing in\u2026" : "Sign in"}
          </BaseButton>
        </form>

        <p className="text-center text-sm text-[var(--text-muted)]">
          Don&apos;t have an account?{" "}
          <Link
            href="/register"
            className="font-medium text-[var(--brand)] hover:text-[var(--brand-hover)] underline-offset-4 hover:underline"
          >
            Create one
          </Link>
        </p>
      </div>
    </AuthBackground>
  );
}
