"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Check, Eye, EyeOff, Loader2, Lock, User } from "lucide-react";
import { OnboardingProgress } from "@/components/ui/OnboardingProgress";
import { api, haptic } from "@/lib/client";

// New and earlier members see the same screen.
const SETUP = { title: "בחירת שם משתמש וסיסמה", sub: "כדי להיכנס בקלות בפעם הבאה, בלי לחכות לקוד במייל.", cta: "שמירה והמשך" };
const COPY = {
  new: SETUP,
  existing: SETUP,
  reset: { title: "סיסמה חדשה", sub: "בחר/י סיסמה חדשה לחשבון.", cta: "שמירת הסיסמה" },
};

const USERNAME_RE = /^[A-Za-z][A-Za-z0-9._]{2,19}$/;

export function AccountSetup({ mode, currentUsername, suggested }: { mode: "new" | "existing" | "reset"; currentUsername: string | null; suggested: string }) {
  const router = useRouter();
  const copy = COPY[mode];
  const [username, setUsername] = useState(suggested);
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [show, setShow] = useState(false);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [nameState, setNameState] = useState<{ ok: boolean; error?: string } | null>(null);

  // check the username as it's typed (debounced)
  useEffect(() => {
    if (username === currentUsername) return setNameState({ ok: true });
    if (!USERNAME_RE.test(username)) return setNameState(username ? { ok: false, error: "3–20 תווים באנגלית, ספרות, נקודה או קו תחתון, שמתחיל באות" } : null);
    const t = setTimeout(() => {
      api<{ ok: boolean; error?: string }>(`/api/auth/password?username=${encodeURIComponent(username)}`)
        .then(setNameState)
        .catch(() => setNameState(null));
    }, 350);
    return () => clearTimeout(t);
  }, [username, currentUsername]);

  const pwProblem =
    password.length === 0 ? null : password.length < 8 ? "לפחות 8 תווים" : !/[A-Za-z֐-׿]/.test(password) || !/\d/.test(password) ? "גם אותיות וגם ספרות" : null;
  const valid = !!nameState?.ok && password.length >= 8 && !pwProblem && confirm === password;

  async function save(e: React.FormEvent) {
    e.preventDefault();
    if (!valid) return;
    setBusy(true);
    setErr(null);
    try {
      const r = await api<{ next: string }>("/api/auth/password", { method: "POST", json: { username, password } });
      haptic([10, 40, 20]);
      router.replace(r.next);
      router.refresh();
    } catch (e) {
      setErr((e as Error).message);
      setBusy(false);
    }
  }

  return (
    <form onSubmit={save} className="flex flex-1 flex-col">
      {mode === "new" && <OnboardingProgress step={2} label="שם משתמש וסיסמה" />}
      <h1 className="font-display mt-8 text-[2.1rem] leading-tight font-bold">{copy.title}</h1>
      <p className="mt-2 text-[15px] text-mute">{copy.sub}</p>

      <label className="mt-8 block">
        <span className="label px-1">שם משתמש</span>
        <span className="field flex items-center gap-3 !py-0" dir="ltr">
          <User size={19} className="shrink-0 text-mute" />
          <input
            id="username"
            value={username}
            onChange={(e) => setUsername(e.target.value.replace(/\s/g, ""))}
            autoComplete="username"
            autoCapitalize="none"
            spellCheck={false}
            maxLength={20}
            className="h-[54px] min-w-0 flex-1 bg-transparent text-[17px] outline-none"
          />
          {nameState?.ok && <Check size={17} className="shrink-0 text-gold" />}
        </span>
        {nameState && !nameState.ok && <span className="mt-1 block px-1 text-[12px] text-danger">{nameState.error}</span>}
      </label>

      <label className="mt-4 block">
        <span className="label px-1">סיסמה</span>
        <span className="field flex items-center gap-3 !py-0" dir="ltr">
          <Lock size={19} className="shrink-0 text-mute" />
          <input
            id="new-password"
            type={show ? "text" : "password"}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            autoComplete="new-password"
            className="h-[54px] min-w-0 flex-1 bg-transparent text-[17px] outline-none"
          />
          <button type="button" onClick={() => setShow((s) => !s)} className="shrink-0 text-mute hover:text-cream" aria-label={show ? "הסתרת הסיסמה" : "הצגת הסיסמה"}>
            {show ? <EyeOff size={18} /> : <Eye size={18} />}
          </button>
        </span>
        <span className={`mt-1 block px-1 text-[12px] ${pwProblem ? "text-danger" : "text-mute-2"}`}>{pwProblem ?? "לפחות 8 תווים, עם אותיות וספרות"}</span>
      </label>

      <label className="mt-3 block">
        <span className="label px-1">אימות סיסמה</span>
        <span className="field flex items-center gap-3 !py-0" dir="ltr">
          <Lock size={19} className="shrink-0 text-mute" />
          <input
            id="confirm-password"
            type={show ? "text" : "password"}
            value={confirm}
            onChange={(e) => setConfirm(e.target.value)}
            autoComplete="new-password"
            className="h-[54px] min-w-0 flex-1 bg-transparent text-[17px] outline-none"
          />
        </span>
        {confirm && confirm !== password && <span className="mt-1 block px-1 text-[12px] text-danger">הסיסמאות לא זהות</span>}
      </label>

      {err && <p className="mt-4 text-sm text-danger">{err}</p>}
      <div className="mt-auto pt-10">
        <button className="btn-gold w-full text-[17px]" disabled={busy || !valid}>
          {busy ? <Loader2 className="animate-spin" size={18} /> : copy.cta}
        </button>
      </div>
    </form>
  );
}
