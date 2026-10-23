import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "standalone",
  // فایل دادهٔ قرآن (۳MB) باید در باندل سرور دیده شود — مخصوصاً روی ورکل
  outputFileTracingIncludes: {
    "/api/quran": ["./data/quran.json"],
    "/api/quran/[surah]": ["./data/quran.json"],
  },
  typescript: {
    ignoreBuildErrors: true,
  },
  reactStrictMode: false,
};

export default nextConfig;
