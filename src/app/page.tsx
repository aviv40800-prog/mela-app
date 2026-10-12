import Link from "next/link";
import { redirect } from "next/navigation";
import {
  BadgeCheck,
  Bell,
  Check,
  Coffee,
  Crown,
  EyeOff,
  HeartHandshake,
  MessageCircleHeart,
  ShieldCheck,
  Gem,
  UserRoundCheck,
  Users,
} from "lucide-react";
import { Logo } from "@/components/Logo";
import { HeroVisual } from "@/components/HeroVisual";
import { PhoneMockup } from "@/components/landing/PhoneMockup";
import { Reveal } from "@/components/landing/Reveal";

// "אהבה עם שורשים" — the founders' story, verbatim.
const STORY_INTRO = [
  'השאלה ששואלים אותנו כל הזמן היא: "מה, אתה תתחתן רק עם מישהי מהעדה?".',
  "היום כבר יותר קשה לנו לענות על השאלה הזו בכנות ולהגיד פשוט \"כן\", כי מה לעשות — לאט לאט כל אחד הולך לכיוון שלו, אנחנו מתחילים להיאבד בדרך, והסביבות משתנות.",
  'כשסבים התחתנו, הספיק שאבא הלך לבית של השכנים מהכפר הסמוך ואמר: "הבן שלי מוכן להתחתן, אנחנו משפחה טובה", וכך הצד השני הציע מישהו. כשההורים התחתנו, זה בעיקר הגיע מהשכונה, משידוך של דוד או דודה, ואולי אפילו היית מכיר את אהבת חייך בסיגד.',
  'היום? אתה מוצא את עצמך חייב לצאת לבלות במועדונים "שלנו" כדי להכיר מישהי, גם אם ממש לא בא לך לצאת, ואתה כבר לא בגיל, או שזה פשוט לא הבילוי החביב עליך. אבל להכיר אישה זה חשוב לך מאוד.',
  "ומה קורה כשהחברים שגדלת איתם הם לא בני הקהילה, אבל כל כך חשוב לך למצוא אשת חיל, בת העדה? כי רק אתה באמת יודע איזה ערכים יש לנו בעדה, איזה כבוד יש לנו, ואם כבר להקים בית — אז רק עם מישהי שמבינה את זה לעומק.",
  "אחרי שנים של חיפושים ואין-סוף בילויים שכבר נמאסו, אחרי ניסיונות באין-ספור אפליקציות היכרויות שבהן אחוז בני העדה מצומצם כל כך שאחרי יומיים של סוויפים אתה שוב לבד...",
];
const STORY_WHY = [
  "MELA נולדה מהפער הזה.",
  "רצינו לקחת את החום של ההיכרות דרך משפחה, אמון, ערכים ושורשים משותפים — ולחבר אותם לטכנולוגיה מכבדת ופרטית.",
];
const STORY_NO_EXPLAIN = [
  'זה מקום שבו לא צריך להסביר למה פעם ראשונה שטסת לחו"ל הייתה רק בגיל 22.',
  "או למה במוצאי שבת אתה בבית, שותה שלוש כוסות קפה ביחד עם כל המשפחה.",
  "או למה בחתונה הולך להיות 850 איש במקרה הטוב, ושאתה לא מכיר 70 אחוז מהאורחים.",
];
const STORY_CLOSE = ["פה אתה יכול להיות אתה, כי פה כבר מכירים אותך.", "אנחנו כאן כדי לעשות התאמה אמיתית ומדויקת לכל אחד ואחת מכם."];

import { Faq } from "@/components/landing/Faq";
import { getSessionUserId } from "@/lib/session";
import { getUser } from "@/lib/users";
import { nextOnboardingStep } from "@/lib/onboarding";
import { PLANS, TRIAL_DAYS } from "@/lib/content";
import { FREE_DAILY_LIKES } from "@/lib/quota";

