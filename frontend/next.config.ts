import type { NextConfig } from "next";

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
