"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { AnimatePresence, motion, useAnimationControls } from "framer-motion";
import { ArrowRight, Check, Loader2, Mail, ShieldCheck, Smartphone } from "lucide-react";
import { OnboardingProgress } from "@/components/ui/OnboardingProgress";
import { api, haptic, track } from "@/lib/client";
import { normalizeIsraeliPhone } from "@/lib/phone";

const slide = {
  initial: { opacity: 0, x: -40 },
  animate: { opacity: 1, x: 0 },
  exit: { opacity: 0, x: 40 },
  transition: { type: "spring" as const, stiffness: 320, damping: 32 },
};

function formatPhone(raw: string) {
  const d = raw.replace(/\D/g, "").slice(0, 10);
  if (d.length <= 3) return d;
  if (d.length <= 6) return `${d.slice(0, 3)}-${d.slice(3)}`;
  return `${d.slice(0, 3)}-${d.slice(3, 6)}-${d.slice(6)}`;
}

type Mode = "signup" | "reset";

const COPY = {
  signup: {
    title: "מה המייל שלך?",
    sub: "נשלח אליו קוד אימות בן 6 ספרות. המייל נשאר פרטי ולא יוצג לאף אחד.",
    cta: "שלחו לי קוד",
  },
  reset: {
    title: "שכחת סיסמה?",
    sub: "הזינו את המייל שאיתו נרשמתם, ונשלח קוד לבחירת סיסמה חדשה.",
    cta: "שלחו לי קוד",
  },
};
const PHONE_COPY = {
  title: "כניסה עם טלפון",
  sub: "למי שנרשם עם מספר נייד: נשלח קוד ב־SMS.",
  cta: "שלחו קוד כניסה",
};

const emailOk = (e: string) => /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(e.trim());

/**
 * Email code sign-in (free — no SMS), shared by signup and login. Members who registered with a phone
 * number can still sign in with it from the login screen. The server never reveals whether an address is registered.
 */
