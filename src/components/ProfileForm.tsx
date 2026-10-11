"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Camera, Loader2, Plus, X } from "lucide-react";
import { api } from "@/lib/client";
import { CULTURAL_PROMPTS, LOCATIONS } from "@/lib/content";
import type { Prompt } from "@/lib/types";

type Form = {
  full_name: string;
  email: string;
  age?: number;
  gender?: "male" | "female";
  seeking: "male" | "female" | "everyone";
  location: string;
  occupation: string;
  bio: string;
  photos: string[];
  prompts: Prompt[];
};

export function ProfileForm({ initial, editing }: { initial: Form; editing: boolean }) {
  const router = useRouter();
  const [f, setF] = useState<Form>(() => ({
    ...initial,
    prompts: initial.prompts.length ? initial.prompts : [{ question_key: "buna", answer_text: "" }, { question_key: "family_value", answer_text: "" }],
  }));
  const [uploading, setUploading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const set = <K extends keyof Form>(k: K, v: Form[K]) => setF((s) => ({ ...s, [k]: v }));

  async function upload(files: FileList | null) {
    if (!files?.length) return;
    setUploading(true);
    setErr(null);
    try {
      for (const file of Array.from(files).slice(0, 6 - f.photos.length)) {
        const body = new FormData();
        body.append("file", file);
        const { url } = await api<{ url: string }>("/api/photos", { method: "POST", body });
        setF((s) => ({ ...s, photos: [...s.photos, url] }));
      }
    } catch (e) {
      setErr((e as Error).message);
    } finally {
      setUploading(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  }

  const usedKeys = new Set(f.prompts.map((p) => p.question_key));
  const ready =
    f.full_name.trim().length >= 2 &&
    !!f.age &&
    f.age >= 18 &&
    !!f.gender &&
    !!f.location &&
    f.occupation.trim().length >= 2 &&
    f.bio.trim().length >= 10 &&
    f.photos.length > 0 &&
    f.prompts.filter((p) => p.answer_text.trim().length >= 2).length >= 2;

  async function save() {
    setSaving(true);
    setErr(null);
    try {
      const res = await api<{ next: string }>("/api/me", {
        method: "PUT",
        json: { ...f, prompts: f.prompts.filter((p) => p.answer_text.trim()) },
      });
      router.replace(editing ? "/profile" : res.next);
      router.refresh();
    } catch (e) {
      setErr((e as Error).message);
      setSaving(false);
    }
  }

  return (
    <div className="mt-8 space-y-8 pb-28">
      {/* Photos */}
      <section>
        <h2 className="mb-1 font-semibold">תמונות</h2>
        <p className="mb-3 text-xs text-mute">לפחות תמונה אחת, עד 6. תמונה ראשונה = תמונת הפרופיל.</p>
        <div className="grid grid-cols-3 gap-2.5">
          {Array.from({ length: 6 }).map((_, i) => {
            const src = f.photos[i];
            return src ? (
              <div key={src} className={`relative aspect-[3/4] overflow-hidden rounded-2xl ${i === 0 ? "glow" : ""}`}>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={src} alt="" className="h-full w-full object-cover" />
                <button
                  onClick={() => set("photos", f.photos.filter((p) => p !== src))}
                  className="absolute top-1.5 left-1.5 grid h-7 w-7 place-items-center rounded-full bg-black/60 backdrop-blur"
                  aria-label="הסרת תמונה"
                >
                  <X size={14} />
                </button>
              </div>
            ) : (
              <button
                key={i}
                onClick={() => fileRef.current?.click()}
                disabled={uploading}
                className="grid aspect-[3/4] place-items-center rounded-2xl border border-dashed border-white/15 bg-white/[0.02] text-mute transition hover:border-gold/50 hover:text-gold"
                aria-label="הוספת תמונה"
              >
                {uploading && i === f.photos.length ? <Loader2 className="animate-spin" /> : i === 0 ? <Camera /> : <Plus />}
              </button>
            );
          })}
        </div>
        <input ref={fileRef} type="file" accept="image/jpeg,image/png,image/webp" multiple hidden onChange={(e) => upload(e.target.files)} />
      </section>

      {/* Basics */}
      <section className="space-y-4">
        <h2 className="font-semibold">הבסיס</h2>
        <div>
          <label className="label">שם מלא</label>
          <input className="field" value={f.full_name} onChange={(e) => set("full_name", e.target.value)} placeholder="איך קוראים לך?" />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="label">גיל</label>
            <input
              className="field"
              inputMode="numeric"
              value={f.age ?? ""}
              onChange={(e) => set("age", Number(e.target.value.replace(/\D/g, "")) || undefined)}
              placeholder="18+"
            />
          </div>
          <div>
            <label className="label">עיר</label>
            <select className="field appearance-none" value={f.location} onChange={(e) => set("location", e.target.value)}>
              <option value="">בחירה</option>
              {LOCATIONS.map((l) => (
                <option key={l}>{l}</option>
              ))}
            </select>
          </div>
        </div>
        <Segmented
          label="אני"
          value={f.gender}
          onChange={(v) => setF((s) => ({ ...s, gender: v, seeking: s.gender ? s.seeking : v === "male" ? "female" : "male" }))}
          options={[
            ["female", "אישה"],
            ["male", "גבר"],
          ]}
        />
        <Segmented
          label="מחפש/ת"
          value={f.seeking}
          onChange={(v) => set("seeking", v)}
          options={[
            ["female", "נשים"],
            ["male", "גברים"],
            ["everyone", "כולם"],
          ]}
        />
        <div>
          <label className="label">עיסוק</label>
          <input className="field" value={f.occupation} onChange={(e) => set("occupation", e.target.value)} placeholder="למשל: מהנדסת, עורך דין, סטודנטית לרפואה" />
        </div>
        <div>
          <label className="label">קצת עליי</label>
          <textarea
            className="field min-h-28 resize-none"
            maxLength={500}
            value={f.bio}
            onChange={(e) => set("bio", e.target.value)}
            placeholder="מה חשוב לך? מה מצחיק אותך? מה את/ה מחפש/ת?"
          />
          <div className="mt-1 text-left text-[11px] text-mute">{f.bio.length}/500</div>
        </div>
        <div>
          <label className="label">אימייל (לא חובה — לקבלות ועדכונים)</label>
          <input className="field" dir="ltr" type="email" value={f.email} onChange={(e) => set("email", e.target.value)} placeholder="you@email.com" />
        </div>
      </section>

      {/* Cultural prompts */}
      <section>
        <h2 className="mb-1 font-semibold">שאלות מהבית</h2>
        <p className="mb-4 text-xs text-mute">בחר/י 2–3 שאלות. כאן מתחילות השיחות הכי טובות.</p>
        <div className="space-y-3">
          {f.prompts.map((p, i) => (
            <div key={i} className="glass rounded-2xl p-4">
              <div className="mb-2 flex items-center gap-2">
                <select
                  className="w-full appearance-none bg-transparent text-sm font-semibold text-gold-2 outline-none"
                  value={p.question_key}
                  onChange={(e) => set("prompts", f.prompts.map((x, j) => (j === i ? { ...x, question_key: e.target.value } : x)))}
                >
                  {CULTURAL_PROMPTS.filter((q) => q.key === p.question_key || !usedKeys.has(q.key)).map((q) => (
                    <option key={q.key} value={q.key} className="bg-ink-2 text-cream">
                      {q.question}
                    </option>
                  ))}
                </select>
                {f.prompts.length > 2 && (
                  <button onClick={() => set("prompts", f.prompts.filter((_, j) => j !== i))} className="text-mute" aria-label="הסרת שאלה">
                    <X size={16} />
                  </button>
                )}
              </div>
              <textarea
                className="w-full resize-none bg-transparent text-[15px] leading-relaxed outline-none placeholder:text-mute/60"
                rows={2}
                maxLength={200}
                value={p.answer_text}
                placeholder="התשובה שלך ✍️"
                onChange={(e) => set("prompts", f.prompts.map((x, j) => (j === i ? { ...x, answer_text: e.target.value } : x)))}
              />
            </div>
          ))}
          {f.prompts.length < 3 && (
            <button
              onClick={() =>
                set("prompts", [...f.prompts, { question_key: CULTURAL_PROMPTS.find((q) => !usedKeys.has(q.key))!.key, answer_text: "" }])
              }
              className="btn-ghost w-full text-sm"
            >
              <Plus size={16} /> הוספת שאלה
            </button>
          )}
        </div>
      </section>

      <div className="fixed inset-x-0 bottom-0 z-30 mx-auto max-w-md bg-gradient-to-t from-ink via-ink/95 to-transparent px-6 pt-8 pb-[max(env(safe-area-inset-bottom),20px)]">
        {err && <p className="mb-2 text-center text-sm text-danger">{err}</p>}
        <button className="btn-gold w-full" disabled={!ready || saving || uploading} onClick={save}>
          {saving ? <Loader2 className="animate-spin" size={18} /> : editing ? "שמירה" : "המשך לבחירת מסלול"}
        </button>
      </div>
    </div>
  );
}

function Segmented<T extends string>({
  label,
  value,
  onChange,
  options,
}: {
  label: string;
  value?: T;
  onChange: (v: T) => void;
  options: [T, string][];
}) {
  return (
    <div>
      <span className="label">{label}</span>
      <div className="flex gap-2 rounded-2xl border border-line bg-white/[0.03] p-1">
        {options.map(([v, text]) => (
          <button
            key={v}
            type="button"
            onClick={() => onChange(v)}
            className={`flex-1 rounded-xl py-2.5 text-sm transition-all ${value === v ? "bg-gold text-ink font-semibold shadow" : "text-mute"}`}
          >
            {text}
          </button>
        ))}
      </div>
    </div>
  );
}
