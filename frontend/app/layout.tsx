import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { Toaster } from "react-hot-toast";
import { AuthProvider } from "@/context/AuthContext";
import { ErrorBoundary } from "@/components/ErrorBoundary";
import { Header } from "@/components/shared/Header";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
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
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">
        <AuthProvider>
          <Header />
          <ErrorBoundary>
            {children}
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
