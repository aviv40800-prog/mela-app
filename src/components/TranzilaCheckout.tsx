"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { AnimatePresence, motion } from "framer-motion";
import { ArrowRight, Check, Loader2, Lock, ShieldCheck } from "lucide-react";
import { api, haptic, track } from "@/lib/client";
import { PLANS, TRIAL_DAYS, TRIAL_FEE, type PlanType } from "@/lib/content";

type Checkout = { orderId: string; action: string; fields: Record<string, string> };

const fmtDate = (d: Date) => d.toLocaleDateString("he-IL", { day: "numeric", month: "long" });

/**
 * Checkout with Tranzila: the card is typed into Tranzila's own page, shown here in an iFrame (the card never
 * touches MELA). Tranzila's notify confirms the order on our server; this page polls the order until then.
 */
export function TranzilaCheckout({ plan, trial }: { plan: PlanType; trial: boolean }) {
  const router = useRouter();
  const p = PLANS[plan];
  const [checkout, setCheckout] = useState<Checkout | null>(null);
  const [stage, setStage] = useState<"summary" | "starting" | "paying" | "done" | "failed">("summary");
  const [err, setErr] = useState<string | null>(null);
  const form = useRef<HTMLFormElement>(null);

  const firstCharge = new Date(Date.now() + (trial ? TRIAL_DAYS * 86_400_000 : 0));
  const every = p.months === 1 ? "כל חודש" : "כל 3 חודשים";

  async function start() {
    setStage("starting");
    setErr(null);
    try {
      setCheckout(await api<Checkout>("/api/billing/checkout", { method: "POST", json: { plan } }));
      track("begin_checkout", { currency: "ILS", value: trial ? TRIAL_FEE : p.price, plan });
      setStage("paying");
    } catch (e) {
      setErr((e as Error).message);
      setStage("summary");
    }
  }

  // open Tranzila's page inside the frame (POST, as Tranzila recommends)
  useEffect(() => {
    if (stage === "paying" && checkout) form.current?.submit();
  }, [stage, checkout]);

  // wait for the server to confirm the order (Tranzila's notify), nudged by the return page inside the frame
  useEffect(() => {
    if (stage !== "paying" || !checkout) return;
    let stopped = false;
    const check = async () => {
      try {
        const o = await api<{ status: string }>(`/api/billing/order/${checkout.orderId}`);
        if (stopped) return;
        if (o.status === "paid") {
          haptic([10, 40, 20]);
          track(trial ? "trial_start" : "purchase", { currency: "ILS", value: trial ? TRIAL_FEE : p.price, plan });
          setStage("done");
          setTimeout(() => {
            router.replace("/discover");
            router.refresh();
          }, 1800);
        } else if (o.status === "failed") setStage("failed");
      } catch {
        /* keep waiting */
      }
    };
    const timer = setInterval(check, 2500);
    const onMessage = (e: MessageEvent) => {
      if (e.origin === window.location.origin && e.data?.mela === "tranzila") {
        if (e.data.result === "fail") setStage("failed");
        else void check();
      }
    };
    window.addEventListener("message", onMessage);
    return () => {
      stopped = true;
      clearInterval(timer);
      window.removeEventListener("message", onMessage);
    };
  }, [stage, checkout, router]);

  return (
    <div className="animate-rise mt-6 flex flex-1 flex-col pb-10">
      <Link href="/onboarding/plan" className="mb-4 flex w-fit items-center gap-1 text-sm text-mute transition hover:text-cream">
        <ArrowRight size={16} /> שינוי מסלול
      </Link>
      <h1 className="font-display text-[1.9rem] leading-tight font-bold">תשלום</h1>
      <p className="mt-1.5 text-[14.5px] text-mute">{trial ? `${TRIAL_DAYS} ימי ניסיון, ביטול בכל רגע מהפרופיל.` : "מתחדש אוטומטית, ביטול בכל רגע מהפרופיל."}</p>

      <div className="surface mt-6 space-y-2 rounded-2xl p-4 text-sm">
        <div className="flex justify-between">
          <span className="text-mute">מסלול</span>
          <span>
            Premium · {p.title} (<span dir="ltr">{p.priceLabel}</span>)
          </span>
        </div>
        <div className="flex justify-between">
          <span className="text-mute">לתשלום היום</span>
          <span className="font-bold text-gold-2" dir="ltr">
            {trial ? `₪${TRIAL_FEE}` : p.priceLabel}
          </span>
        </div>
        {trial && <p className="text-[12px] text-mute-2">חיוב סמלי לאימות הכרטיס.</p>}
        <div className="flex justify-between">
          <span className="text-mute">{trial ? "החל מ־" + fmtDate(firstCharge) : "ואחר כך"}</span>
          <span>
            <span dir="ltr">{p.priceLabel}</span> {every}
          </span>
        </div>
      </div>

      {(stage === "summary" || stage === "starting") && (
        <>
          {err && <p className="mt-4 text-center text-sm text-danger">{err}</p>}
          <button onClick={start} disabled={stage === "starting"} className="btn-gold mt-6 w-full text-[16px]">
            {stage === "starting" ? <Loader2 size={18} className="animate-spin" /> : "המשך לתשלום מאובטח"}
          </button>
          <p className="mt-3 flex items-center justify-center gap-1.5 text-[11px] text-mute-2">
            <Lock size={11} /> פרטי הכרטיס מוקלדים אצל טרנזילה ולא נשמרים אצלנו
          </p>
        </>
      )}

      {stage === "paying" && checkout && (
        <>
          <form ref={form} action={checkout.action} method="POST" target="tranzila-frame" className="hidden">
            {Object.entries(checkout.fields).map(([k, v]) => (
              <input key={k} type="hidden" name={k} value={v} />
            ))}
          </form>
          <iframe name="tranzila-frame" title="תשלום מאובטח" className="mt-5 h-[620px] w-full rounded-2xl border border-line bg-white" allow="payment" />
          <p className="mt-3 flex items-center justify-center gap-1.5 text-[11px] text-mute-2">
            <Lock size={11} /> תשלום מאובטח באמצעות טרנזילה
          </p>
        </>
      )}

      {stage === "failed" && (
        <div className="mt-6 text-center">
          <p className="text-sm text-danger">התשלום לא עבר. אפשר לנסות שוב, או להשתמש בכרטיס אחר.</p>
          <button onClick={start} className="btn-gold mt-4 w-full text-[16px]">
            ניסיון נוסף
          </button>
        </div>
      )}

      <AnimatePresence>
        {stage === "done" && (
          <motion.div className="fixed inset-0 z-50 grid place-items-center bg-ink/92 backdrop-blur-xl" initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
            <div className="text-center">
              <motion.div
                initial={{ scale: 0 }}
                animate={{ scale: [0, 1.2, 1] }}
                transition={{ duration: 0.5 }}
                className="mx-auto grid h-20 w-20 place-items-center rounded-full bg-gradient-to-b from-gold-3 to-gold text-[#2a1c12] shadow-[0_0_50px_rgba(184,137,43,0.6)]"
              >
                <Check size={38} strokeWidth={3} />
              </motion.div>
              <h2 className="font-display mt-6 text-3xl font-bold">ברוכים הבאים ל־Premium</h2>
              <p className="mt-2 flex items-center justify-center gap-1.5 text-sm text-mute">
                <ShieldCheck size={15} className="text-gold" /> {trial ? `${TRIAL_DAYS} ימי הניסיון התחילו עכשיו` : "המנוי פעיל"}
              </p>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