const STEPS = [
  { Icon: UserRoundCheck, t: "נרשמים ומאמתים", d: "מספר טלפון, קוד SMS — ואתם בפנים. כל חבר/ה ב־MELA מאומת/ת." },
  { Icon: Coffee, t: "מספרים מי אתם", d: "תמונות, עיסוק, ושאלות מהבית: הבונה, סיגד, המשפחה, המילה באמהרית שמתארת אתכם." },
  { Icon: Gem, t: "מקבלים בחירות אישיות", d: "כל בוקר 3 התאמות שנבחרו לפי ערכים משותפים, ועוד גילוי חופשי בהחלקה." },
  { Icon: MessageCircleHeart, t: "מתחילים לדבר", d: "לייק הדדי פותח צ׳אט — עם פתיחים מהבית שעוזרים לשבור את הקרח." },
];

const FEATURES = [
  { Icon: ShieldCheck, t: "קהילה מאומתת", d: "כל פרופיל עובר אימות טלפון. בלי בוטים, בלי פרופילים מזויפים." },
  { Icon: Coffee, t: "שאלות מהבית", d: "במקום ״מה התחביבים שלך״ — שאלות שרק מי שגדל בבית אתיופי־ישראלי יבין עד הסוף." },
  { Icon: Gem, t: "3 בחירות ביום", d: "פחות החלקות אינסופיות, יותר אנשים שבאמת מתאימים לכם." },
  { Icon: HeartHandshake, t: "״זה או זה?״", d: "אינג׳רה או פיתה? חתונה של 800 או אינטימית? כל תשובה מחדדת את ההתאמות." },
  { Icon: MessageCircleHeart, t: "תגובה ישירה על תשובה", d: "ראיתם תשובה שנגעה בכם? שלחו לייק עם תגובה עליה — הדרך הכי טבעית להתחיל." },
  { Icon: Bell, t: "התראה בוואטסאפ", d: "יש התאמה? תדעו מיד, ישר לוואטסאפ, בלי לפספס אף אחד." },
];

const PROMISES = [
  { Icon: EyeOff, t: "המספר שלך פרטי", d: "מספר הטלפון משמש רק לאימות. הוא לעולם לא מוצג לחברים אחרים." },
  { Icon: Users, t: "רק אנשים אמיתיים", d: "כל פרופיל מאומת בטלפון ועובר הרשמה מלאה עם תמונות ושאלות — בלי פרופילים ריקים." },
  { Icon: ShieldCheck, t: "שליטה מלאה", d: "ביטול מנוי בלחיצה מתוך הפרופיל, בלי טלפונים ובלי אותיות קטנות." },
];

const FAQ = [
  { q: "למי מיועדת MELA?", a: "לצעירות וצעירים מהקהילה האתיופית־ישראלית — ולמי שהתרבות הזו קרובה ללבו — שמחפשים קשר רציני ומשמעותי, לא עוד אפליקציה של החלקות." },
  { q: "זה באמת חינם?", a: `כן. ההרשמה והשימוש הבסיסי חינמיים לגמרי, בלי כרטיס אשראי: ${FREE_DAILY_LIKES} לייקים ביום, בחירה יומית אחת וצ׳אט מלא עם ההתאמות שלכם.` },
  { q: "מה מקבלים ב־Premium ובכמה?", a: `לייקים ללא הגבלה, כל 3 הבחירות היומיות, ולראות מי כבר אהב/ה אתכם. ₪49 לחודש או ₪119 לשלושה חודשים (כ־₪40 לחודש), עם ${TRIAL_DAYS} ימי ניסיון חינם וביטול בכל עת.` },
  { q: "למה צריך מספר טלפון?", a: "כדי לוודא שכל פרופיל שייך לאדם אמיתי. המספר משמש רק לאימות ולהתראות — הוא לא מוצג לאף אחד." },
  { q: "איך עובדות ההתאמות?", a: "כשלשניכם יש לייק הדדי — נפתח צ׳אט ונשלחת התראה בוואטסאפ. ההמלצות היומיות מחושבות לפי תשובות ״זה או זה?״, עיר מגורים וגיל." },
  { q: "אפשר להשתמש מהמחשב?", a: "כן. MELA עובדת בכל דפדפן, ובטלפון אפשר להוסיף אותה למסך הבית ולהשתמש בה כמו באפליקציה." },
  { q: "כבר נרשמתי — איך נכנסים?", a: "לוחצים ״כניסה״, מזינים את אותו מספר טלפון ומקבלים קוד. ההתחברות נשמרת במכשיר ל־30 יום." },
];

