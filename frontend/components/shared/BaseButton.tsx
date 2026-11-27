"use client";

import { type ButtonHTMLAttributes } from "react";

type ButtonVariant = "primary" | "secondary" | "danger" | "destructive";
type ButtonSize = "md" | "sm" | "icon";

interface BaseButtonProps
  extends Omit<ButtonHTMLAttributes<HTMLButtonElement>, "className"> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  className?: string;
}

const variantClasses: Record<ButtonVariant, string> = {
  primary:
    "bg-[var(--brand)] text-white hover:bg-[var(--brand-hover)] focus-visible:ring-[var(--brand)] disabled:bg-[var(--brand-light)]",
  secondary:
    "bg-[var(--bg-panel)] text-[var(--text-secondary)] border border-[var(--border)] hover:bg-[var(--bg-hover)] focus-visible:ring-[var(--border)] disabled:text-[var(--text-muted)] disabled:border-[var(--border)]",
  danger:
    "bg-[var(--accent-red)] text-white hover:bg-[var(--accent-red)]/90 focus-visible:ring-[var(--accent-red)] disabled:bg-[var(--accent-red)]/50",
  // `destructive` is the canonical variant name; `danger` is kept as a
  // non-breaking alias mapping to the same classes so existing call sites
  // (e.g. delete buttons) keep working.
  destructive:
    "bg-[var(--accent-red)] text-white hover:bg-[var(--accent-red)]/90 focus-visible:ring-[var(--accent-red)] disabled:bg-[var(--accent-red)]/50",
};

// 44px minimum touch target below the `sm` breakpoint.
const sizeClasses: Record<ButtonSize, string> = {
  md: "min-h-11 px-4 py-2 sm:min-h-0",
  sm: "min-h-11 px-3 py-1.5 text-xs sm:min-h-0",
  icon: "min-h-11 min-w-11 p-2 sm:min-h-0 sm:min-w-0",
};

export function BaseButton({
  variant = "primary",
  size = "md",
  type = "button",
  className = "",
  children,
  ...rest
}: BaseButtonProps) {
  return (
    <button
      {...rest}
      type={type}
      className={[
        "inline-flex items-center justify-center rounded-md",
        "text-sm font-medium",
        "transition-colors duration-150",
        "focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-2",
        "disabled:cursor-not-allowed disabled:opacity-60",
        sizeClasses[size],
        variantClasses[variant],
        className,
      ]
        .filter(Boolean)
        .join(" ")}
    >
      {children}
    </button>
  );
}
