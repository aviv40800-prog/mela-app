import type { Metadata, Viewport } from "next";
import "@fontsource-variable/heebo";
import "@fontsource-variable/frank-ruhl-libre";
import "./globals.css";
import { MotionProvider } from "@/components/MotionProvider";

export const metadata: Metadata = {
  title: "MELA — אהבה עם שורשים",
  description: "אפליקציית ההיכרויות לצעירים וצעירות מהקהילה האתיופית־ישראלית שמחפשים קשר אמיתי.",
  appleWebApp: { capable: true, statusBarStyle: "black-translucent", title: "MELA" },
};

export const viewport: Viewport = {
  themeColor: "#0d0d0f",
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="he" dir="rtl">
      <body className="font-sans">
        <MotionProvider>
          <div className="mx-auto min-h-dvh w-full max-w-md">{children}</div>
        </MotionProvider>
      </body>
    </html>
  );
}
