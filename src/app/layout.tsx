import type { Metadata, Viewport } from "next";
import "@fontsource-variable/heebo";
import "@fontsource-variable/frank-ruhl-libre";
import "./globals.css";
import { MotionProvider } from "@/components/MotionProvider";

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || process.env.SITE_URL || "https://mela-production-e3fb.up.railway.app";
const DESCRIPTION = "אפליקציית ההיכרויות לצעירים וצעירות מהקהילה האתיופית־ישראלית שמחפשים קשר אמיתי — עם מישהו שמבין מאיפה הם באים.";

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: { default: "MELA — אהבה עם שורשים", template: "%s · MELA" },
  description: DESCRIPTION,
  applicationName: "MELA",
  keywords: ["היכרויות", "אתיופים", "יוצאי אתיופיה", "אפליקציית היכרויות", "MELA", "בני העדה", "זוגיות"],
  openGraph: {
    type: "website",
    locale: "he_IL",
    siteName: "MELA",
    title: "MELA — אהבה עם שורשים",
    description: DESCRIPTION,
    url: "/",
  },
  twitter: { card: "summary_large_image", title: "MELA — אהבה עם שורשים", description: DESCRIPTION },
  alternates: { canonical: "/" },
  appleWebApp: { capable: true, statusBarStyle: "default", title: "MELA" },
};

export const viewport: Viewport = {
  themeColor: "#faf6ef",
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="he" dir="rtl" data-scroll-behavior="smooth">
      <body className="font-sans">
        <MotionProvider>
          {children}
        </MotionProvider>
      </body>
    </html>
  );
}
