"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { AnimatePresence, motion } from "framer-motion";
import { ArrowRight, Check, Info, Loader2, Lock, ShieldCheck } from "lucide-react";
import { api, haptic } from "@/lib/client";
import { PLANS, TRIAL_DAYS, type PlanType } from "@/lib/content";

type Brand = "visa" | "mastercard" | "amex" | "isracard" | "diners" | "card";

function brandOf(digits: string): Brand {
  if (/^4/.test(digits)) return "visa";
  if (/^(5[1-5]|2[2-7])/.test(digits)) return "mastercard";
  if (/^3[47]/.test(digits)) return "amex";
  if (/^3(0|6|8)/.test(digits)) return "diners";
  if (digits.length >= 8 && digits.length <= 9) return "isracard";
  return "card";
}
const BRAND_LABEL: Record<Brand, string> = { visa: "VISA", mastercard: "Mastercard", amex: "AMEX", isracard: "ישראכרט", diners: "Diners", card: "" };

function formatNumber(raw: string) {
  const d = raw.replace(/\D/g, "").slice(0, 19);
  if (/^3[47]/.test(d)) return [d.slice(0, 4), d.slice(4, 10), d.slice(10, 15)].filter(Boolean).join(" ");
  return d.replace(/(\d{4})(?=\d)/g, "$1 ");
}
function formatExp(raw: string) {
  const d = raw.replace(/\D/g, "").slice(0, 4);
  return d.length > 2 ? `${d.slice(0, 2)}/${d.slice(2)}` : d;
}
function expValid(exp: string) {
  const m = /^(0[1-9]|1[0-2])\/(\d{2})$/.exec(exp);
  if (!m) return false;
  const end = new Date(2000 + Number(m[2]), Number(m[1]), 1); // first day of the month after expiry
  return end > new Date();
}

/**
 * Checkout. Mock billing: any well-formed card is accepted and nothing is charged. Only brand, last 4 and
 * expiry are sent to the server — the full number and CVV never leave this page. With Tranzila, these
 * inputs are replaced by its hosted fields and the server receives a token.
 */
