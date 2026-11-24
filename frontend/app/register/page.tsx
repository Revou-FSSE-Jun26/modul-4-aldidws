"use client";

import { type FormEvent, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { register as registerAccount } from "@/lib/services/authService";
import { ApiError } from "@/lib/errors";
import { BaseButton } from "@/components/shared/BaseButton";
import { useErrorHandler } from "@/hooks/useErrorHandler";
import { showSuccess } from "@/lib/toast";

/** Minimal email format check — matches the regex used in profile/page.tsx. */
const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
/** Password must be at least 8 chars with one uppercase, one lowercase, one digit. */
const PASSWORD_REGEX = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d).{8,}$/;

/**
 * Register page — Client Component.
 *
 * 4 controlled fields: name, email, password, confirmPassword.
 * Validates client-side before hitting POST /api/auth/register.
 * On success redirects to /login.
 * On API error shows an inline submit error without clearing field values.
 */
export default function RegisterPage() {
  const router = useRouter();
  const { handleError } = useErrorHandler();

  // ---- Field state ----
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");

  // ---- Field-level errors ----
  const [nameError, setNameError] = useState<string | null>(null);
  const [emailError, setEmailError] = useState<string | null>(null);
  const [passwordError, setPasswordError] = useState<string | null>(null);
  const [confirmPasswordError, setConfirmPasswordError] = useState<string | null>(null);

  // ---- Submit state ----
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  function validateForm(): boolean {
    let valid = true;

    if (!name.trim()) {
      setNameError("Name is required.");
      valid = false;
    } else {
      setNameError(null);
    }

    const trimmedEmail = email.trim();
    if (!trimmedEmail) {
      setEmailError("Email is required.");
      valid = false;
    } else if (!EMAIL_REGEX.test(trimmedEmail)) {
      setEmailError("Enter a valid email address.");
      valid = false;
    } else {
      setEmailError(null);
    }

    if (!password) {
      setPasswordError("Password is required.");
      valid = false;
    } else if (!PASSWORD_REGEX.test(password)) {
      setPasswordError(
        "Password must be at least 8 characters and include an uppercase letter, a lowercase letter, and a digit.",
      );
      valid = false;
    } else {
      setPasswordError(null);
    }

    if (!confirmPassword) {
      setConfirmPasswordError("Please confirm your password.");
      valid = false;
    } else if (confirmPassword !== password) {
      setConfirmPasswordError("Passwords do not match.");
      valid = false;
    } else {
      setConfirmPasswordError(null);
    }

    return valid;
  }

  async function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setSubmitError(null);

    if (!validateForm()) return;

    setIsSubmitting(true);

    try {
      await registerAccount({
        name: name.trim(),
        email: email.trim(),
        password,
      });
      showSuccess("Account created! Please sign in.");
      router.push("/login");
    } catch (err: unknown) {
      handleError(err);
      if (err instanceof ApiError) {
        setSubmitError(err.message);
      } else if (err instanceof Error) {
        setSubmitError(err.message);
      } else {
        setSubmitError("Registration failed. Please try again.");
      }
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <main className="flex flex-1 items-center justify-center bg-background px-4">
      <div className="w-full max-w-sm space-y-6">
        <header className="text-center">
          <h1 className="text-2xl font-semibold tracking-tight text-foreground">
            Create account
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Fill in the details below to register.
          </p>
        </header>

        {/* Inline submit error */}
        {submitError && (
          <p
            role="alert"
            data-testid="register-error"
            className="rounded-md border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive"
          >
            {submitError}
          </p>
        )}

        <form onSubmit={handleSubmit} noValidate className="flex flex-col gap-4">
          {/* Name */}
          <div className="flex flex-col gap-1.5">
            <label
              htmlFor="register-name"
              className="text-sm font-medium text-foreground"
            >
              Name
            </label>
            <input
              id="register-name"
              type="text"
              autoComplete="name"
              value={name}
              onChange={(e) => {
                setName(e.target.value);
                if (nameError) setNameError(null);
              }}
              disabled={isSubmitting}
              aria-invalid={nameError != null}
              aria-describedby={nameError ? "register-name-error" : undefined}
              className="rounded-md border border-border bg-background px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring disabled:opacity-50"
            />
            {nameError && (
              <p
                id="register-name-error"
                role="alert"
                className="text-xs text-destructive"
              >
                {nameError}
              </p>
            )}
          </div>

          {/* Email */}
          <div className="flex flex-col gap-1.5">
            <label
              htmlFor="register-email"
              className="text-sm font-medium text-foreground"
            >
              Email
            </label>
            <input
              id="register-email"
              type="email"
              autoComplete="email"
              value={email}
              onChange={(e) => {
                setEmail(e.target.value);
                if (emailError) setEmailError(null);
              }}
              disabled={isSubmitting}
              aria-invalid={emailError != null}
              aria-describedby={emailError ? "register-email-error" : undefined}
              className="rounded-md border border-border bg-background px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring disabled:opacity-50"
            />
            {emailError && (
              <p
                id="register-email-error"
                role="alert"
                className="text-xs text-destructive"
              >
                {emailError}
              </p>
            )}
          </div>

          {/* Password */}
          <div className="flex flex-col gap-1.5">
            <label
              htmlFor="register-password"
              className="text-sm font-medium text-foreground"
            >
              Password
            </label>
            <input
              id="register-password"
              type="password"
              autoComplete="new-password"
              value={password}
              onChange={(e) => {
                setPassword(e.target.value);
                if (passwordError) setPasswordError(null);
              }}
              disabled={isSubmitting}
              aria-invalid={passwordError != null}
              aria-describedby={passwordError ? "register-password-error" : undefined}
              className="rounded-md border border-border bg-background px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring disabled:opacity-50"
            />
            {passwordError && (
              <p
                id="register-password-error"
                role="alert"
                className="text-xs text-destructive"
              >
                {passwordError}
              </p>
            )}
          </div>

          {/* Confirm Password */}
          <div className="flex flex-col gap-1.5">
            <label
              htmlFor="register-confirm-password"
              className="text-sm font-medium text-foreground"
            >
              Confirm password
            </label>
            <input
              id="register-confirm-password"
              type="password"
              autoComplete="new-password"
              value={confirmPassword}
              onChange={(e) => {
                setConfirmPassword(e.target.value);
                if (confirmPasswordError) setConfirmPasswordError(null);
              }}
              disabled={isSubmitting}
              aria-invalid={confirmPasswordError != null}
              aria-describedby={
                confirmPasswordError
                  ? "register-confirm-password-error"
                  : undefined
              }
              className="rounded-md border border-border bg-background px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring disabled:opacity-50"
            />
            {confirmPasswordError && (
              <p
                id="register-confirm-password-error"
                role="alert"
                className="text-xs text-destructive"
              >
                {confirmPasswordError}
              </p>
            )}
          </div>

          <BaseButton
            type="submit"
            variant="primary"
            disabled={isSubmitting}
          >
            {isSubmitting ? "Creating account\u2026" : "Create account"}
          </BaseButton>
        </form>

        <p className="text-center text-sm text-muted-foreground">
          Already have an account?{" "}
          <Link
            href="/login"
            className="font-medium text-foreground underline-offset-4 hover:underline"
          >
            Sign in
          </Link>
        </p>
      </div>
    </main>
  );
}
