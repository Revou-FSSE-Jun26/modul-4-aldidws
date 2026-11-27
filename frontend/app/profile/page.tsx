"use client";

import { type FormEvent, useEffect, useId, useState } from "react";
import { User as UserIcon } from "lucide-react";
import { useAuth } from "@/context/AuthContext";
import { useRequireAuth } from "@/hooks/useRequireAuth";
import { updateProfile as updateProfileRequest } from "@/lib/services/usersService";
import { ApiError } from "@/lib/errors";
import type { User } from "@/lib/types/api";
import { BaseButton } from "@/components/shared/BaseButton";
import { getInitials } from "@/lib/initials";
import { BoardBgWrapper } from "@/components/board/BoardBgWrapper";
import { PageHeader } from "@/components/shared/PageHeader";

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
    "rounded-lg border bg-background px-4 py-2.5 text-sm text-foreground transition-colors focus:outline-none focus:ring-2 focus:ring-ring disabled:cursor-not-allowed disabled:opacity-50";

  return (
    <form onSubmit={handleSubmit} noValidate className="flex flex-col gap-8">
      {submitError && (
        <div
          role="alert"
          className="rounded-lg border border-destructive/30 bg-destructive/10 px-4 py-3.5 text-sm text-destructive"
        >
          {submitError}
        </div>
      )}
      {status && (
        <div
          role="status"
          aria-live="polite"
          className="rounded-lg border border-green-300 bg-green-50 px-4 py-3.5 text-sm text-green-800"
        >
          {status}
        </div>
      )}

      {/* User identity card */}
      <div className="rounded-xl border border-border/50 bg-card/50 backdrop-blur-sm p-6">
        <div className="flex items-center gap-4">
          <div
            aria-hidden="true"
            className="flex h-16 w-16 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-primary to-primary/70 text-xl font-bold text-primary-foreground shadow-sm"
          >
            {getInitials(user.name, user.email)}
          </div>
          <div className="min-w-0">
            <p className="truncate text-lg font-semibold text-foreground">
              {user.name?.trim() || user.email}
            </p>
            <p className="truncate text-sm text-muted-foreground">{user.email}</p>
          </div>
        </div>
      </div>

      {/* Account details section */}
      <div className="flex flex-col gap-6">
        <div>
          <h3 className="mb-4 text-sm font-semibold uppercase tracking-wider text-muted-foreground">
            Account Details
          </h3>
          <div className="flex flex-col gap-5">
            <div className="flex flex-col gap-2">
              <span className="text-xs font-medium uppercase tracking-wide text-muted-foreground">User ID</span>
              <p className="truncate rounded-lg border border-border/50 bg-muted/30 px-3 py-2 font-mono text-sm text-foreground">
                {user.id}
              </p>
            </div>

            <div className="flex flex-col gap-2">
              <label htmlFor={`${baseId}-name`} className="text-sm font-medium text-foreground">
                Display Name
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
              <div className="flex items-center justify-between">
                <p id={`${baseId}-name-count`} className="text-xs text-muted-foreground">
                  {name.length} / {MAX_NAME_LENGTH} characters
                </p>
              </div>
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

            <div className="flex flex-col gap-2">
              <label htmlFor={`${baseId}-email`} className="text-sm font-medium text-foreground">
                Email Address
              </label>
              <input
                id={`${baseId}-email`}
                type="email"
                value={user.email}
                readOnly
                className={`${inputClasses} border-border/50 bg-muted/50 cursor-not-allowed`}
              />
              <p className="text-xs text-muted-foreground">Email address cannot be changed.</p>
            </div>

            <div className="flex flex-col gap-2">
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
          </div>
        </div>
      </div>

      {/* Action buttons */}
      <div className="flex flex-wrap items-center gap-3 border-t border-border/50 pt-6">
        <BaseButton
          type="submit"
          disabled={isSubmitting || !isDirty}
          aria-describedby={!isDirty ? `${baseId}-save-help` : undefined}
          className="min-w-[120px]"
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
          <p id={`${baseId}-save-help`} className="text-sm text-muted-foreground">
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
    <BoardBgWrapper className="flex flex-1 flex-col">
      <PageHeader
        title="Profile"
        description="Update your account details."
        icon={<UserIcon size={16} strokeWidth={1.5} />}
      />
      <main className="flex-1 overflow-y-auto px-4 py-6 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-2xl">
          {isAuthLoading || !token || !currentUser ? (
            <div
              className="flex flex-col gap-6"
              aria-busy="true"
              aria-label="Loading profile"
            >
              <div className="h-32 animate-pulse rounded-xl border border-border/50 bg-muted" />
              <div className="h-20 animate-pulse rounded-xl border border-border/50 bg-muted" />
              <div className="h-20 animate-pulse rounded-xl border border-border/50 bg-muted" />
            </div>
          ) : (
            <ProfileForm user={currentUser} token={token} />
          )}
        </div>
      </main>
    </BoardBgWrapper>
  );
}
