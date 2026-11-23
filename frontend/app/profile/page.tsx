"use client";

import { type FormEvent, useEffect, useRef, useState } from "react";
import { useAuth } from "@/context/AuthContext";
import { BaseButton } from "@/components/shared/BaseButton";

// ---------------------------------------------------------------------------
// API helper
// ---------------------------------------------------------------------------

const API_BASE = process.env.NEXT_PUBLIC_API_BASE_URL ?? "";

interface UpdatedUser {
  id: string;
  email: string;
  role: string;
  timezone: string;
}

async function patchProfile(
  token: string,
  payload: { email?: string; timezone?: string },
): Promise<UpdatedUser> {
  // PATCH /api/users/me is not yet implemented on the backend.
  // When it ships it should return { data: UpdatedUser }.
  // A 404 or 405 is treated as a retriable "not yet available" error so the
  // user knows to try again later rather than seeing a generic failure.
  const res = await fetch(`${API_BASE}/api/users/me`, {
    method: "PATCH",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify(payload),
    cache: "no-store",
  });

  if (!res.ok) {
    const json = (await res.json().catch(() => null)) as {
      error?: { message?: string };
    } | null;
    throw new Error(
      json?.error?.message ??
        `Failed to save profile (${res.status}). The endpoint may not be available yet.`,
    );
  }

  const json = (await res.json()) as { data: UpdatedUser };
  return json.data;
}

// ---------------------------------------------------------------------------
// Toast — inline, no library dependency
// ---------------------------------------------------------------------------

type ToastState =
  | { visible: false }
  | { visible: true; message: string };

