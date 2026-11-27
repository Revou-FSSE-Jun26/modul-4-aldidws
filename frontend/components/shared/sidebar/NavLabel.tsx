interface NavLabelProps {
  collapsed: boolean;
  children: string;
}

/**
 * Animated label that fades out before the sidebar narrows and fades in after.
 */
export function NavLabel({ collapsed, children }: NavLabelProps) {
  return (
    <span
      aria-hidden={collapsed}
      className={[
        "ml-2.5 truncate text-sm transition-[opacity,max-width] duration-150",
        collapsed ? "max-w-0 overflow-hidden opacity-0" : "max-w-[160px] opacity-100",
      ].join(" ")}
    >
      {children}
    </span>
  );
}