export function CheckoutForm({ plan, trial, demo, holderDefault }: { plan: PlanType; trial: boolean; demo: boolean; holderDefault: string }) {
  const router = useRouter();
  const p = PLANS[plan];
  const [holder, setHolder] = useState(holderDefault);
  const [number, setNumber] = useState("");
  const [exp, setExp] = useState("");
  const [cvv, setCvv] = useState("");
  const [flip, setFlip] = useState(false);
  const [touched, setTouched] = useState(false);
  const [stage, setStage] = useState<"form" | "processing" | "done">("form");
  const [err, setErr] = useState<string | null>(null);

  const digits = number.replace(/\D/g, "");
  const brand = brandOf(digits);
  const errors = {
    holder: holder.trim().length < 2 ? "שם בעל/ת הכרטיס" : null,
    number: digits.length < 8 ? "מספר כרטיס לא מלא" : null,
    exp: !expValid(exp) ? "תוקף לא תקין" : null,
    cvv: !/^\d{3,4}$/.test(cvv) ? "3–4 ספרות" : null,
  };
  const valid = Object.values(errors).every((e) => !e);

  const chargeDate = new Date(Date.now() + TRIAL_DAYS * 86_400_000).toLocaleDateString("he-IL", { day: "numeric", month: "long" });

  async function pay() {
    setTouched(true);
    if (!valid) {
      haptic([20, 40, 20]);
      return;
    }
    setStage("processing");
    setErr(null);
    try {
      await new Promise((r) => setTimeout(r, 1200)); // the PSP round-trip, felt
      await api("/api/subscription", { method: "POST", json: { plan, card: { brand, last4: digits.slice(-4), exp } } });
      haptic([10, 40, 20]);
      setStage("done");
      setTimeout(() => {
        router.replace("/discover");
        router.refresh();
      }, 1600);
    } catch (e) {
      setErr((e as Error).message);
      setStage("form");
    }
  }

  const masked = (digits.padEnd(16, "•").match(/.{1,4}/g) ?? []).join(" ");

  return (
    <div className="animate-rise mt-6 flex flex-1 flex-col pb-40">
      <Link href="/onboarding/plan" className="mb-4 flex w-fit items-center gap-1 text-sm text-mute transition hover:text-cream">
        <ArrowRight size={16} /> שינוי מסלול
      </Link>
      <h1 className="font-display text-[1.9rem] leading-tight font-bold">פרטי תשלום</h1>
      <p className="mt-1.5 text-[14.5px] text-mute">{trial ? `${TRIAL_DAYS} ימים חינם, ביטול בכל רגע מהפרופיל.` : "חידוש מנוי Premium."}</p>

      {demo && (
        <div className="mt-5 flex items-start gap-2 rounded-2xl border border-dashed border-gold/40 bg-gold/[0.05] px-4 py-3 text-[12.5px] text-gold-2">
          <Info size={15} className="mt-0.5 shrink-0" />
          מצב הדגמה: אפשר להקליד כל מספר כרטיס — לא מתבצע חיוב אמיתי.
        </div>
      )}

      {/* card preview */}
      <div className="mt-6 [perspective:1200px]">
        <motion.div animate={{ rotateY: flip ? 180 : 0 }} transition={{ type: "spring", stiffness: 140, damping: 18 }} className="relative h-48 [transform-style:preserve-3d]" dir="ltr">
          <div className="leather on-dark absolute inset-0 overflow-hidden rounded-[22px] border border-gold/30 p-5 shadow-[0_30px_60px_-30px_rgba(180,87,58,0.5)] [backface-visibility:hidden]">
            <div className="flex items-start justify-between">
              <span className="font-display emboss text-lg font-bold tracking-[0.3em]">MELA</span>
              <span className="text-sm font-bold text-cream/90">{BRAND_LABEL[brand]}</span>
            </div>
            <div className="mt-6 h-8 w-11 rounded-md bg-gradient-to-br from-gold-3 to-gold-dim opacity-80" />
            <div className="tabular mt-4 text-[1.2rem] tracking-[0.12em] text-cream">{masked}</div>
            <div className="mt-3 flex justify-between text-[11px] text-cream/70">
              <span className="truncate uppercase">{holder || "CARD HOLDER"}</span>
              <span className="tabular">{exp || "MM/YY"}</span>
            </div>
          </div>
          <div className="leather on-dark absolute inset-0 overflow-hidden rounded-[22px] border border-gold/30 [backface-visibility:hidden] [transform:rotateY(180deg)]">
            <div className="mt-6 h-10 bg-black/70" />
            <div className="mx-5 mt-5 flex items-center justify-end rounded-md bg-cream/90 px-3 py-2">
              <span className="tabular font-semibold text-[#2e1d12]">{cvv.replace(/./g, "•") || "CVV"}</span>
            </div>
          </div>
        </motion.div>
      </div>

      {/* fields */}
      <div className="mt-6 space-y-3">
        <Field label="שם בעל/ת הכרטיס" error={touched && errors.holder}>
          <input value={holder} onChange={(e) => setHolder(e.target.value)} autoComplete="cc-name" className="w-full bg-transparent text-[16px] outline-none" />
        </Field>
        <Field label="מספר כרטיס" error={touched && errors.number}>
          <input
            value={number}
            onChange={(e) => setNumber(formatNumber(e.target.value))}
            inputMode="numeric"
            autoComplete="cc-number"
            dir="ltr"
            placeholder="0000 0000 0000 0000"
            className="tabular w-full bg-transparent text-[16px] tracking-wider outline-none placeholder:text-mute-2"
          />
        </Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="תוקף" error={touched && errors.exp}>
            <input value={exp} onChange={(e) => setExp(formatExp(e.target.value))} inputMode="numeric" autoComplete="cc-exp" dir="ltr" placeholder="MM/YY" className="tabular w-full bg-transparent text-[16px] outline-none placeholder:text-mute-2" />
          </Field>
          <Field label="CVV" error={touched && errors.cvv}>
            <input
              value={cvv}
              onChange={(e) => setCvv(e.target.value.replace(/\D/g, "").slice(0, 4))}
              onFocus={() => setFlip(true)}
              onBlur={() => setFlip(false)}
              inputMode="numeric"
              autoComplete="cc-csc"
              dir="ltr"
              placeholder="•••"
              className="tabular w-full bg-transparent text-[16px] outline-none placeholder:text-mute-2"
            />
          </Field>
        </div>
      </div>

      {/* summary */}
      <div className="surface mt-6 space-y-2 rounded-2xl p-4 text-sm">
        <div className="flex justify-between">
          <span className="text-mute">מסלול</span>
          <span>
            Premium · {p.title} (<span dir="ltr">{p.priceLabel}</span>)
          </span>
        </div>
        {trial ? (
          <>
            <div className="flex justify-between">
              <span className="text-mute">לתשלום היום</span>
              <span className="font-bold text-gold-2">₪0.00</span>
            </div>
            <div className="flex justify-between">
              <span className="text-mute">החיוב הראשון</span>
              <span>
                {chargeDate} · <span dir="ltr">{p.priceLabel}</span>
              </span>
            </div>
          </>
        ) : (
          <div className="flex justify-between">
            <span className="text-mute">לתשלום היום</span>
            <span className="font-bold text-gold-2" dir="ltr">
              {p.priceLabel}
            </span>
          </div>
        )}
      </div>

      <div className="fixed inset-x-0 bottom-0 z-30 mx-auto max-w-md bg-gradient-to-t from-ink via-ink/95 to-transparent px-6 pt-8 safe-bottom">
        {err && <p className="mb-2 text-center text-sm text-danger">{err}</p>}
        <button onClick={pay} disabled={stage !== "form"} className="btn-gold w-full text-[16px]">
          {stage === "processing" ? (
            <>
              <Loader2 size={18} className="animate-spin" /> מאמת את הכרטיס…
            </>
          ) : trial ? (
            `התחלת ${TRIAL_DAYS} ימי ניסיון חינם`
          ) : (
            "אישור ותשלום"
          )}
        </button>
        <p className="mt-3 flex items-center justify-center gap-1.5 text-[11px] text-mute-2">
          <Lock size={11} /> החיבור מוצפן · פרטי הכרטיס לא נשמרים אצלנו
        </p>
      </div>

      <AnimatePresence>
        {stage === "done" && (
          <motion.div className="fixed inset-0 z-50 grid place-items-center bg-ink/92 backdrop-blur-xl" initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
            <div className="text-center">
              <motion.div
                initial={{ scale: 0 }}
                animate={{ scale: [0, 1.2, 1] }}
                transition={{ duration: 0.5 }}
                className="mx-auto grid h-20 w-20 place-items-center rounded-full bg-gradient-to-b from-gold-3 to-gold text-ink shadow-[0_0_50px_rgba(180,87,58,0.6)]"
              >
                <Check size={38} strokeWidth={3} />
              </motion.div>
              <h2 className="font-display mt-6 text-3xl font-bold">ברוכים הבאים ל־Premium</h2>
              <p className="mt-2 flex items-center justify-center gap-1.5 text-sm text-mute">
                <ShieldCheck size={15} className="text-gold" /> {trial ? `${TRIAL_DAYS} ימים חינם התחילו עכשיו` : "המנוי חודש"}
              </p>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

function Field({ label, error, children }: { label: string; error?: string | false | null; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="label px-1">{label}</span>
      <span className={`field block !py-3.5 ${error ? "!border-danger/60" : ""}`}>{children}</span>
      {error && <span className="mt-1 block px-1 text-[11.5px] text-danger">{error}</span>}
    </label>
  );
}