function SuccessToast({ message }: { message: string }) {
  return (
    <div
      role="status"
      aria-live="polite"
      className="flex items-center gap-2 rounded-md border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-800"
    >
      {/* ✓ icon */}
      <svg
        xmlns="http://www.w3.org/2000/svg"
        viewBox="0 0 16 16"
        fill="currentColor"
        className="h-4 w-4 shrink-0"
        aria-hidden="true"
      >
        <path
          fillRule="evenodd"
          d="M12.416 3.376a.75.75 0 0 1 .208 1.04l-5 7.5a.75.75 0 0 1-1.154.114l-3-3a.75.75 0 0 1 1.06-1.06l2.353 2.353 4.493-6.74a.75.75 0 0 1 1.04-.207Z"
          clipRule="evenodd"
        />
      </svg>
      {message}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Field component — label + input pair
// ---------------------------------------------------------------------------

interface FormFieldProps {
  id: string;
  label: string;
  type?: "text" | "email";
  value: string;
  onChange: (value: string) => void;
  disabled?: boolean;
  error?: string | null;
  autoComplete?: string;
}

function FormField({
  id,
  label,
  type = "text",
  value,
  onChange,
  disabled = false,
  error,
  autoComplete,
}: FormFieldProps) {
  return (
    <div className="flex flex-col gap-1.5">
      <label
        htmlFor={id}
        className="text-sm font-medium text-foreground"
      >
        {label}
      </label>
      <input
        id={id}
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        disabled={disabled}
        autoComplete={autoComplete}
        aria-invalid={error != null}
        aria-describedby={error ? `${id}-error` : undefined}
        className={[
          "rounded-md border bg-background px-3 py-2 text-sm text-foreground",
          "placeholder:text-muted-foreground",
          "focus:outline-none focus:ring-2 focus:ring-ring",
          "disabled:cursor-not-allowed disabled:opacity-50",
          error
            ? "border-destructive focus:ring-destructive"
            : "border-border",
        ].join(" ")}
      />
      {error && (
        <p
          id={`${id}-error`}
          role="alert"
          className="text-xs text-destructive"
        >
          {error}
        </p>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

/**
 * Profile settings page — Client Component.
 *
 * Uses `"use client"` because it:
 *   - Reads and writes AuthContext (currentUser, token, updateProfile)
 *   - Manages controlled form inputs with useState
 *   - Displays a success toast and inline error on submit
 *
 * Calls PATCH /api/users/me and updates AuthContext optimistically on success.
 * On failure, the error message is shown inline WITHOUT clearing typed values.
 */
export default function ProfilePage() {
  const { currentUser, token, isLoading: isAuthLoading, updateProfile } =
    useAuth();

  // ---- Form state ----
  const [email, setEmail] = useState("");
  const [timezone, setTimezone] = useState("");

  // ---- Submission state ----
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [toast, setToast] = useState<ToastState>({ visible: false });

  // Auto-dismiss toast after 4 s
  const toastTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Pre-populate fields from AuthContext once currentUser is available.
  // We only seed the initial value; after that the user owns the input.
  const seededRef = useRef(false);
  useEffect(() => {
    if (!seededRef.current && currentUser) {
      setEmail(currentUser.email);
      setTimezone(currentUser.timezone);
      seededRef.current = true;
    }
  }, [currentUser]);

  // Clean up toast timer on unmount
  useEffect(() => {
    return () => {
      if (toastTimerRef.current) clearTimeout(toastTimerRef.current);
    };
  }, []);

  function showToast(message: string) {
    setToast({ visible: true, message });
    if (toastTimerRef.current) clearTimeout(toastTimerRef.current);
    toastTimerRef.current = setTimeout(
      () => setToast({ visible: false }),
      4000,
    );
  }

  // ---- Client-side validation ----
  const [emailError, setEmailError] = useState<string | null>(null);
  const [timezoneError, setTimezoneError] = useState<string | null>(null);

  function validateForm(): boolean {
    let valid = true;

    const trimmedEmail = email.trim();
    if (!trimmedEmail) {
      setEmailError("Email is required.");
      valid = false;
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmedEmail)) {
      setEmailError("Enter a valid email address.");
      valid = false;
    } else {
      setEmailError(null);
    }

    const trimmedTz = timezone.trim();
    if (!trimmedTz) {
      setTimezoneError("Timezone is required.");
      valid = false;
    } else {
      setTimezoneError(null);
    }

    return valid;
  }

  async function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setSubmitError(null);

    if (!validateForm()) return;
    if (!token) {
      setSubmitError("You must be signed in to update your profile.");
      return;
    }

    setIsSubmitting(true);

    try {
      const updated = await patchProfile(token, {
        email: email.trim(),
        timezone: timezone.trim(),
      });

      // Sync AuthContext with the confirmed server values
      updateProfile({ email: updated.email, timezone: updated.timezone });

      // Show toast — do NOT clear the inputs (they already show the saved values)
      showToast("Profile saved successfully.");
    } catch (err: unknown) {
      // Show inline error WITHOUT clearing typed values (frontend.md §8.1)
      setSubmitError(
        err instanceof Error ? err.message : "Failed to save profile.",
      );
    } finally {
      setIsSubmitting(false);
    }
  }

  // ---- Loading state ----
  if (isAuthLoading) {
    return (
      <main className="min-h-screen bg-background px-4 py-8 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-lg">
          <div className="mb-8 h-7 w-32 animate-pulse rounded bg-muted" aria-hidden="true" />
          <div className="flex flex-col gap-4">
            <div className="h-16 animate-pulse rounded-md border border-border bg-muted" />
            <div className="h-16 animate-pulse rounded-md border border-border bg-muted" />
          </div>
        </div>
      </main>
    );
  }

  // ---- Unauthenticated ----
  if (!currentUser) {
    return (
      <main className="min-h-screen bg-background px-4 py-8 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-lg">
          <p className="text-sm text-muted-foreground">
            Please sign in to view your profile.
          </p>
        </div>
      </main>
    );
  }

  // ---- Form ----
  return (
    <main className="min-h-screen bg-background px-4 py-8 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-lg">
        {/* Page header */}
        <header className="mb-8">
          <h1 className="text-2xl font-semibold tracking-tight text-foreground">
            Profile
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Update your account details.
          </p>
        </header>

        {/* Success toast */}
        {toast.visible && (
          <div className="mb-6">
            <SuccessToast message={toast.message} />
          </div>
        )}

        {/* Inline submit error — shown WITHOUT clearing field values */}
        {submitError && (
          <div
            role="alert"
            className="mb-6 rounded-md border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive"
          >
            {submitError}
          </div>
        )}

        <form onSubmit={handleSubmit} noValidate className="flex flex-col gap-6">
          {/* Read-only user ID */}
          <div className="flex flex-col gap-1.5">
            <span className="text-sm font-medium text-muted-foreground">
              User ID
            </span>
            <p className="truncate font-mono text-sm text-foreground">
              {currentUser.id}
            </p>
          </div>

          <FormField
            id="profile-email"
            label="Email"
            type="email"
            value={email}
            onChange={(v) => {
              setEmail(v);
              if (emailError) setEmailError(null);
              if (submitError) setSubmitError(null);
            }}
            disabled={isSubmitting}
            error={emailError}
            autoComplete="email"
          />

          <FormField
            id="profile-timezone"
            label="Timezone"
            type="text"
            value={timezone}
            onChange={(v) => {
              setTimezone(v);
              if (timezoneError) setTimezoneError(null);
              if (submitError) setSubmitError(null);
            }}
            disabled={isSubmitting}
            error={timezoneError}
            autoComplete="off"
          />

          {/* Read-only role badge */}
          <div className="flex flex-col gap-1.5">
            <span className="text-sm font-medium text-muted-foreground">
              Role
            </span>
            <span className="inline-flex w-fit items-center rounded-full bg-muted px-2.5 py-0.5 text-xs font-medium capitalize text-foreground">
              {currentUser.role}
            </span>
          </div>

          {/* Actions */}
          <div className="flex items-center gap-3 pt-2">
            <BaseButton type="submit" variant="primary" disabled={isSubmitting}>
              {isSubmitting ? "Saving…" : "Save changes"}
            </BaseButton>
          </div>
        </form>
      </div>
    </main>
  );
}
