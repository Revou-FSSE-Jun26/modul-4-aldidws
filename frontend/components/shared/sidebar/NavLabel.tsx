
interface NavLabelProps {
  collapsed: boolean;
  children: string;
}

/**
 * Animated navigation label.
 */
export function NavLabel({ collapsed, children }: NavLabelProps) {
  return (
    <span
      aria-hidden={collapsed}
      className={[
        "block truncate text-sm transition-[opacity,max-width] duration-150",
        collapsed
          ? "pointer-events-none max-w-0 overflow-hidden opacity-0"
          : "max-w-[160px] opacity-100",
      ].join(" ")}
    >
      {children}
    </span>
  );
}
