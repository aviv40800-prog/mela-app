"use client";

import { useEffect, useState } from "react";
import { ExternalLink } from "lucide-react";

// Instagram / Facebook / TikTok / Snapchat in-app browsers: leaving them for the mail app often loses the page.
const IN_APP = /Instagram|FBAN|FBAV|FB_IAB|FBIOS|TikTok|musical_ly|Bytedance|Snapchat|Line\//i;

/** A gentle tip to continue in the phone's real browser, shown only inside social-app browsers. */
export function InAppBrowserHint() {
  const [show, setShow] = useState(false);
  useEffect(() => {
    setShow(IN_APP.test(navigator.userAgent));
  }, []);
  if (!show) return null;
  return (
    <div className="mt-5 flex items-start gap-2.5 rounded-2xl border border-gold/30 bg-gold/[0.07] px-3.5 py-3 text-[13px] leading-relaxed text-cream/90">
      <ExternalLink size={16} className="mt-0.5 shrink-0 text-gold" />
      <span>
        לחוויה הכי טובה: לחצו על <b className="text-gold-3">⋯</b> למעלה ← <b className="text-gold-3">״פתח בדפדפן״</b>. ככה הדף לא ייסגר כשתעברו למייל לקחת את הקוד.
      </span>
    </div>
  );
}
