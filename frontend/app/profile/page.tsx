"use client";

import { type FormEvent, useEffect, useId, useState } from "react";
import { useAuth } from "@/context/AuthContext";
import { useRequireAuth } from "@/hooks/useRequireAuth";
import { updateProfile as updateProfileRequest } from "@/lib/services/usersService";
import { ApiError } from "@/lib/errors";
import type { User } from "@/lib/types/api";
import { BaseButton } from "@/components/shared/BaseButton";
import { getInitials } from "@/lib/initials";

const MAX_NAME_LENGTH = 255;
/** Show the polite remaining-characters message only this close to the limit. */
const NAME_WARN_THRESHOLD = 235;

/** IANA zone names from the browser, with the current value and UTC included. */
function timezoneOptions(current: string): string[] {
  const supported =
    typeof Intl.supportedValuesOf === "function"
      ? Intl.supportedValuesOf("timeZone")
      : [];
  return Array.from(new Set(["UTC", current, ...supported].filter(Boolean)));
}

interface FieldErrors {
  name?: string;
  timezone?: string;
}

function ProfileForm({ user, token }: { user: User; token: string }) {
  const { updateProfile } = useAuth();
  const baseId = useId();
  const [saved, setSaved] = useState({
    name: (user.name ?? "").trim(),
    timezone: user.timezone,
  });
  const [name, setName] = useState(user.name ?? "");
  const [timezone, setTimezone] = useState(user.timezone);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});
  const [status, setStatus] = useState("");

  const isDirty = name.trim() !== saved.name || timezone !== saved.timezone;

  // Guard tab close/reload only while there are unsaved changes.
  useEffect(() => {
    if (!isDirty) return;
    const handler = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      e.returnValue = "";
    };
    window.addEventListener("beforeunload", handler);
    return () => window.removeEventListener("beforeunload", handler);
  }, [isDirty]);

  function handleReset() {
    setName(saved.name);
    setTimezone(saved.timezone);
    setFieldErrors({});
    setSubmitError(null);
    setStatus("");
  }

  async function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setSubmitError(null);
    setStatus("");

    const trimmedName = name.trim();
    const errors: FieldErrors = {};
    if (trimmedName.length > MAX_NAME_LENGTH) {
      errors.name = `Name must be ${MAX_NAME_LENGTH} characters or fewer.`;
    }
    if (!timezone) errors.timezone = "Timezone is required.";
    setFieldErrors(errors);
    if (errors.name || errors.timezone) return;

    setIsSubmitting(true);
    try {
      // Exactly {name, timezone}; the backend rejects unknown fields such as email.
      const updated = await updateProfileRequest(token, {
        name: trimmedName,
        timezone,
      });
      updateProfile({ name: updated.name, timezone: updated.timezone });
      setSaved({ name: (updated.name ?? "").trim(), timezone: updated.timezone });
      setName(updated.name ?? "");
      setTimezone(updated.timezone);
      setStatus("Profile saved successfully.");
    } catch (err: unknown) {
      // Typed values stay in the inputs.
      if (err instanceof ApiError && err.details) {
        setFieldErrors({
          name: err.details.name?.[0],
          timezone: err.details.timezone?.[0],
        });
        if (!err.details.name && !err.details.timezone) setSubmitError(err.message);
      } else {
        setSubmitError(err instanceof Error ? err.message : "Failed to save profile.");
      }
    } finally {
      setIsSubmitting(false);
    }
  }

  const inputClasses =
    "rounded-md border bg-background px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring disabled:cursor-not-allowed disabled:opacity-50";

  return (
    <form onSubmit={handleSubmit} noValidate className="flex flex-col gap-6">
      {submitError && (
        <div
          role="alert"
          className="rounded-md border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive"
        >
          {submitError}
        </div>
      )}
      <p role="status" aria-live="polite" className="text-sm text-green-800">
        {status}
      </p>

      <div className="flex items-center gap-4">
        <div
          aria-hidden="true"
          className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-primary text-base font-semibold text-primary-foreground"
        >
          {getInitials(user.name, user.email)}
        </div>
        <div className="min-w-0">
          <p className="truncate text-base font-medium text-foreground">
            {user.name?.trim() || user.email}
          </p>
          <p className="truncate text-sm text-muted-foreground">{user.email}</p>
        </div>
      </div>

      <div className="flex flex-col gap-1.5">
        <span className="text-sm font-medium text-muted-foreground">User ID</span>
        <p className="truncate font-mono text-sm text-foreground">{user.id}</p>
      </div>

      <div className="flex flex-col gap-1.5">
        <label htmlFor={`${baseId}-name`} className="text-sm font-medium text-foreground">
          Name
        </label>
        <input
          id={`${baseId}-name`}
          type="text"
          value={name}
          maxLength={MAX_NAME_LENGTH + 1}
          disabled={isSubmitting}
          autoComplete="name"
          onChange={(e) => {
            setName(e.target.value);
            setFieldErrors((f) => ({ ...f, name: undefined }));
          }}
          aria-invalid={fieldErrors.name !== undefined}
          aria-describedby={
            fieldErrors.name
              ? `${baseId}-name-count ${baseId}-name-error`
              : `${baseId}-name-count`
          }
          className={`${inputClasses} ${fieldErrors.name ? "border-destructive" : "border-border"}`}
        />
        <p id={`${baseId}-name-count`} className="text-xs text-muted-foreground">
          {name.length} / {MAX_NAME_LENGTH}
        </p>
        {name.length >= NAME_WARN_THRESHOLD && (
          <p role="status" className="sr-only">
            {Math.max(MAX_NAME_LENGTH - name.length, 0)} characters remaining
          </p>
        )}
        {fieldErrors.name && (
          <p id={`${baseId}-name-error`} role="alert" className="text-xs text-destructive">
            {fieldErrors.name}
          </p>
        )}
      </div>

      <div className="flex flex-col gap-1.5">
        <label htmlFor={`${baseId}-email`} className="text-sm font-medium text-foreground">
          Email
        </label>
        <input
          id={`${baseId}-email`}
          type="email"
          value={user.email}
          readOnly
          className={`${inputClasses} border-border bg-muted`}
        />
        <p className="text-xs text-muted-foreground">Email cannot be changed.</p>
      </div>

      <div className="flex flex-col gap-1.5">
        <label
          htmlFor={`${baseId}-timezone`}
          className="text-sm font-medium text-foreground"
        >
          Timezone
        </label>
        <select
          id={`${baseId}-timezone`}
          value={timezone}
          disabled={isSubmitting}
          onChange={(e) => {
            setTimezone(e.target.value);
            setFieldErrors((f) => ({ ...f, timezone: undefined }));
          }}
          aria-invalid={fieldErrors.timezone !== undefined}
          aria-describedby={fieldErrors.timezone ? `${baseId}-timezone-error` : undefined}
          className={`${inputClasses} ${fieldErrors.timezone ? "border-destructive" : "border-border"}`}
        >
          {timezoneOptions(user.timezone).map((tz) => (
            <option key={tz} value={tz}>
              {tz}
            </option>
          ))}
        </select>
        {fieldErrors.timezone && (
          <p
            id={`${baseId}-timezone-error`}
            role="alert"
            className="text-xs text-destructive"
          >
            {fieldErrors.timezone}
          </p>
        )}
      </div>

      <div className="flex flex-wrap items-center gap-3 pt-2">
        <BaseButton
          type="submit"
          disabled={isSubmitting || !isDirty}
          aria-describedby={!isDirty ? `${baseId}-save-help` : undefined}
        >
          {isSubmitting ? "Saving…" : "Save changes"}
        </BaseButton>
        <BaseButton
          variant="secondary"
          disabled={isSubmitting || !isDirty}
          onClick={handleReset}
        >
          Reset
        </BaseButton>
        {!isDirty && (
          <p id={`${baseId}-save-help`} className="text-xs text-muted-foreground">
            No changes to save
          </p>
        )}
      </div>
    </form>
  );
}

/**
 * Profile settings page. Edits name and timezone through
 * PATCH /api/users/me; email is shown read-only and never sent.
 */
export default function ProfilePage() {
  const { token, isAuthLoading } = useRequireAuth();
  const { currentUser } = useAuth();

  return (
    <main className="flex-1 bg-background px-4 py-8 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-lg">
        <header className="mb-8">
          <h1 className="text-2xl font-semibold tracking-tight text-foreground">
            Profile
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Update your account details.
          </p>
        </header>

        {isAuthLoading || !token || !currentUser ? (
          <div
            className="flex flex-col gap-4"
            aria-busy="true"
            aria-label="Loading profile"
          >
            <div className="h-16 animate-pulse rounded-md border border-border bg-muted" />
            <div className="h-16 animate-pulse rounded-md border border-border bg-muted" />
          </div>
        ) : (
          <ProfileForm user={currentUser} token={token} />
        )}
      </div>
    </main>
  );
}
