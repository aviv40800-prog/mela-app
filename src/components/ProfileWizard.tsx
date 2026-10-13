"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { AnimatePresence, motion, useAnimationControls } from "framer-motion";
import { ArrowLeft, ArrowRight, ChevronDown, Loader2, Plus, X } from "lucide-react";
import { api, haptic } from "@/lib/client";
import {
  CULTURAL_PROMPTS,
  LOOKING_FOR,
  MARITAL_STATUS,
  ONBOARDING_QUIZ,
  PARTNER_RELIGIOSITY,
  RELIGIOSITY,
  promptQuestion,
  type LookingFor,
  type MaritalStatus,
  type PartnerReligiosity,
  type Religiosity,
} from "@/lib/content";
import { CITY_NAMES } from "@/lib/cities";
import { PreferencesFields } from "./PreferencesFields";
import { QuizStepper } from "./QuizStepper";
import type { Prompt } from "@/lib/types";
import { FloatingField } from "./ui/FloatingField";
import { Segmented } from "./ui/Segmented";
import { OnboardingProgress } from "./ui/OnboardingProgress";
import { PhotoGrid, tilesFromUrls, type Tile } from "./PhotoGrid";
import { WIZARD_STEPS, type WizardStep } from "@/lib/wizard";

export type ProfileDraft = {
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
  pref_age_min: number | null;
  pref_age_max: number | null;
  pref_distance_km: number | null;
  religiosity?: Religiosity;
  partner_religiosity?: PartnerReligiosity;
  marital_status?: MaritalStatus;
  looking_for?: LookingFor;
};


const META: Record<WizardStep, { title: string; subtitle: string; tab: string }> = {
  photos: { title: "התמונות שלך", subtitle: "לפחות תמונה אחת, עד 6. הראשונה היא מה שרואים קודם.", tab: "תמונות" },
  basics: { title: "נעים להכיר", subtitle: "הפרטים הבסיסיים שיעזרו לנו להתאים לך אנשים.", tab: "פרטים" },
  about: { title: "קצת עליך", subtitle: "מה את/ה עושה ומה חשוב לך. כנות מנצחת.", tab: "עליי" },
  looking: { title: "את מי את/ה מחפש/ת?", subtitle: "אפשר לשנות את זה בכל רגע, ישירות ממסך הגילוי.", tab: "חיפוש" },
  prompts: { title: "שאלות מהבית", subtitle: "בחר/י 2–3 שאלות. כאן מתחילות השיחות הכי טובות.", tab: "שאלות" },
  quiz: { title: "שאלון פתיחה", subtitle: "כמה שאלות קצרות עליך ועוד 3 של \"זה או זה\". את השאר נציע בהמשך — בקצב שלך.", tab: "שאלון" },
};

// Mirrors the server-side zod rules in /api/me.
const emailOk = (e: string) => !e || /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(e);
function errors(d: ProfileDraft, tiles: Tile[], quiz: Record<string, "a" | "b"> | null) {
  const quizLeft = quiz ? ONBOARDING_QUIZ.filter((q) => !quiz[q.key]).length : ONBOARDING_QUIZ.length;
  const answered = d.prompts.filter((p) => p.answer_text.trim().length >= 2);
  return {
    photos: tiles.some((t) => !t.url && !t.error) ? "התמונות עדיין עולות…" : tiles.filter((t) => t.url).length === 0 ? "צריך לפחות תמונה אחת" : null,
    full_name: d.full_name.trim().length < 2 ? "שם מלא — לפחות 2 תווים" : null,
    age: !d.age ? "נא להזין גיל" : d.age < 18 ? "MELA מיועדת לגילאי 18 ומעלה" : d.age > 99 ? "גיל לא תקין" : null,
    location: d.location.trim().length < 2 ? "נא לכתוב עיר מגורים" : null,
    gender: !d.gender ? "נא לבחור" : null,
    occupation: d.occupation.trim().length < 2 ? "ספר/י במה את/ה עוסק/ת" : null,
    bio: d.bio.trim().length < 10 ? `עוד ${10 - d.bio.trim().length} תווים לפחות` : null,
    email: emailOk(d.email.trim()) ? null : "כתובת אימייל לא תקינה",
    prompts: answered.length < 2 ? `ענה/י על ${2 - answered.length} שאלות נוספות` : null,
    marital_status: !d.marital_status ? "נא לבחור" : null,
    looking_for: !d.looking_for ? "נא לבחור" : null,
    religiosity: !d.religiosity ? "נא לבחור" : null,
    partner_religiosity: !d.partner_religiosity ? "נא לבחור" : null,
    quiz: quizLeft > 0 ? (quizLeft === 1 ? "נשארה שאלה אחת" : `נשארו ${quizLeft} שאלות`) : null,
  };
}
type Errors = ReturnType<typeof errors>;
const STEP_FIELDS: Record<WizardStep, (keyof Errors)[]> = {
  photos: ["photos"],
  basics: ["full_name", "age", "location", "gender"],
  looking: [],
  about: ["occupation", "bio", "email"],
  prompts: ["prompts"],
  quiz: ["marital_status", "looking_for", "religiosity", "partner_religiosity", "quiz"],
};
const stepValid = (e: Errors, s: WizardStep) => STEP_FIELDS[s].every((k) => !e[k]);

