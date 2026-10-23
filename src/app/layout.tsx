import type { Metadata, Viewport } from "next";
import { Vazirmatn, Amiri_Quran } from "next/font/google";
import "./globals.css";
import { Toaster } from "@/components/ui/toaster";
import { ThemeProvider } from "@/components/theme-provider";
import PwaRegister from "@/components/pwa-register";

const vazir = Vazirmatn({
  variable: "--font-vazir",
  subsets: ["arabic"],
  weight: ["400", "500", "600", "700", "800", "900"],
});

const amiriQuran = Amiri_Quran({
  variable: "--font-amiri-quran",
  subsets: ["arabic"],
  weight: "400",
});

export const metadata: Metadata = {
  title: "حافظ | استودیوی تلاوت با هوش مصنوعی",
  description:
    "پلتفرم تحفیظ قرآن کریم با هوش مصنوعی؛ تلاوت کن، AI گوش می‌دهد، خط به خط دنبال می‌کند و اشکالات را لحظه‌ای گزارش می‌کند. ساخته شده توسط گروه TEKA.",
  keywords: ["قرآن", "حافظ", "تحفیظ", "تلاوت", "هوش مصنوعی", "Quran", "Hafiz", "TEKA"],
  authors: [{ name: "TEKA Group" }],
  manifest: "/manifest.webmanifest",
  applicationName: "حافظ",
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: "حافظ",
  },
  openGraph: {
    title: "حافظ | استودیوی تلاوت با هوش مصنوعی",
    description: "AI گوش می‌دهد و خط به خط تلاوت شما را تصحیح می‌کند.",
    siteName: "Hafez — TEKA",
    type: "website",
  },
};

export const viewport: Viewport = {
  themeColor: "#0c1f1a",
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="fa" dir="rtl" suppressHydrationWarning>
      <body
        className={`${vazir.variable} ${amiriQuran.variable} antialiased bg-background text-foreground min-h-screen flex flex-col`}
      >
        {/* اتصال زودهنگام به CDN صوت قاری (تمرین/آزمون) — موبایل سریع‌تر */}
        <link rel="preconnect" href="https://cdn.islamic.network" crossOrigin="anonymous" />
        <link rel="dns-prefetch" href="https://cdn.islamic.network" />
        <ThemeProvider attribute="class" defaultTheme="dark" enableSystem={false} disableTransitionOnChange>
          {children}
          <PwaRegister />
          <Toaster />
        </ThemeProvider>
      </body>
    </html>
  );
}
