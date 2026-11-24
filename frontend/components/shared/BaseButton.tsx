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
    "bg-blue-600 text-white hover:bg-blue-700 focus-visible:ring-blue-500 disabled:bg-blue-300",
  secondary:
    "bg-white text-gray-700 border border-gray-300 hover:bg-gray-50 focus-visible:ring-gray-400 disabled:text-gray-400 disabled:border-gray-200",
  danger:
    "bg-red-600 text-white hover:bg-red-700 focus-visible:ring-red-500 disabled:bg-red-300",
  // `destructive` is the canonical variant name; `danger` is kept as a
  // non-breaking alias mapping to the same classes so existing call sites
  // (e.g. delete buttons) keep working.
  destructive:
    "bg-red-600 text-white hover:bg-red-700 focus-visible:ring-red-500 disabled:bg-red-300",
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