export function ProfileWizard({ initial, editing, startStep }: { initial: ProfileDraft; editing: boolean; startStep?: WizardStep }) {
  const router = useRouter();
  const [d, setD] = useState<ProfileDraft>(() => ({
    ...initial,
    prompts: initial.prompts.length
      ? initial.prompts
      : [
          { question_key: "buna", answer_text: "" },
          { question_key: "family_value", answer_text: "" },
        ],
  }));
  const [tiles, setTiles] = useState<Tile[]>(() => tilesFromUrls(initial.photos));
  const [quiz, setQuiz] = useState<Record<string, "a" | "b"> | null>(null);
  useEffect(() => {
    api<{ answers: Record<string, "a" | "b"> }>("/api/quiz")
      .then((r) => setQuiz(r.answers))
      .catch(() => setQuiz({}));
  }, []);
  const [stepIdx, setStepIdx] = useState(Math.max(0, WIZARD_STEPS.indexOf(startStep ?? "photos")));
  const [dir, setDir] = useState(1);
  const [showErrors, setShowErrors] = useState(false);
  const [saving, setSaving] = useState(false);
  const [serverErr, setServerErr] = useState<string | null>(null);
  const [picker, setPicker] = useState<number | null>(null);
  const nudge = useAnimationControls();

  const step = WIZARD_STEPS[stepIdx];
  const errs = errors(d, tiles, quiz);
  const set = <K extends keyof ProfileDraft>(k: K, v: ProfileDraft[K]) => setD((s) => ({ ...s, [k]: v }));
  const last = stepIdx === WIZARD_STEPS.length - 1;

  // Revoke local previews when tiles go away.
  useEffect(() => () => tiles.forEach((t) => t.preview && URL.revokeObjectURL(t.preview)), []); // eslint-disable-line react-hooks/exhaustive-deps

  function go(to: number) {
    setDir(to > stepIdx ? 1 : -1);
    setShowErrors(false);
    setStepIdx(to);
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  function reject() {
    setShowErrors(true);
    haptic([20, 40, 20]);
    void nudge.start({ x: [0, -8, 8, -5, 5, 0], transition: { duration: 0.4 } });
  }

  async function save() {
    const firstBad = WIZARD_STEPS.findIndex((s) => !stepValid(errs, s));
    if (firstBad !== -1) {
      if (firstBad !== stepIdx) go(firstBad);
      setTimeout(reject, firstBad !== stepIdx ? 350 : 0);
      return;
    }
    setSaving(true);
    setServerErr(null);
    try {
      const res = await api<{ next: string }>("/api/me", {
        method: "PUT",
        json: {
          ...d,
          email: d.email.trim(),
          photos: tiles.filter((t) => t.url).map((t) => t.url!),
          prompts: d.prompts.filter((p) => p.answer_text.trim()),
        },
      });
      haptic([10, 30, 10]);
      // First-time onboarding offers the plans once (free is one of the options); edits go back to the profile.
      router.replace(editing ? "/profile" : res.next === "/discover" ? "/onboarding/plan?welcome=1" : res.next);
      router.refresh();
    } catch (e) {
      setServerErr((e as Error).message);
      setSaving(false);
    }
  }

  function next() {
    if (!stepValid(errs, step)) return reject();
    if (last || editing) return void save();
    haptic(8);
    go(stepIdx + 1);
  }

  const used = new Set(d.prompts.map((p) => p.question_key));

  return (
    <div className="flex flex-1 flex-col pb-36">
      {editing ? (
        <div className="flex items-center gap-3">
          <button onClick={() => router.back()} className="grid h-10 w-10 place-items-center rounded-full border border-line-2 text-mute transition hover:text-cream" aria-label="חזרה">
            <ArrowRight size={18} />
          </button>
          <div className="no-scrollbar flex flex-1 gap-1 overflow-x-auto rounded-full border border-line-2 bg-white/[0.03] p-1">
            {WIZARD_STEPS.map((s, i) => (
              <button key={s} onClick={() => go(i)} className={`relative flex-1 rounded-full px-3 py-2 text-xs whitespace-nowrap transition-colors ${i === stepIdx ? "text-ink font-semibold" : "text-mute"}`}>
                {i === stepIdx && <motion.span layoutId="edit-tab" className="absolute inset-0 rounded-full bg-gradient-to-b from-gold-2 to-gold" />}
                <span className="relative">{META[s].tab}</span>
              </button>
            ))}
          </div>
        </div>
      ) : (
        <OnboardingProgress step={3 + stepIdx} label={META[step].tab} />
      )}

      <AnimatePresence mode="wait" custom={dir} initial={false}>
        <motion.section
          key={step}
          custom={dir}
          variants={{
            enter: (dr: number) => ({ opacity: 0, x: dr * -48 }),
            center: { opacity: 1, x: 0 },
            exit: (dr: number) => ({ opacity: 0, x: dr * 48 }),
          }}
          initial="enter"
          animate="center"
          exit="exit"
          transition={{ type: "spring", stiffness: 340, damping: 34 }}
          className="mt-8"
        >
          <h1 className="font-display text-[2rem] leading-tight font-bold">{META[step].title}</h1>
          <p className="mt-1.5 mb-7 text-[15px] text-mute">{META[step].subtitle}</p>

          <motion.div animate={nudge}>
            {step === "photos" && (
              <>
                <PhotoGrid tiles={tiles} onChange={(u) => setTiles(u)} />
                {showErrors && errs.photos && <p className="mt-2 px-1 text-[12px] text-danger">{errs.photos}</p>}
              </>
            )}

            {step === "basics" && (
              <div className="space-y-2">
                <FloatingField label="שם מלא" value={d.full_name} onChange={(v) => set("full_name", v)} error={errs.full_name} valid={!errs.full_name} showErrors={showErrors} maxLength={60} autoFocus={!d.full_name} />
                <div className="grid grid-cols-2 gap-3">
                  <FloatingField
                    label="גיל"
                    inputMode="numeric"
                    value={d.age ? String(d.age) : ""}
                    onChange={(v) => {
                      const age = Number(v.replace(/\D/g, "").slice(0, 2)) || undefined;
                      // First time: suggest a range around the member's own age (editable on the next step).
                      setD((s) => ({
                        ...s,
                        age,
                        ...(age && age >= 18 && !initial.pref_age_min && !initial.pref_age_max
                          ? { pref_age_min: Math.max(18, age - 5), pref_age_max: Math.min(70, age + 6) }
                          : {}),
                      }));
                    }}
                    error={errs.age}
                    valid={!errs.age}
                    showErrors={showErrors}
                  />
                  <FloatingField
                    label="עיר מגורים"
                    suggestions={CITY_NAMES}
                    autoComplete="address-level2"
                    maxLength={60}
                    value={d.location}
                    onChange={(v) => set("location", v)}
                    error={errs.location}
                    valid={!errs.location}
                    showErrors={showErrors}
                  />
                </div>
                <div className="space-y-4 pt-2">
                  <Segmented
                    label="אני"
                    value={d.gender}
                    onChange={(v) => setD((s) => ({ ...s, gender: v, seeking: s.gender ? s.seeking : v === "male" ? "female" : "male" }))}
                    options={[
                      ["female", "אישה"],
                      ["male", "גבר"],
                    ]}
                  />
                  {showErrors && errs.gender && <p className="-mt-2 px-1 text-[12px] text-danger">{errs.gender}</p>}
                </div>
              </div>
            )}

            {step === "looking" && (
              <PreferencesFields
                value={{ seeking: d.seeking, pref_age_min: d.pref_age_min, pref_age_max: d.pref_age_max, pref_distance_km: d.pref_distance_km }}
                onChange={(p) => setD((s) => ({ ...s, ...p }))}
              />
            )}

            {step === "quiz" && (
              <>
                <div className="space-y-7">
                  <ChoiceGroup
                    label="סטטוס"
                    value={d.marital_status}
                    options={MARITAL_STATUS}
                    onChange={(v) => setD((s) => ({ ...s, marital_status: v }))}
                    error={showErrors ? errs.marital_status : null}
                  />
                  <ChoiceGroup
                    label="מה את/ה מחפש/ת כאן?"
                    value={d.looking_for}
                    options={LOOKING_FOR}
                    onChange={(v) => setD((s) => ({ ...s, looking_for: v }))}
                    error={showErrors ? errs.looking_for : null}
                    stacked
                  />
                  <ChoiceGroup
                    label="איך את/ה מגדיר/ה את עצמך?"
                    value={d.religiosity}
                    options={RELIGIOSITY}
                    onChange={(v) => setD((s) => ({ ...s, religiosity: v }))}
                    error={showErrors ? errs.religiosity : null}
                  />
                  <ChoiceGroup
                    label="כמה חשוב לך שהצד השני יהיה דתי/ה?"
                    value={d.partner_religiosity}
                    options={PARTNER_RELIGIOSITY}
                    onChange={(v) => setD((s) => ({ ...s, partner_religiosity: v }))}
                    error={showErrors ? errs.partner_religiosity : null}
                    stacked
                  />
                  <div>
                    <span className="label px-1">ועוד 3 שאלות מהירות — זה או זה?</span>
                    <div className="mt-2">
                      <QuizStepper questions={ONBOARDING_QUIZ} answers={quiz} onAnswer={(key, choice) => setQuiz((a) => ({ ...(a ?? {}), [key]: choice }))} />
                    </div>
                    {showErrors && errs.quiz && <p className="mt-3 px-1 text-[12px] text-danger">{errs.quiz}</p>}
                  </div>
                </div>
              </>
            )}

            {step === "about" && (
              <div className="space-y-2">
                <FloatingField label="עיסוק" hint="למשל: מהנדסת, עורך דין, סטודנטית לרפואה" value={d.occupation} onChange={(v) => set("occupation", v)} error={errs.occupation} valid={!errs.occupation} showErrors={showErrors} maxLength={80} />
                <FloatingField as="textarea" label="קצת עליי" hint="מה חשוב לך? מה מצחיק אותך? מה את/ה מחפש/ת?" rows={5} maxLength={500} value={d.bio} onChange={(v) => set("bio", v)} error={errs.bio} valid={!errs.bio} showErrors={showErrors} />
                <FloatingField
                  label="אימייל (לא חובה)"
                  hint="לקבלות ועדכונים בלבד"
                  type="email"
                  dir="ltr"
                  autoComplete="email"
                  value={d.email}
                  onChange={(v) => set("email", v)}
                  error={errs.email}
                  valid={!!d.email && !errs.email}
                  showErrors={showErrors}
                />
              </div>
            )}

            {step === "prompts" && (
              <div className="space-y-3">
                <AnimatePresence initial={false}>
                  {d.prompts.map((p, i) => (
                    <motion.div
                      key={p.question_key}
                      layout
                      initial={{ opacity: 0, y: 12, scale: 0.98 }}
                      animate={{ opacity: 1, y: 0, scale: 1 }}
                      exit={{ opacity: 0, scale: 0.95, transition: { duration: 0.18 } }}
                      className="surface rounded-3xl p-5 focus-within:ring-gold"
                    >
                      <div className="mb-2 flex items-start gap-2">
                        <button type="button" onClick={() => setPicker(i)} className="flex flex-1 items-center gap-1.5 text-right text-[13px] font-semibold text-gold-2">
                          {promptQuestion(p.question_key)} <ChevronDown size={14} className="shrink-0 opacity-70" />
                        </button>
                        {d.prompts.length > 2 && (
                          <button type="button" onClick={() => set("prompts", d.prompts.filter((_, j) => j !== i))} className="text-mute transition hover:text-cream" aria-label="הסרת שאלה">
                            <X size={16} />
                          </button>
                        )}
                      </div>
                      <textarea
                        className="font-display w-full resize-none bg-transparent text-[1.2rem] leading-snug outline-none placeholder:font-sans placeholder:text-base placeholder:text-mute-2"
                        rows={2}
                        maxLength={200}
                        value={p.answer_text}
                        placeholder="התשובה שלך ✍️"
                        onChange={(e) => set("prompts", d.prompts.map((x, j) => (j === i ? { ...x, answer_text: e.target.value } : x)))}
                      />
                      <div className="mt-1 flex justify-between text-[11px]">
                        <span className={p.answer_text.trim().length >= 2 ? "text-gold-2" : "text-mute-2"}>{p.answer_text.trim().length >= 2 ? "✓ נענתה" : "ממתינה לתשובה"}</span>
                        <span className="tabular text-mute-2">{p.answer_text.length}/200</span>
                      </div>
                    </motion.div>
                  ))}
                </AnimatePresence>
                {d.prompts.length < 3 && (
                  <motion.button
                    layout
                    whileTap={{ scale: 0.97 }}
                    onClick={() => set("prompts", [...d.prompts, { question_key: CULTURAL_PROMPTS.find((q) => !used.has(q.key))!.key, answer_text: "" }])}
                    className="btn-ghost w-full border-dashed text-sm"
                  >
                    <Plus size={16} /> הוספת שאלה שלישית
                  </motion.button>
                )}
                {showErrors && errs.prompts && <p className="px-1 text-[12px] text-danger">{errs.prompts}</p>}
              </div>
            )}
          </motion.div>
        </motion.section>
      </AnimatePresence>

      {/* bottom action bar */}
      <div className="fixed inset-x-0 bottom-0 z-30 mx-auto max-w-md bg-gradient-to-t from-ink via-ink/95 to-transparent px-6 pt-10 safe-bottom">
        <AnimatePresence>
          {serverErr && (
            <motion.p initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} className="mb-2 text-center text-sm text-danger">
              {serverErr}
            </motion.p>
          )}
        </AnimatePresence>
        <div className="flex gap-3">
          {!editing && stepIdx > 0 && (
            <motion.button initial={{ opacity: 0, scale: 0.8 }} animate={{ opacity: 1, scale: 1 }} onClick={() => go(stepIdx - 1)} className="btn-ghost h-[54px] w-[54px] shrink-0 p-0" aria-label="שלב קודם">
              <ArrowRight size={20} />
            </motion.button>
          )}
          <button onClick={next} disabled={saving} className={`btn-gold h-[54px] flex-1 text-[16px] ${stepValid(errs, step) ? "" : "opacity-60 saturate-50"}`}>
            {saving ? (
              <Loader2 className="animate-spin" size={18} />
            ) : editing ? (
              "שמירת שינויים"
            ) : last ? (
              "סיום ובחירת מסלול"
            ) : (
              <>
                המשך <ArrowLeft size={18} />
              </>
            )}
          </button>
        </div>
      </div>

      <PromptPicker
        open={picker !== null}
        current={picker !== null ? d.prompts[picker]?.question_key : undefined}
        used={used}
        onClose={() => setPicker(null)}
        onPick={(key) => {
          if (picker === null) return;
          set("prompts", d.prompts.map((x, j) => (j === picker ? { ...x, question_key: key } : x)));
          setPicker(null);
        }}
      />
    </div>
  );
}

