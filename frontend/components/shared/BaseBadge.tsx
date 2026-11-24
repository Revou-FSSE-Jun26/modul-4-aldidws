"use client";

import { type HTMLAttributes, type ReactNode } from "react";

type BadgeVariant = "default" | "primary" | "success" | "warning" | "danger";

interface BaseBadgeProps extends Omit<HTMLAttributes<HTMLSpanElement>, "className" | "children"> {
  variant?: BadgeVariant;
  children: ReactNode;
  className?: string;
}

const variantClasses: Record<BadgeVariant, string> = {
  default:  "bg-gray-100 text-gray-700",
  primary:  "bg-blue-100 text-blue-700",
  success:  "bg-green-100 text-green-700",
  warning:  "bg-yellow-100 text-yellow-800",
  danger:   "bg-red-100 text-red-700",
};

export function BaseBadge({ variant = "default", children, className = "", ...rest }: BaseBadgeProps) {
  return (
    <span
      {...rest}
      className={[
        "inline-flex items-center rounded-full px-2.5 py-0.5",
        "text-xs font-medium",
        variantClasses[variant],
        className,
      ].filter(Boolean).join(" ")}
    >
      {children}
    </span>
  );
}
