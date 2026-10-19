"use client";

import { useEffect } from "react";
import Script from "next/script";
import { usePathname } from "next/navigation";

/** Google Analytics 4 (anonymous, aggregate site statistics). Off for the admin area. NEXT_PUBLIC_GA_ID overrides the id; "off" disables. */
export const GA_ID = process.env.NEXT_PUBLIC_GA_ID ?? "G-31H7WGLL2C";
const enabled = !!GA_ID && GA_ID !== "off";

export function Analytics() {
  const path = usePathname();
  // never measure the admin dashboard (GA honours this flag at any time)
  useEffect(() => {
    if (enabled) (window as unknown as Record<string, boolean>)[`ga-disable-${GA_ID}`] = path.startsWith("/admin");
  }, [path]);
  if (!enabled) return null;
  return (
    <>
      <Script src={`https://www.googletagmanager.com/gtag/js?id=${GA_ID}`} strategy="afterInteractive" />
      <Script id="ga-init" strategy="afterInteractive">
        {`window.dataLayer=window.dataLayer||[];function gtag(){dataLayer.push(arguments)}window.gtag=gtag;gtag('js',new Date());
if(location.pathname.startsWith('/admin'))window['ga-disable-${GA_ID}']=true;
gtag('config','${GA_ID}',{allow_google_signals:false,allow_ad_personalization_signals:false});`}
      </Script>
    </>
  );
}
