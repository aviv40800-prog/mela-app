"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Eye, EyeOff, Loader2, Lock, User } from "lucide-react";
import { api, ApiError, haptic } from "@/lib/client";

/** Sign in with a username (or email) and password. A forgotten password is reset with an emailed code. */
export function LoginForm() {
  const router = useRouter();
  const params = useSearchParams();
  const [identifier, setIdentifier] = useState("");
  const [password, setPassword] = useState("");
  const [show, setShow] = useState(false);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<{ text: string; code?: string } | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setErr(null);
    try {
      const r = await api<{ next: string }>("/api/auth/login", { method: "POST", json: { identifier: identifier.trim(), password } });
      haptic([10, 40, 20]);
      const wanted = params.get("next");
      router.replace(wanted && wanted.startsWith("/") && !wanted.startsWith("//") && r.next === "/discover" ? wanted : r.next);
      router.refresh();
    } catch (e) {
      setErr({ text: (e as Error).message, code: e instanceof ApiError ? e.code : undefined });
      haptic([30, 40, 30]);
      setBusy(false);
    }
  }

  const forgotHref = `/login/forgot${identifier.includes("@") ? `?email=${encodeURIComponent(identifier.trim())}` : ""}`;

  return (
    <form onSubmit={submit} className="flex flex-1 flex-col">
      <p className="eyebrow text-center">כניסה לחשבון</p>
      <h1 className="font-display mt-10 text-[2.1rem] leading-tight font-bold">ברוך/ה השב/ה</h1>
      <p className="mt-2 text-[15px] text-mute">נכנסים עם שם המשתמש (או האימייל) והסיסמה.</p>

      <label className="mt-8 block">
        <span className="label px-1">שם משתמש או אימייל</span>
        <span className="field flex items-center gap-3 !py-0" dir="ltr">
          <User size={19} className="shrink-0 text-mute" />
          <input
            id="identifier"
            value={identifier}
            onChange={(e) => setIdentifier(e.target.value.replace(/\s/g, ""))}
            autoComplete="username"
            autoCapitalize="none"
            spellCheck={false}
            className="h-[56px] min-w-0 flex-1 bg-transparent text-[17px] outline-none"
            autoFocus
          />
        </span>
      </label>
      <label className="mt-4 block">
        <span className="label px-1">סיסמה</span>
        <span className="field flex items-center gap-3 !py-0" dir="ltr">
          <Lock size={19} className="shrink-0 text-mute" />
          <input
            id="password"
            type={show ? "text" : "password"}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            autoComplete="current-password"
            className="h-[56px] min-w-0 flex-1 bg-transparent text-[17px] outline-none"
          />
          <button type="button" onClick={() => setShow((s) => !s)} className="shrink-0 text-mute hover:text-cream" aria-label={show ? "הסתרת הסיסמה" : "הצגת הסיסמה"}>
            {show ? <EyeOff size={18} /> : <Eye size={18} />}
          </button>
        </span>
      </label>
      <Link href={forgotHref} className="mt-3 w-fit text-sm text-gold-2 underline-offset-4 hover:underline">
        שכחתי סיסמה
      </Link>

      {err && (
        <div className="mt-4 text-sm text-danger">
          {err.text}
          {(err.code === "no_password" || err.code === "locked") && (
            <Link href={forgotHref} className="mt-2 block font-semibold text-gold-2 underline underline-offset-4">
              {err.code === "no_password" ? "שלחו לי קוד ליצירת סיסמה" : "איפוס סיסמה עם קוד במייל"}
            </Link>
          )}
        </div>
      )}

      <div className="mt-auto pt-10">
        <button className="btn-gold w-full text-[17px]" disabled={busy || !identifier.trim() || !password}>
          {busy ? <Loader2 className="animate-spin" size={18} /> : "כניסה"}
        </button>
        <p className="mt-5 text-center text-sm text-mute">
          חדשים ב־MELA?{" "}
          <Link href="/signup" className="font-semibold text-gold-2 underline-offset-4 hover:underline">
            הרשמה חינם
          </Link>
        </p>
      </div>
    </form>
  );
}
