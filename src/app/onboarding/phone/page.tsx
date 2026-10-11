"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowRight, Loader2, Smartphone } from "lucide-react";
import { Stepper } from "@/components/Stepper";
import { api } from "@/lib/client";

export default function PhonePage() {
  const router = useRouter();
  const [phone, setPhone] = useState("");
  const [sentTo, setSentTo] = useState<string | null>(null);
  const [devCode, setDevCode] = useState<string | null>(null);
  const [digits, setDigits] = useState<string[]>(Array(6).fill(""));
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [cooldown, setCooldown] = useState(0);
  const inputs = useRef<(HTMLInputElement | null)[]>([]);

  useEffect(() => {
    if (cooldown <= 0) return;
    const t = setTimeout(() => setCooldown((c) => c - 1), 1000);
    return () => clearTimeout(t);
  }, [cooldown]);

  async function requestCode(e?: React.FormEvent) {
    e?.preventDefault();
    setBusy(true);
    setErr(null);
    try {
      const res = await api<{ phone: string; devCode?: string }>("/api/auth/otp/request", { method: "POST", json: { phone } });
      setSentTo(res.phone);
      setDevCode(res.devCode ?? null);
      setDigits(Array(6).fill(""));
      setCooldown(30);
      setTimeout(() => inputs.current[0]?.focus(), 50);
    } catch (e) {
      setErr((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  async function verify(code: string) {
    setBusy(true);
    setErr(null);
    try {
      const res = await api<{ next: string }>("/api/auth/otp/verify", { method: "POST", json: { phone: sentTo, code } });
      router.replace(res.next);
    } catch (e) {
      setErr((e as Error).message);
      setDigits(Array(6).fill(""));
      inputs.current[0]?.focus();
      setBusy(false);
    }
  }

  function setDigit(i: number, value: string) {
    const clean = value.replace(/\D/g, "");
    if (clean.length > 1) {
      // Paste / SMS autofill of the full code.
      const next = clean.slice(0, 6).split("");
      const filled = [...next, ...Array(6 - next.length).fill("")];
      setDigits(filled);
      if (next.length === 6) void verify(next.join(""));
      return;
    }
    const next = [...digits];
    next[i] = clean;
    setDigits(next);
    if (clean && i < 5) inputs.current[i + 1]?.focus();
    if (next.every(Boolean)) void verify(next.join(""));
  }

  return (
    <div className="flex flex-1 flex-col">
      <Stepper step={1} />

      {!sentTo ? (
        <form onSubmit={requestCode} className="animate-rise mt-10 flex flex-1 flex-col">
          <div className="glow mb-6 grid h-14 w-14 place-items-center rounded-2xl bg-gold/10 text-gold">
            <Smartphone />
          </div>
          <h1 className="font-display text-3xl font-bold">מה המספר שלך?</h1>
          <p className="mt-2 text-sm text-mute">נשלח קוד אימות ב־SMS. המספר לא יוצג לאף אחד.</p>
          <label className="label mt-8" htmlFor="phone">
            טלפון נייד
          </label>
          <div className="flex gap-2" dir="ltr">
            <span className="field w-auto shrink-0 text-mute">🇮🇱 +972</span>
            <input
              id="phone"
              className="field text-lg tracking-wider"
              inputMode="tel"
              autoComplete="tel-national"
              placeholder="050-000-0000"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              autoFocus
            />
          </div>
          {err && <p className="mt-3 text-sm text-danger">{err}</p>}
          <div className="mt-auto pt-10">
            <button className="btn-gold w-full" disabled={busy || phone.replace(/\D/g, "").length < 9}>
              {busy ? <Loader2 className="animate-spin" size={18} /> : "שלחו לי קוד"}
            </button>
            <p className="mt-4 text-center text-[11px] leading-relaxed text-mute">
              בהמשך את/ה מאשר/ת את תנאי השימוש ומדיניות הפרטיות. הגיל המינימלי הוא 18.
            </p>
          </div>
        </form>
      ) : (
        <div className="animate-rise mt-10 flex flex-1 flex-col">
          <button onClick={() => setSentTo(null)} className="mb-6 flex items-center gap-1 text-sm text-mute">
            <ArrowRight size={16} /> שינוי מספר
          </button>
          <h1 className="font-display text-3xl font-bold">הקלד/י את הקוד</h1>
          <p className="mt-2 text-sm text-mute">
            שלחנו קוד בן 6 ספרות ל־<span dir="ltr">{sentTo}</span>
          </p>
          {devCode && (
            <p className="mt-4 rounded-xl border border-dashed border-gold/40 px-3 py-2 text-xs text-gold-2">
              מצב פיתוח — הקוד שלך: <b dir="ltr">{devCode}</b>
            </p>
          )}
          <div className="mt-8 flex justify-between gap-2" dir="ltr">
            {digits.map((d, i) => (
              <input
                key={i}
                ref={(el) => {
                  inputs.current[i] = el;
                }}
                value={d}
                onChange={(e) => setDigit(i, e.target.value)}
                onKeyDown={(e) => e.key === "Backspace" && !d && i > 0 && inputs.current[i - 1]?.focus()}
                inputMode="numeric"
                autoComplete={i === 0 ? "one-time-code" : "off"}
                aria-label={`ספרה ${i + 1}`}
                className={`field h-14 w-12 p-0 text-center text-2xl font-semibold ${d ? "border-gold/60" : ""}`}
                disabled={busy}
              />
            ))}
          </div>
          {err && <p className="mt-4 text-sm text-danger">{err}</p>}
          {busy && <Loader2 className="mx-auto mt-6 animate-spin text-gold" />}
          <button onClick={() => requestCode()} disabled={cooldown > 0 || busy} className="mt-8 text-sm text-gold disabled:text-mute">
            {cooldown > 0 ? `שליחה חוזרת בעוד ${cooldown} שניות` : "לא קיבלתי — שלחו שוב"}
          </button>
        </div>
      )}
    </div>
  );
}