export function PhoneAuth({ mode }: { mode: Mode }) {
  const router = useRouter();
  const params = useSearchParams();
  const [notice, setNotice] = useState<string | null>(null);
  const [usePhone, setUsePhone] = useState(false);
  const [email, setEmail] = useState(params.get("email") ?? "");
  const [phone, setPhone] = useState("");
  const [sentTo, setSentTo] = useState<string | null>(null);
  const [devCode, setDevCode] = useState<string | null>(null);
  const [digits, setDigits] = useState<string[]>(Array(6).fill(""));
  const [busy, setBusy] = useState(false);
  const [verified, setVerified] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [cooldown, setCooldown] = useState(0);
  const inputs = useRef<(HTMLInputElement | null)[]>([]);
  const shake = useAnimationControls();
  const valid = usePhone ? normalizeIsraeliPhone(phone) !== null : emailOk(email);
  const copy = usePhone ? PHONE_COPY : COPY[mode];

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
      const res = await api<{
        phone?: string;
        email?: string;
        devCode?: string;
      }>("/api/auth/otp/request", {
        method: "POST",
        json: usePhone ? { phone } : { email: email.trim() },
      });
      setSentTo(res.email ?? res.phone ?? null);
      setDevCode(res.devCode ?? null);
      setDigits(Array(6).fill(""));
      setCooldown(30);
      setTimeout(() => inputs.current[0]?.focus(), 350);
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
      const res = await api<{ next: string; isNew: boolean }>("/api/auth/otp/verify", {
        method: "POST",
        json: usePhone ? { phone: sentTo, code, purpose: mode } : { email: sentTo, code, purpose: mode },
      });
      setVerified(true);
      haptic([10, 40, 20]);
      const wanted = params.get("next");
      // Only same-site paths, and only once onboarding is done.
      const dest = wanted && wanted.startsWith("/") && !wanted.startsWith("//") && res.next === "/discover" ? wanted : res.next;
      if (res.isNew) track("sign_up", { method: "email" });
      if (mode === "signup" && !res.isNew) setNotice("כבר יש לך חשבון — מחברים אותך 👋");
      setTimeout(() => router.replace(dest), mode === "signup" && !res.isNew ? 1400 : 650);
    } catch (e) {
      setErr((e as Error).message);
      haptic([30, 40, 30]);
      void shake.start({
        x: [0, -10, 10, -7, 7, -3, 0],
        transition: { duration: 0.45 },
      });
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
      setDigits([...next, ...Array(6 - next.length).fill("")]);
      if (next.length === 6) void verify(next.join(""));
      return;
    }
    const next = [...digits];
    next[i] = clean;
    setDigits(next);
    if (clean) haptic(5);
    if (clean && i < 5) inputs.current[i + 1]?.focus();
    if (next.every(Boolean)) void verify(next.join(""));
  }

  return (
    <div className="flex flex-1 flex-col">
      {mode === "signup" ? <OnboardingProgress step={1} label={sentTo ? "אימות קוד" : "אימייל"} /> : <p className="eyebrow text-center">איפוס סיסמה</p>}

      <AnimatePresence mode="wait" initial={false}>
        {!sentTo ? (
          <motion.form key={usePhone ? "phone" : "email"} {...slide} onSubmit={requestCode} className="mt-10 flex flex-1 flex-col">
            <h1 className="font-display text-[2.1rem] leading-tight font-bold">{copy.title}</h1>
            <p className="mt-2 text-[15px] text-mute">{copy.sub}</p>

            {!usePhone ? (
              <div className="field mt-9 flex items-center gap-3 !py-0" dir="ltr">
                <Mail size={20} className="shrink-0 text-mute" />
                <input
                  id="email"
                  type="email"
                  aria-label="כתובת אימייל"
                  className="h-[58px] min-w-0 flex-1 bg-transparent text-lg outline-none placeholder:text-mute-2"
                  inputMode="email"
                  autoComplete="email"
                  autoCapitalize="none"
                  spellCheck={false}
                  placeholder="name@gmail.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value.replace(/\s/g, ""))}
                  autoFocus
                />
                <AnimatePresence>
                  {valid && (
                    <motion.span
                      initial={{ scale: 0 }}
                      animate={{ scale: 1 }}
                      exit={{ scale: 0 }}
                      className="grid h-6 w-6 shrink-0 place-items-center rounded-full bg-gold text-[#2a1c12]"
                    >
                      <Check size={14} strokeWidth={3} />
                    </motion.span>
                  )}
                </AnimatePresence>
              </div>
            ) : (
              <div className="field mt-9 flex items-center gap-3 !py-0" dir="ltr">
                <span className="flex shrink-0 items-center gap-1.5 border-r border-line-2 py-4 pr-3 text-mute">
                  <span aria-hidden>🇮🇱</span>
                  <span className="tabular">+972</span>
                </span>
                <input
                  id="phone"
                  aria-label="טלפון נייד"
                  className="tabular h-[58px] flex-1 bg-transparent text-xl tracking-wider outline-none placeholder:text-mute-2"
                  inputMode="tel"
                  autoComplete="tel-national"
                  placeholder="050-000-0000"
                  value={phone}
                  onChange={(e) => setPhone(formatPhone(e.target.value))}
                  autoFocus
                />
                <AnimatePresence>
                  {valid && (
                    <motion.span initial={{ scale: 0 }} animate={{ scale: 1 }} exit={{ scale: 0 }} className="grid h-6 w-6 place-items-center rounded-full bg-gold text-[#2a1c12]">
                      <Check size={14} strokeWidth={3} />
                    </motion.span>
                  )}
                </AnimatePresence>
              </div>
            )}
            <AnimatePresence>
              {err && (
                <motion.p initial={{ opacity: 0, y: -4 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} className="mt-3 text-sm text-danger">
                  {err}
                </motion.p>
              )}
            </AnimatePresence>

            <div className="mt-6 flex items-center gap-2 text-xs text-mute">
              <ShieldCheck size={14} className="text-gold" /> {usePhone ? "הכניסה מאובטחת בקוד חד־פעמי" : "כל חבר/ה ב־MELA עובר/ת אימות בקוד חד־פעמי"}
            </div>
            {!usePhone && <p className="mt-2 text-xs text-mute-2">לא רואים את המייל תוך דקה? כדאי לבדוק בתיקיית הספאם / קידומי מכירות.</p>}

            <div className="mt-auto pt-10">
              <button className="btn-gold w-full text-[17px]" disabled={busy || !valid}>
                {busy ? <Loader2 className="animate-spin" size={18} /> : copy.cta}
              </button>
              {mode === "reset" && (
                <button
                  type="button"
                  onClick={() => {
                    setUsePhone((v) => !v);
                    setErr(null);
                  }}
                  className="mx-auto mt-4 flex items-center gap-1.5 text-sm text-mute transition hover:text-gold-2"
                >
                  {usePhone ? <Mail size={15} /> : <Smartphone size={15} />}
                  {usePhone ? "איפוס עם אימייל" : "נרשמתם עם מספר טלפון? איפוס עם טלפון"}
                </button>
              )}
              <p className="mt-5 text-center text-sm text-mute">
                {mode === "signup" ? (
                  <>
                    כבר רשומים?{" "}
                    <Link href="/login" className="font-semibold text-gold-2 underline-offset-4 hover:underline">
                      התחברות
                    </Link>
                  </>
                ) : (
                  <>
                    נזכרת?{" "}
                    <Link href="/login" className="font-semibold text-gold-2 underline-offset-4 hover:underline">
                      חזרה לכניסה
                    </Link>
                  </>
                )}
              </p>
              {mode === "signup" && (
              <p className="mt-4 text-center text-[11px] leading-relaxed text-mute-2">
                בהמשך את/ה מאשר/ת את{" "}
                <a href="/terms" target="_blank" className="underline underline-offset-2 hover:text-cream">
                  התקנון
                </a>{" "}
                ואת{" "}
                <a href="/privacy" target="_blank" className="underline underline-offset-2 hover:text-cream">
                  מדיניות הפרטיות
                </a>
                . הגיל המינימלי הוא 18.
              </p>
              )}
            </div>
          </motion.form>
        ) : (
          <motion.div key="code" {...slide} className="mt-10 flex flex-1 flex-col">
            <button onClick={() => setSentTo(null)} className="mb-6 flex w-fit items-center gap-1 text-sm text-mute transition hover:text-cream">
              <ArrowRight size={16} /> {usePhone ? "שינוי מספר" : "שינוי כתובת"}
            </button>
            <h1 className="font-display text-[2.1rem] leading-tight font-bold">הקלד/י את הקוד</h1>
            <p className="mt-2 text-[15px] text-mute">
              שלחנו קוד בן 6 ספרות ל־
              <span dir="ltr" className="tabular break-all text-cream">
                {sentTo}
              </span>
            </p>
            {devCode && (
              <button
                type="button"
                onClick={() => setDigit(0, devCode)}
                className="mt-5 w-fit rounded-xl border border-dashed border-gold/40 px-3 py-2 text-xs text-gold-2 transition hover:bg-gold/5"
              >
                מצב הדגמה — הקוד שלך:{" "}
                <b dir="ltr" className="tabular">
                  {devCode}
                </b>{" "}
                · הקש/י למילוי
              </button>
            )}

            <motion.div animate={shake} className="mt-9 flex justify-between gap-2" dir="ltr">
              {digits.map((d, i) => (
                <motion.input
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
                  animate={d ? { scale: [1, 1.08, 1] } : { scale: 1 }}
                  transition={{ duration: 0.25 }}
                  className={`field tabular h-[62px] w-full p-0 text-center text-2xl font-semibold ${
                    verified ? "!border-gold !bg-gold/10 text-gold-2" : d ? "!border-gold/50" : ""
                  }`}
                  disabled={busy}
                />
              ))}
            </motion.div>

            <div className="mt-5 flex min-h-6 items-center justify-center">
              <AnimatePresence mode="wait">
                {verified ? (
                  <motion.span
                    key="ok"
                    initial={{ scale: 0.6, opacity: 0 }}
                    animate={{ scale: 1, opacity: 1 }}
                    className="flex items-center gap-1.5 text-center text-sm font-medium text-gold-2"
                  >
                    <Check size={16} className="shrink-0" /> {notice ?? "אומת בהצלחה"}
                  </motion.span>
                ) : busy ? (
                  <Loader2 key="busy" className="animate-spin text-gold" size={20} />
                ) : err ? (
                  <motion.span key="err" initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="text-sm text-danger">
                    {err}
                  </motion.span>
                ) : null}
              </AnimatePresence>
            </div>

            <button onClick={() => requestCode()} disabled={cooldown > 0 || busy} className="tabular mx-auto mt-6 text-sm text-gold transition disabled:text-mute-2">
              {cooldown > 0 ? `שליחה חוזרת בעוד 0:${String(cooldown).padStart(2, "0")}` : "לא קיבלתי — שלחו שוב"}
            </button>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