export default async function Landing() {
  const id = await getSessionUserId();
  const user = id ? getUser(id) : null;
  if (user && !user.is_banned) redirect(nextOnboardingStep(user));

  return (
    <div className="relative overflow-x-clip">
      {/* ---------- nav ---------- */}
      <header className="sticky top-0 z-40 border-b border-transparent bg-ink/70 backdrop-blur-xl supports-[backdrop-filter]:bg-ink/55">
        <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-5 md:px-8" style={{ paddingTop: "env(safe-area-inset-top)" }}>
          <Link href="/" aria-label="MELA">
            <Logo size="sm" />
          </Link>
          <nav className="hidden items-center gap-8 text-sm text-mute md:flex">
            <a href="#story" className="hover:text-cream">הסיפור</a>
            <a href="#how" className="hover:text-cream">איך זה עובד</a>
            <a href="#pricing" className="hover:text-cream">מחירים</a>
            <a href="#faq" className="hover:text-cream">שאלות</a>
          </nav>
          <div className="flex items-center gap-2">
            <Link href="/login" className="rounded-full px-4 py-2 text-sm text-cream/90 transition hover:bg-white/5">
              כניסה
            </Link>
            <Link href="/signup" className="btn-gold hidden px-5 py-2.5 text-sm md:inline-flex">
              הצטרפות חינם
            </Link>
          </div>
        </div>
      </header>

      {/* ---------- hero ---------- */}
      <section className="mx-auto grid max-w-6xl items-center gap-6 px-5 pt-6 pb-16 md:grid-cols-2 md:gap-12 md:px-8 md:pt-16 md:pb-24">
        <Reveal className="text-center md:text-right">
          <p className="eyebrow">אהבה עם שורשים</p>
          <h1 className="font-display mt-4 text-[2.7rem] leading-[1.05] font-bold md:text-[4rem]">
            המקום שבו
            <br />
            <span className="gold-text animate-shimmer">הסיפור שלכם</span> מתחיל
          </h1>
          <p className="mx-auto mt-5 max-w-md text-[16px] leading-relaxed text-mute md:mx-0 md:text-lg">
            אפליקציית ההיכרויות הראשונה שנבנתה במיוחד לצעירות וצעירים מהקהילה האתיופית־ישראלית — לאנשים שמחפשים קשר אמיתי, עם מישהו שמבין מאיפה הם באים.
          </p>
          <div className="mt-8 flex flex-col gap-3 sm:flex-row sm:justify-center md:justify-start">
            <Link href="/signup" className="btn-gold px-8 text-[17px]">
              הצטרפות חינם
            </Link>
            <Link href="/login" className="btn-ghost px-8">
              כבר רשום/ה? כניסה
            </Link>
          </div>
          <ul className="mt-6 flex flex-wrap justify-center gap-x-5 gap-y-2 text-[13px] text-mute md:justify-start">
            {["חינם לגמרי", "בלי כרטיס אשראי", "כל פרופיל מאומת"].map((t) => (
              <li key={t} className="flex items-center gap-1.5">
                <Check size={14} className="text-gold" /> {t}
              </li>
            ))}
          </ul>
        </Reveal>
        <Reveal delay={0.15}>
          <HeroVisual />
        </Reveal>
      </section>

      {/* ---------- cultural band ---------- */}
      <div className="border-y border-line bg-white/[0.015] py-5">
        <div className="tilet mx-auto mb-4 max-w-5xl opacity-60" />
        <p className="font-display mx-auto max-w-5xl px-5 text-center text-lg text-cream/70 md:text-2xl">
          בונה <span className="text-gold">·</span> סיגד <span className="text-gold">·</span> אסקסטה <span className="text-gold">·</span> משפחה <span className="text-gold">·</span> שורשים{" "}
          <span className="text-gold">·</span> אהבה
        </p>
        <div className="tilet mx-auto mt-4 max-w-5xl opacity-60" />
      </div>

      {/* ---------- story ---------- */}
      <section id="story" className="mx-auto max-w-6xl scroll-mt-20 px-5 py-20 md:px-8 md:py-28">
        <div className="grid gap-12 md:grid-cols-[1fr_1.2fr] md:gap-16">
          <Reveal>
            <p className="eyebrow">הסיפור שלנו</p>
            <h2 className="font-display mt-3 text-[2.2rem] leading-tight font-bold md:text-5xl">
              אהבה
              <br />
              <span className="gold-text">עם שורשים</span>
            </h2>
            <div className="mt-8 rounded-[26px] border border-gold/25 bg-gradient-to-b from-gold/[0.08] to-transparent p-6">
              <div className="font-display text-4xl text-gold-2" dir="ltr">
                መላ
              </div>
              <p className="mt-3 text-[15px] leading-relaxed text-cream/85">
                באמהרית, <b>״מֶלָה״</b> היא דרך, פתרון — הרעיון שתמיד יש דרך. בשבילנו MELA היא הדרך להכיר את האדם הנכון, בלי לוותר על מי שאנחנו.
              </p>
            </div>
          </Reveal>
          <Reveal delay={0.1} className="space-y-5 text-[16.5px] leading-[1.85] text-cream/85">
            {STORY_INTRO.map((t) => (
              <p key={t}>{t}</p>
            ))}
            <p className="font-display pt-2 text-[1.9rem] leading-tight font-bold text-cream md:text-[2.3rem]">הקמנו את MELA.</p>
            {STORY_WHY.map((t, i) => (
              <p key={t} className={i === 0 ? "font-semibold text-cream" : undefined}>
                {t}
              </p>
            ))}
            <ul className="space-y-3 border-r-2 border-gold/40 py-1 pr-5">
              {STORY_NO_EXPLAIN.map((t) => (
                <li key={t} className="text-cream/90">
                  {t}
                </li>
              ))}
            </ul>
            {STORY_CLOSE.map((t) => (
              <p key={t}>{t}</p>
            ))}
            <p className="font-display text-[1.45rem] leading-snug text-gold-2 md:text-[1.7rem]">זה הזמן להפסיק להתפשר על מי שלא מבינה את מי שאתה.</p>
            <div className="pt-4">
              <Link href="/signup" className="btn-gold w-full px-10 text-[17px] sm:w-auto">
                מתחילים – 7 ימים חינם
              </Link>
            </div>
          </Reveal>
        </div>
      </section>

      {/* ---------- how it works ---------- */}
      <section id="how" className="scroll-mt-20 border-t border-line bg-gradient-to-b from-white/[0.02] to-transparent">
        <div className="mx-auto max-w-6xl px-5 py-20 md:px-8 md:py-28">
          <Reveal className="mx-auto max-w-2xl text-center">
            <p className="eyebrow">איך זה עובד</p>
            <h2 className="font-display mt-3 text-[2.1rem] leading-tight font-bold md:text-[2.8rem]">ארבעה צעדים עד השיחה הראשונה</h2>
          </Reveal>
          <ol className="mt-14 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {STEPS.map(({ Icon, t, d }, i) => (
              <Reveal key={t} delay={i * 0.08}>
                <li className="surface relative h-full rounded-[26px] p-6">
                  <span className="tabular absolute top-5 left-5 font-display text-4xl font-bold text-gold/15">{i + 1}</span>
                  <span className="grid h-12 w-12 place-items-center rounded-2xl border border-gold/25 bg-gold/[0.08] text-gold-2">
                    <Icon size={22} />
                  </span>
                  <h3 className="mt-5 text-lg font-semibold">{t}</h3>
                  <p className="mt-2 text-[14.5px] leading-relaxed text-mute">{d}</p>
                </li>
              </Reveal>
            ))}
          </ol>
        </div>
      </section>

      {/* ---------- product + features ---------- */}
      <section className="mx-auto max-w-6xl px-5 py-20 md:px-8 md:py-28">
        <div className="grid items-center gap-14 lg:grid-cols-[auto_1fr] lg:gap-20">
          <Reveal>
            <PhoneMockup />
          </Reveal>
          <div>
            <Reveal>
              <p className="eyebrow">מה מחכה לכם בפנים</p>
              <h2 className="font-display mt-3 text-[2.1rem] leading-tight font-bold md:text-[2.8rem]">
                לא עוד אפליקציה.
                <br />
                <span className="gold-text">אפליקציה שמבינה אתכם.</span>
              </h2>
            </Reveal>
            <div className="mt-10 grid gap-x-8 gap-y-7 sm:grid-cols-2">
              {FEATURES.map(({ Icon, t, d }, i) => (
                <Reveal key={t} delay={i * 0.05}>
                  <div className="flex gap-4">
                    <span className="grid h-11 w-11 shrink-0 place-items-center rounded-xl border border-gold/25 bg-gold/[0.07] text-gold-2">
                      <Icon size={20} />
                    </span>
                    <div>
                      <h3 className="font-semibold">{t}</h3>
                      <p className="mt-1 text-[14.5px] leading-relaxed text-mute">{d}</p>
                    </div>
                  </div>
                </Reveal>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* ---------- promises ---------- */}
      <section className="border-y border-line bg-white/[0.015]">
        <div className="mx-auto grid max-w-6xl gap-8 px-5 py-16 md:grid-cols-3 md:px-8">
          {PROMISES.map(({ Icon, t, d }, i) => (
            <Reveal key={t} delay={i * 0.08} className="text-center md:text-right">
              <Icon className="mx-auto text-gold md:mx-0" size={26} />
              <h3 className="mt-4 text-lg font-semibold">{t}</h3>
              <p className="mt-2 text-[14.5px] leading-relaxed text-mute">{d}</p>
            </Reveal>
          ))}
        </div>
      </section>

      {/* ---------- pricing ---------- */}
      <section id="pricing" className="mx-auto max-w-6xl scroll-mt-20 px-5 py-20 md:px-8 md:py-28">
        <Reveal className="text-center">
          <p className="eyebrow">מחירים פשוטים</p>
          <h2 className="font-display mt-3 text-[2.1rem] leading-tight font-bold md:text-[2.8rem]">מתחילים בחינם. משדרגים כשמתאים.</h2>
          <p className="mx-auto mt-4 max-w-lg text-mute">בלי כרטיס אשראי. כש־Premium מתאים לכם — {TRIAL_DAYS} ימי ניסיון חינם וביטול בכל עת.</p>
        </Reveal>
        <div className="mt-12 grid gap-4 md:grid-cols-3">
          <Reveal>
            <div className="surface relative h-full rounded-[28px] p-7">
              <h3 className="text-xl font-semibold">חינם</h3>
              <div className="mt-4 flex items-baseline gap-2">
                <span className="font-display text-5xl font-bold" dir="ltr">
                  ₪0
                </span>
                <span className="text-mute">לתמיד</span>
              </div>
              <p className="mt-2 text-sm text-mute">בלי כרטיס אשראי</p>
              <ul className="mt-6 space-y-2.5 text-[14.5px]">
                {[`${FREE_DAILY_LIKES} לייקים ביום`, "בחירה אישית אחת ביום", "צ׳אט מלא עם ההתאמות", "התראת וואטסאפ על התאמה"].map((f) => (
                  <li key={f} className="flex items-center gap-2.5">
                    <Check size={15} className="text-gold" /> {f}
                  </li>
                ))}
              </ul>
              <Link href="/signup" className="btn-ghost mt-8 w-full">
                הצטרפות חינם
              </Link>
            </div>
          </Reveal>
          {(["quarterly_119", "monthly_49"] as const).map((id, i) => {
            const p = PLANS[id];
            const featured = id === "quarterly_119";
            return (
              <Reveal key={id} delay={i * 0.08}>
                <div className={`relative h-full rounded-[28px] p-7 ${featured ? "glow bg-gradient-to-b from-gold/[0.12] to-gold/[0.02]" : "surface"}`}>
                  {featured && (
                    <span className="absolute -top-3.5 right-7 flex items-center gap-1 rounded-full bg-gradient-to-l from-gold-2 to-gold px-3 py-1 text-[12px] font-bold text-ink shadow-lg">
                      <Crown size={12} /> מומלץ למציאת אהבה
                    </span>
                  )}
                  <h3 className="text-xl font-semibold">{p.title}</h3>
                  <div className="mt-4 flex items-baseline gap-2">
                    <span className="font-display text-5xl font-bold" dir="ltr">
                      {p.priceLabel}
                    </span>
                    <span className="text-mute">{p.period}</span>
                  </div>
                  <p className="mt-2 text-sm text-gold-2">{featured ? `≈ ₪${p.perMonth.toFixed(0)} לחודש · ${p.note}` : p.note}</p>
                  <ul className="mt-6 space-y-2.5 text-[14.5px]">
                    {["לייקים ללא הגבלה", "כל 3 הבחירות היומיות", "לראות מי אהב/ה אותך", "צ׳אט + פתיחים מהבית"].map((f) => (
                      <li key={f} className="flex items-center gap-2.5">
                        <Check size={15} className="text-gold" /> {f}
                      </li>
                    ))}
                  </ul>
                  <Link href="/signup" className={`${featured ? "btn-gold" : "btn-ghost"} mt-8 w-full`}>
                    {TRIAL_DAYS} ימי Premium חינם
                  </Link>
                </div>
              </Reveal>
            );
          })}
        </div>
      </section>

      {/* ---------- faq ---------- */}
      <section id="faq" className="mx-auto max-w-3xl scroll-mt-20 px-5 pb-20 md:px-8 md:pb-28">
        <Reveal className="mb-10 text-center">
          <p className="eyebrow">שאלות נפוצות</p>
          <h2 className="font-display mt-3 text-[2.1rem] font-bold md:text-[2.6rem]">יש שאלות? יש תשובות.</h2>
        </Reveal>
        <Reveal>
          <Faq items={FAQ} />
        </Reveal>
      </section>

      {/* ---------- final CTA ---------- */}
      <section className="px-5 pb-24 md:px-8">
        <Reveal>
          <div className="relative mx-auto max-w-5xl overflow-hidden rounded-[36px] border border-gold/25 px-6 py-16 text-center md:py-20">
            <div className="absolute inset-0 -z-10 bg-[radial-gradient(70%_80%_at_50%_0%,rgba(212,175,55,0.22),transparent_70%),linear-gradient(180deg,#17150f,#0d0d0f)]" />
            <BadgeCheck className="mx-auto text-gold" size={34} />
            <h2 className="font-display mx-auto mt-5 max-w-2xl text-[2.2rem] leading-tight font-bold md:text-5xl">
              האדם הנכון אולי כבר <span className="gold-text">כאן.</span>
            </h2>
            <p className="mx-auto mt-4 max-w-md text-mute">שתי דקות להרשמה, חינם ובלי כרטיס אשראי, וקהילה שמחכה להכיר אתכם.</p>
            <div className="mt-8 flex flex-col justify-center gap-3 sm:flex-row">
              <Link href="/signup" className="btn-gold px-10 text-[17px]">
                הצטרפו ל־MELA
              </Link>
              <Link href="/login" className="btn-ghost px-8">
                כניסה לחשבון קיים
              </Link>
            </div>
          </div>
        </Reveal>
      </section>

      {/* ---------- footer ---------- */}
      <footer className="border-t border-line">
        <div className="mx-auto flex max-w-6xl flex-col items-center justify-between gap-4 px-5 pt-10 pb-32 text-[13px] text-mute md:flex-row md:px-8 md:pb-10">
          <div className="flex items-center gap-3">
            <Logo size="sm" />
            <span>אהבה עם שורשים</span>
          </div>
          <div className="flex gap-6">
            <a href="mailto:support@mela.app" className="hover:text-cream">
              צור קשר
            </a>
            <Link href="/login" className="hover:text-cream">
              כניסה
            </Link>
            <Link href="/signup" className="hover:text-cream">
              הרשמה
            </Link>
          </div>
          <span className="text-mute-2">© {new Date().getFullYear()} MELA</span>
        </div>
      </footer>

      {/* mobile sticky CTA */}
      <div className="fixed inset-x-0 bottom-0 z-30 bg-gradient-to-t from-ink via-ink/95 to-transparent px-5 pt-8 safe-bottom md:hidden">
        <Link href="/signup" className="btn-gold w-full text-[17px]">
          הצטרפות חינם
        </Link>
      </div>
    </div>
  );
}
