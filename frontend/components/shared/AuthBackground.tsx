/**
 * AuthBackground — full-page wrapper with a soft mint-aqua gradient at the
 * top that fades to white.
 *
 * Usage:
 *   <AuthBackground>
 *     {children}   ← centred content (card, form, etc.)
 *   </AuthBackground>
 *
 * The gradient lives in a ::before pseudo-element (z-index 0, pointer-events
 * none). Children are rendered in a flex column centred both axes at z-index 1.
 * No logic, no state, no imports from app code.
 */
export function AuthBackground({ children }: { children: React.ReactNode }) {
  return (
    <div className="auth-bg">
      {/* gradient drawn by ::before in globals.css */}
      <div
        className="relative z-10 flex min-h-screen w-full flex-col items-center justify-center px-4 py-12"
      >
        {children}
      </div>
    </div>
  );
}
