"use client";

import { type FormEvent, useEffect, useId, useState } from "react";
import { FolderKanban, Globe, Lock, Sprout } from "lucide-react";
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

  const displayName = user.name?.trim() || user.email.split("@")[0] || "User";
  const workspaceLabel = `${displayName}'s workspace`;

  const inputClasses =
    "h-10 w-full rounded-lg border bg-white px-3.5 text-sm text-[#162B22] transition-colors focus:border-[#16382C] focus:outline-none disabled:cursor-not-allowed disabled:opacity-60";

  return (
    <div className="flex w-full flex-1 flex-col gap-5">
      {/* 1. Hero Banner (Sage Green Card) */}
      <section
        aria-label="Profile overview"
        className="flex flex-col justify-between gap-4 rounded-2xl bg-[#DCE5CC] px-7 py-6 sm:flex-row sm:items-center"
      >
        <div className="min-w-0">
          <p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-[#4E6356]">
            YOUR SPACE
          </p>
          <h1 className="mt-1 truncate font-serif text-3xl italic tracking-tight text-[#162B22] sm:text-[34px] sm:leading-tight">
            Your profile
          </h1>
          <p className="mt-1.5 text-[13px] text-[#3F5347]">
            A little about you. Make yourself at home.
          </p>
        </div>

        <div className="inline-flex w-fit shrink-0 items-center gap-2 rounded-full bg-white/95 px-3.5 py-2 text-xs font-medium text-[#162B22] shadow-2xs">
          <FolderKanban size={14} strokeWidth={1.75} aria-hidden="true" />
          <span>{workspaceLabel}</span>
        </div>
      </section>

      {/* 2. Sub-bar Tab */}
      <div className="flex flex-wrap items-center gap-6 border-b border-[#E6E8E3]">
        <span className="inline-flex items-center border-b-2 border-[#16382C] pb-3 text-[13px] font-semibold text-[#162B22]">
          Account
        </span>
        <span className="pb-3 text-xs text-[#7C8680]">
          Manage your personal information and preferences.
        </span>
      </div>

      {/* 3. Main 2-Column Layout */}
      <div className="grid grid-cols-1 items-start gap-6 lg:grid-cols-[minmax(0,1.65fr)_minmax(0,1fr)]">
        {/* Left Column: Account Details Form */}
        <form
          onSubmit={handleSubmit}
          noValidate
          className="flex flex-col gap-5 rounded-2xl border border-[#E6E8E3] bg-white p-6"
        >
          <div>
            <h2 className="text-base font-semibold text-[#162B22]">
              Account details
            </h2>
            <p className="mt-0.5 text-xs text-[#6E7A73]">
              The essentials that make this workspace yours.
            </p>
          </div>

          {submitError && (
            <div
              role="alert"
              className="rounded-lg border border-destructive/30 bg-destructive/10 px-4 py-3 text-xs text-destructive"
            >
              {submitError}
            </div>
          )}

          {status && (
            <div
              role="status"
              aria-live="polite"
              className="rounded-lg border border-[#C3D8C8] bg-[#EEF5EE] px-4 py-3 text-xs font-medium text-[#1D4E38]"
            >
              {status}
            </div>
          )}

          <div className="flex flex-col gap-4">
            {/* User ID */}
            <div className="flex flex-col gap-1.5">
              <label
                htmlFor={`${baseId}-user-id`}
                className="text-xs font-medium text-[#162B22]"
              >
                User ID
              </label>
              <div className="relative flex items-center">
                <input
                  id={`${baseId}-user-id`}
                  type="text"
                  value={user.id}
                  readOnly
                  className="h-10 w-full cursor-not-allowed rounded-lg border border-[#ECEEE9] bg-[#F7F8F5] pr-9 pl-3.5 text-xs text-[#7C8680] focus:outline-none"
                />
                <Lock
                  size={13}
                  strokeWidth={1.75}
                  aria-hidden="true"
                  className="pointer-events-none absolute right-3 text-[#8C9590]"
                />
              </div>
              <p className="text-[11px] text-[#7C8680]">
                Your unique account identifier.
              </p>
            </div>

            {/* Display Name */}
            <div className="flex flex-col gap-1.5">
              <label
                htmlFor={`${baseId}-name`}
                className="text-xs font-medium text-[#162B22]"
              >
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
                className={`${inputClasses} ${
                  fieldErrors.name ? "border-destructive" : "border-[#DCDFD8]"
                }`}
              />
              <p id={`${baseId}-name-count`} className="text-[11px] text-[#7C8680]">
                {name.length} / {MAX_NAME_LENGTH} characters
              </p>
              {name.length >= NAME_WARN_THRESHOLD && (
                <p role="status" className="sr-only">
                  {Math.max(MAX_NAME_LENGTH - name.length, 0)} characters remaining
                </p>
              )}
              {fieldErrors.name && (
                <p
                  id={`${baseId}-name-error`}
                  role="alert"
                  className="text-xs text-destructive"
                >
                  {fieldErrors.name}
                </p>
              )}
            </div>

            {/* Email Address */}
            <div className="flex flex-col gap-1.5">
              <label
                htmlFor={`${baseId}-email`}
                className="text-xs font-medium text-[#162B22]"
              >
                Email Address
              </label>
              <div className="relative flex items-center">
                <input
                  id={`${baseId}-email`}
                  type="email"
                  value={user.email}
                  readOnly
                  className="h-10 w-full cursor-not-allowed rounded-lg border border-[#ECEEE9] bg-[#F7F8F5] pr-9 pl-3.5 text-xs text-[#7C8680] focus:outline-none"
                />
                <Lock
                  size={13}
                  strokeWidth={1.75}
                  aria-hidden="true"
                  className="pointer-events-none absolute right-3 text-[#8C9590]"
                />
              </div>
              <p className="text-[11px] text-[#7C8680]">
                Email address cannot be changed.
              </p>
            </div>

            {/* Timezone */}
            <div className="flex flex-col gap-1.5">
              <label
                htmlFor={`${baseId}-timezone`}
                className="text-xs font-medium text-[#162B22]"
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
                aria-describedby={
                  fieldErrors.timezone ? `${baseId}-timezone-error` : undefined
                }
                className={`${inputClasses} ${
                  fieldErrors.timezone ? "border-destructive" : "border-[#DCDFD8]"
                }`}
              >
                {timezoneOptions(user.timezone).map((tz) => (
                  <option key={tz} value={tz}>
                    {tz}
                  </option>
                ))}
              </select>
              <p className="text-[11px] text-[#7C8680]">
                Dates and times are shown in your local timezone.
              </p>
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

          {/* Action Buttons */}
          <div className="flex flex-wrap items-center gap-2.5 border-t border-[#F0F1ED] pt-4">
            <BaseButton
              type="submit"
              size="sm"
              disabled={isSubmitting || !isDirty}
              aria-describedby={!isDirty ? `${baseId}-save-help` : undefined}
              className="cursor-pointer"
            >
              {isSubmitting ? "Saving…" : "Save changes"}
            </BaseButton>
            <BaseButton
              type="button"
              variant="secondary"
              size="sm"
              disabled={isSubmitting || !isDirty}
              onClick={handleReset}
              className="cursor-pointer"
            >
              Reset
            </BaseButton>
            {!isDirty && (
              <p id={`${baseId}-save-help`} className="text-xs text-[#7C8680]">
                No changes to save
              </p>
            )}
          </div>
        </form>

        {/* Right Column: Identity Summary & Tip Card */}
        <aside className="flex flex-col gap-4">
          <div className="rounded-2xl border border-[#E6E8E3] bg-white p-6">
            <div className="flex items-center gap-3.5 border-b border-[#F0F1ED] pb-4">
              <div
                aria-hidden="true"
                className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-[#DCE5CC] text-base font-semibold text-[#162B22]"
              >
                {getInitials(user.name, user.email)}
              </div>
              <div className="min-w-0">
                <p className="truncate text-sm font-semibold text-[#162B22]">
                  {displayName}
                </p>
                <p className="truncate text-xs text-[#6E7A73]">{user.email}</p>
              </div>
            </div>

            <div className="mt-4 space-y-2.5">
              <div>
                <p className="text-[10px] font-semibold uppercase tracking-[0.08em] text-[#7C8680]">
                  YOUR WORKSPACE
                </p>
                <p className="mt-1 text-sm font-semibold text-[#162B22]">
                  {workspaceLabel}
                </p>
              </div>

              <div className="flex items-center gap-2 pt-1 text-xs text-[#4E6356]">
                <Globe size={13} strokeWidth={1.75} aria-hidden="true" />
                <span>{timezone}</span>
              </div>
            </div>
          </div>

          <div className="rounded-2xl bg-[#EEF2E6] p-6">
            <div className="flex items-center gap-2 text-sm font-semibold text-[#162B22]">
              <Sprout size={15} strokeWidth={1.75} aria-hidden="true" />
              <span>A little more you.</span>
            </div>
            <p className="mt-2 text-xs leading-relaxed text-[#4E6356]">
              Keep your name up to date so your team knows who&apos;s moving
              things forward.
            </p>
          </div>
        </aside>
      </div>
    </div>
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
    <div className="flex min-h-full w-full flex-1 flex-col px-4 py-5 sm:px-6 lg:px-8">
      {isAuthLoading || !token || !currentUser ? (
        <div
          className="flex flex-col gap-6"
          aria-busy="true"
          aria-label="Loading profile"
        >
          <div className="h-32 animate-pulse rounded-2xl bg-[#DCE5CC]/70" />
          <div className="h-64 animate-pulse rounded-2xl border border-[#E6E8E3] bg-white" />
        </div>
      ) : (
        <ProfileForm user={currentUser} token={token} />
      )}
    </div>
  );
}