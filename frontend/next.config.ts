import type { NextConfig } from "next";

// NEXT_PUBLIC_* values are inlined at build time. An empty value would make the
// browser call the Vercel domain itself (relative URLs), so fail the Vercel
// build instead of shipping a broken app. Request paths already start with
// /api, so the value must be the backend origin only.
if (process.env.VERCEL === "1") {
  const apiBase = process.env.NEXT_PUBLIC_API_BASE_URL ?? "";
  if (!/^https:\/\/[^/]+$/.test(apiBase)) {
    throw new Error(
      "NEXT_PUBLIC_API_BASE_URL must be set to the backend origin, e.g. " +
        "https://<service>.up.railway.app (https, no trailing slash, no /api).",
    );
  }
}

const nextConfig: NextConfig = {
  /* config options here */
  // cacheComponents and partialPrefetching are experimental Next.js 16 flags
  // that conflict with the `dynamic` route segment config used on cookie-reading
  // Server Component pages. Disabled so standard Next.js dynamic rendering works.
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
};

export default nextConfig;
