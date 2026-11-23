"use client";

import { type ButtonHTMLAttributes, type ReactNode } from "react";

type ButtonVariant = "primary" | "secondary" | "danger" | "destructive";

interface BaseButtonProps {
  variant?: ButtonVariant;
  type?: ButtonHTMLAttributes<HTMLButtonElement>["type"];
  disabled?: boolean;
  onClick?: () => void;
  children: ReactNode;
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

export function BaseButton({
  variant = "primary",
  type = "button",
  disabled = false,
  onClick,
  children,
}: BaseButtonProps) {
  return (
    <button
      type={type}
      disabled={disabled}
      onClick={onClick}
      className={[
        "inline-flex items-center justify-center rounded-md px-4 py-2",
        "text-sm font-medium",
        "transition-colors duration-150",
        "focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-2",
        "disabled:cursor-not-allowed disabled:opacity-60",
        variantClasses[variant],
      ].join(" ")}
    >
      {children}
    </button>
  );
}