function PromptPicker({ open, current, used, onClose, onPick }: { open: boolean; current?: string; used: Set<string>; onClose: () => void; onPick: (k: string) => void }) {
  return (
    <AnimatePresence>
      {open && (
        <motion.div className="fixed inset-0 z-50 flex items-end bg-black/60 backdrop-blur-sm" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={onClose}>
          <motion.div
            initial={{ y: "100%" }}
            animate={{ y: 0 }}
            exit={{ y: "100%" }}
            transition={{ type: "spring", stiffness: 380, damping: 38 }}
            drag="y"
            dragConstraints={{ top: 0, bottom: 0 }}
            dragElastic={{ top: 0, bottom: 0.6 }}
            onDragEnd={(_, i) => (i.offset.y > 100 || i.velocity.y > 500) && onClose()}
            onClick={(e) => e.stopPropagation()}
            className="surface mx-auto max-h-[80dvh] w-full max-w-md overflow-y-auto rounded-t-[32px] px-5 pt-3 safe-bottom"
          >
            <div className="mx-auto mb-4 h-1 w-10 rounded-full bg-white/20" />
            <h3 className="mb-3 px-1 font-semibold">בחר/י שאלה</h3>
            <ul className="space-y-1.5 pb-2">
              {CULTURAL_PROMPTS.map((q) => {
                const disabled = used.has(q.key) && q.key !== current;
                return (
                  <li key={q.key}>
                    <button
                      disabled={disabled}
                      onClick={() => onPick(q.key)}
                      className={`w-full rounded-2xl px-4 py-3.5 text-right text-[15px] transition ${
                        q.key === current ? "bg-gold/12 text-gold-2 ring-1 ring-gold/40" : disabled ? "text-mute-2" : "hover:bg-white/[0.05]"
                      }`}
                    >
                      {q.question}
                    </button>
                  </li>
                );
              })}
            </ul>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

/** Single-choice pills for the opening questionnaire. */
function ChoiceGroup<T extends string>({
  label,
  value,
  options,
  onChange,
  error,
  stacked = false,
}: {
  label: string;
  value?: T;
  options: Record<T, string>;
  onChange: (v: T) => void;
  error?: string | null;
  stacked?: boolean;
}) {
  return (
    <div role="radiogroup" aria-label={label}>
      <span className="label px-1">{label}</span>
      <div className={stacked ? "mt-2 space-y-2" : "mt-2 grid grid-cols-3 gap-2"}>
        {(Object.entries(options) as [T, string][]).map(([v, text]) => {
          const active = value === v;
          return (
            <motion.button
              key={v}
              type="button"
              role="radio"
              aria-checked={active}
              whileTap={{ scale: 0.96 }}
              onClick={() => {
                haptic(6);
                onChange(v);
              }}
              className={`flex w-full items-center rounded-2xl border px-3 py-3.5 text-[15px] font-medium transition-colors ${
                stacked ? "justify-between px-4 text-right" : "justify-center text-center"
              } ${active ? "border-gold/60 bg-gradient-to-b from-gold/20 to-gold/5 text-gold-2 shadow-[0_0_24px_-10px_rgba(212,175,55,0.7)]" : "border-line-2 bg-white/[0.03] text-cream/85 hover:border-white/20"}`}
            >
              {text}
              {stacked && <span className={`h-4 w-4 shrink-0 rounded-full border-2 transition ${active ? "border-gold-2 bg-gold-2 shadow-[inset_0_0_0_3px_var(--color-ink-2)]" : "border-white/25"}`} />}
            </motion.button>
          );
        })}
      </div>
      {error && <p className="mt-2 px-1 text-[12px] text-danger">{error}</p>}
    </div>
  );
}
