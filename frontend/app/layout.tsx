import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import { Toaster } from "react-hot-toast";
import { AuthProvider } from "@/context/AuthContext";
import { ErrorBoundary } from "@/components/ErrorBoundary";
import { AppShell } from "@/components/shared/AppShell";

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-inter",
});

export const metadata: Metadata = {
  title: "Task Management",
  description: "Organise your work with boards, columns, and cards.",
};

/**
 * Root layout — Server Component.
 *
 * Provider hierarchy (outer → inner):
 *   AuthProvider   — JWT auth state (client island)
 *   ErrorBoundary  — catches unexpected render errors (client island)
 *   {children}     — page content
 *
 * Toaster is mounted once here so toast() calls from anywhere in the app
 * render into a single container.  It is a Client Component but importing it
 * into a Server Component layout is valid Next.js — it renders as a client
 * island without converting the layout itself to a Client Component.
 */
export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html
      lang="en"
      className={`${inter.variable} h-full antialiased`}
      suppressHydrationWarning
    >
      <head>
        {/* No-flash: set data-board-bg on <html> before first paint so the
            correct gradient is applied without a colour flash on load. */}
        <script
          dangerouslySetInnerHTML={{
            __html: `(function(){try{var m=location.pathname.match(/^\\/boards\\/([^\\/]+)/);var v=m?localStorage.getItem('board-bg-'+m[1]):null;if(!v)v=localStorage.getItem('board-bg');if(v)document.documentElement.setAttribute('data-board-bg',v);}catch(e){}})();`,
          }}
        />
      </head>
      <body className="h-full overflow-hidden bg-[var(--bg-page)] font-[var(--font-inter)]">
        <AuthProvider>
          <ErrorBoundary>
            <AppShell>
              {children}
            </AppShell>
          </ErrorBoundary>
        </AuthProvider>

        {/*
          Toaster is rendered outside AuthProvider/ErrorBoundary so that toast
          notifications still appear even if a child component crashes or the
          auth context throws during initialisation.
        */}
        <Toaster
          position="bottom-right"
          toastOptions={{
            duration: 4000,
            style: {
              borderRadius: "8px",
              fontSize: "14px",
            },
          }}
        />
      </body>
    </html>
  );
}
