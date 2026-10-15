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
  House,
  MessageCircleHeart,
  MessagesSquare,
  Sparkles,
  Target,
  ShieldCheck,
  Gem,
  UserRoundCheck,
  Users,
} from "lucide-react";
import { Logo } from "@/components/Logo";
import { HeroNetwork } from "@/components/landing/HeroNetwork";
import { PhoneMockup } from "@/components/landing/PhoneMockup";
import { Reveal } from "@/components/landing/Reveal";
import { StickyCta } from "@/components/landing/StickyCta";
import { BeanDivider, CoffeeBean } from "@/components/landing/CoffeeBean";

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
import { isAdmin } from "@/lib/admin";
import { nextOnboardingStep } from "@/lib/onboarding";
import { PLANS, TRIAL_DAYS } from "@/lib/content";
import { FREE_DAILY_LIKES } from "@/lib/quota";

const STEPS = [
  { Icon: UserRoundCheck, t: "נרשמים ומאמתים", d: "כתובת מייל, קוד אימות — ואתם בפנים. כל חבר/ה ב־MELA מאומת/ת." },
  { Icon: Coffee, t: "מספרים מי אתם", d: "תמונות, עיסוק, ושאלות מהבית: הבונה, סיגד, המשפחה, המילה באמהרית שמתארת אתכם." },
  { Icon: Gem, t: "מקבלים בחירות אישיות", d: "כל בוקר 3 התאמות שנבחרו לפי ערכים משותפים, ועוד גילוי חופשי בהחלקה." },
  { Icon: MessageCircleHeart, t: "מתחילים לדבר", d: "לייק הדדי פותח צ׳אט — עם פתיחים מהבית שעוזרים לשבור את הקרח." },
];

const FEATURES = [
  { Icon: ShieldCheck, t: "קהילה מאומתת", d: "כל פרופיל עובר אימות בקוד חד־פעמי. בלי בוטים, בלי פרופילים מזויפים." },
  { Icon: Coffee, t: "שאלות מהבית", d: "במקום ״מה התחביבים שלך״ — שאלות שרק מי שגדל בבית אתיופי־ישראלי יבין עד הסוף." },
  { Icon: Gem, t: "3 בחירות ביום", d: "פחות החלקות אינסופיות, יותר אנשים שבאמת מתאימים לכם." },
  { Icon: HeartHandshake, t: "״זה או זה?״", d: "אינג׳רה או פיתה? חתונה של 800 או אינטימית? כל תשובה מחדדת את ההתאמות." },
  { Icon: MessageCircleHeart, t: "תגובה ישירה על תשובה", d: "ראיתם תשובה שנגעה בכם? שלחו לייק עם תגובה עליה — הדרך הכי טבעית להתחיל." },
  { Icon: Bell, t: "התראה בוואטסאפ", d: "יש התאמה? תדעו מיד, ישר לוואטסאפ, בלי לפספס אף אחד.", soon: true },
];

// "על MELA" — about the product, alongside the founders' story.
const ABOUT_INTRO = [
  "כמה פעמים מצאת את עצמך גולל/ת וגולל/ת באפליקציות היכרויות, עובר/ת על מאות פרופילים שטחיים ומבזבז/ת ערבים שלמים — בלי שנוצרה אפילו שיחה אחת אמיתית? כמה פעמים זה נתקע שוב ב״היי, מה נשמע?״ שנגמר בכלום? נמאס מראיונות עבודה ומסרט נע של סווייפים? בדיוק בשביל זה הקמנו את MELA.",
  "MELA היא אפליקציית היכרויות שנבנתה כדי לשנות את כל מה שידעת על דייטינג דיגיטלי. במקום להשאיר אותך לבד מול מסך ריק, אנחנו רותמים את הטכנולוגיה החכמה ביותר כדי שתעבוד בשבילך מאחורי הקלעים — ואת הזמן שלך נשאיר לאנשים.",
];
const ABOUT_POINTS = [
  { Icon: Sparkles, t: "שדכנית חכמה בגובה העיניים", d: "בלי טפסים משעממים ופרופילים יבשים. ה־AI של MELA מנהל איתך שיחת היכרות קלילה וטבעית, לומד מי את/ה באמת — ומבין מי יקבל אותך בלב פתוח." },
  { Icon: Target, t: "איכות במקום כמות", d: "במקום להציף אותך במאות כרטיסים אקראיים, MELA מציעה התאמות מדויקות וממוקדות מראש — כאלה שיש להן סיכוי אמיתי להפוך לחיבור עמוק." },
  { Icon: MessagesSquare, t: "שוברים את הקרח בטבעיות", d: "אנחנו לא עוצרים בשידוך: רעיונות לשאלות קלילות עוזרים לעבור את המבוכה של ההתחלה ולנהל שיחה אמיתית — כזו שמובילה לדייט בעולם האמיתי." },
  { Icon: House, t: "בית חם עם שורשים", d: "MELA נבנתה במיוחד לקהילה, מתוך הבנה עמוקה של הערכים, התרבות והרצון לקשר אמיתי, יציב ומרגש." },
];

const PROMISES = [
  { Icon: EyeOff, t: "הפרטים שלך פרטיים", d: "המייל משמש רק לאימות ולעדכונים. הוא לעולם לא מוצג לחברים אחרים." },
  { Icon: Users, t: "רק אנשים אמיתיים", d: "כל פרופיל מאומת בקוד ועובר הרשמה מלאה עם תמונות ושאלות — בלי פרופילים ריקים." },
  { Icon: ShieldCheck, t: "שליטה מלאה", d: "ביטול מנוי בלחיצה מתוך הפרופיל, בלי טלפונים ובלי אותיות קטנות." },
];

const FAQ = [
  { q: "למי מיועדת MELA?", a: "לצעירות וצעירים מהקהילה האתיופית־ישראלית — ולמי שהתרבות הזו קרובה ללבו — שמחפשים קשר רציני ומשמעותי, לא עוד אפליקציה של החלקות." },
  { q: "זה באמת חינם?", a: `כן. ההרשמה והשימוש הבסיסי חינמיים לגמרי, בלי כרטיס אשראי: ${FREE_DAILY_LIKES} לייקים ביום, בחירה יומית אחת וצ׳אט מלא עם ההתאמות שלכם.` },
  { q: "מה מקבלים ב־Premium ובכמה?", a: `לייקים ללא הגבלה, כל 3 הבחירות היומיות, ולראות מי כבר אהב/ה אתכם. ₪49 לחודש או ₪119 לשלושה חודשים (כ־₪40 לחודש), עם ${TRIAL_DAYS} ימי ניסיון חינם וביטול בכל עת.` },
  { q: "למה צריך מייל?", a: "כדי לוודא שכל פרופיל שייך לאדם אמיתי. המייל משמש רק לאימות ולעדכונים — הוא לא מוצג לאף אחד." },
  { q: "איך עובדות ההתאמות?", a: "כשלשניכם יש לייק הדדי — נפתח ביניכם צ׳אט (ובקרוב תגיע גם התראה בוואטסאפ). ההמלצות היומיות מחושבות לפי תשובות ״זה או זה?״, עיר מגורים וגיל." },
  { q: "אפשר להשתמש מהמחשב?", a: "כן. MELA עובדת בכל דפדפן, ובטלפון אפשר להוסיף אותה למסך הבית ולהשתמש בה כמו באפליקציה." },
  { q: "כבר נרשמתי — איך נכנסים?", a: "לוחצים ״כניסה״, מזינים את אותו מייל ומקבלים קוד. ההתחברות נשמרת במכשיר ל־30 יום." },
];

export default async function Landing() {
  const id = await getSessionUserId();
  const user = id ? getUser(id) : null;
  // Members go straight to the app; admins can always see the public page they share.
  if (user && !user.is_banned && !isAdmin(user)) redirect(nextOnboardingStep(user));

  return (
    <div className="relative overflow-x-clip">
      {/* ---------- nav ---------- */}
      <header className="sticky top-0 z-40 border-b border-line bg-ink/90 backdrop-blur-2xl backdrop-saturate-150 supports-[backdrop-filter]:bg-ink/80">
        <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-5 md:px-8" style={{ paddingTop: "env(safe-area-inset-top)" }}>
          <Link href="/" aria-label="MELA">
            <Logo size="sm" />
          </Link>
          <nav className="hidden items-center gap-8 text-sm text-mute md:flex">
            <a href="#story" className="hover:text-cream">הסיפור</a>
            <a href="#about" className="hover:text-cream">על MELA</a>
            <a href="#how" className="hover:text-cream">איך זה עובד</a>
            <a href="#pricing" className="hover:text-cream">מחירים</a>
            <a href="#faq" className="hover:text-cream">שאלות</a>
          </nav>
          <div className="flex items-center gap-2">
            <Link href="/login" className="rounded-full px-4 py-2 text-sm text-cream/90 transition hover:bg-fg/5">
              כניסה
            </Link>
            <Link href="/signup" className="btn-gold hidden px-5 py-2.5 text-sm md:inline-flex">
              הצטרפות חינם
            </Link>
          </div>
        </div>
      </header>

      {/* ---------- hero ---------- */}
      <section className="relative overflow-hidden bg-[radial-gradient(70%_60%_at_50%_22%,rgb(120_22_36/0.55),rgb(60_8_16/0.35)_45%,transparent_80%)] md:bg-[radial-gradient(60%_70%_at_50%_25%,rgb(128_24_38/0.6),rgb(64_8_18/0.4)_45%,transparent_85%)]">
        {/* desktop: the matchmaking network fills the hero behind the text */}
        <div className="absolute inset-0 hidden md:block">
          <HeroNetwork variant="wide" heartTop={36} />
        </div>
        <div className="pointer-events-none absolute inset-0 hidden md:block" style={{ background: "radial-gradient(30% 48% at 50% 70%, rgb(18 4 7 / 0.88), rgb(18 4 7 / 0.55) 60%, transparent 85%)" }} />
        <Reveal className="relative mx-auto max-w-xl px-5 pt-6 pb-6 text-center md:pt-[380px] md:pb-24">
          <p className="eyebrow inline-flex items-center gap-2">
            <CoffeeBean size={10} rotate={-20} /> אהבה עם שורשים
          </p>
          <h1 className="font-display mt-4 text-[2.7rem] leading-[1.05] font-bold md:text-[4rem]">
            המקום שבו
            <br />
            <span className="gold-text animate-shimmer">הסיפור שלכם</span> מתחיל
          </h1>
          <p className="mx-auto mt-5 max-w-md text-[16px] leading-relaxed text-mute md:text-lg">
            אפליקציית ההיכרויות הראשונה שנבנתה במיוחד לצעירות וצעירים מהקהילה האתיופית־ישראלית — לאנשים שמחפשים קשר אמיתי, עם מישהו שמבין מאיפה הם באים.
          </p>
          <div className="mx-auto mt-5 flex max-w-md items-start gap-3 rounded-2xl border border-rose/30 bg-gradient-to-l from-rose/[0.10] to-gold/[0.05] px-4 py-3 text-right">
            <span className="mt-0.5 grid h-8 w-8 shrink-0 place-items-center rounded-xl bg-rose/15 text-rose">
              <Sparkles size={17} />
            </span>
            <p className="text-[14.5px] leading-relaxed text-cream/85">
              <b className="font-semibold text-cream">בלי טפסים משעממים.</b> שדכנית AI חכמה מכירה אותך בשיחה קצרה, כותבת לך פרופיל שנשמע בדיוק כמוך — ומציעה התאמות שבאמת מתאימות.
            </p>
          </div>
          <div className="mt-8 flex flex-col gap-3 sm:flex-row sm:justify-center">
            <Link href="/signup" data-cta className="btn-gold px-8 text-[17px]">
              הצטרפות חינם
            </Link>
            <Link href="/login" className="btn-ghost px-8">
              כבר רשום/ה? כניסה
            </Link>
          </div>
          <ul className="mt-6 flex flex-wrap justify-center gap-x-5 gap-y-2 text-[13px] text-mute">
            {["הרשמה חינם", "בלי כרטיס אשראי", "כל פרופיל מאומת"].map((t) => (
              <li key={t} className="flex items-center gap-1.5">
                <Check size={14} className="text-gold" /> {t}
              </li>
            ))}
          </ul>
        </Reveal>
        {/* phones: the network below the buttons */}
        <div className="relative mx-auto h-[480px] max-w-md md:hidden">
          <HeroNetwork variant="compact" />
        </div>
      </section>

      {/* ---------- cultural band ---------- */}
      <div className="border-y border-line bg-fg/[0.015] py-5">
        <div className="tilet mx-auto mb-4 max-w-5xl opacity-60" />
        <p className="font-display mx-auto max-w-5xl px-5 text-center text-lg text-cream/70 md:text-2xl">
          {["בונה", "סיגד", "אסקסטה", "משפחה", "שורשים", "אהבה"].map((w, i) => (
            <span key={w} className="inline-flex items-center">
              {i > 0 && <CoffeeBean size={9} rotate={i * 37} className="mx-3 inline-block md:mx-4" />}
              {w}
            </span>
          ))}
        </p>
        <div className="tilet mx-auto mt-4 max-w-5xl opacity-60" />
      </div>

      {/* ---------- story ---------- */}
      <section id="story" className="relative scroll-mt-20 overflow-hidden px-5 py-24 md:px-8 md:py-32">
        <div className="pointer-events-none absolute inset-x-0 top-0 mx-auto h-[420px] max-w-3xl bg-[radial-gradient(60%_60%_at_50%_0%,rgba(184,137,43,0.10),transparent_70%)]" />
        <div className="relative mx-auto max-w-[40rem] text-center">
          <Reveal>
            <p className="eyebrow">הסיפור שלנו</p>
            <h2 className="font-display mt-4 text-[2.6rem] leading-[1.05] font-bold md:text-[3.6rem]">
              אהבה <span className="gold-text">עם שורשים</span>
            </h2>
            <div className="gold-hairline mx-auto mt-8 w-24" />
          </Reveal>

          <div className="mt-10 space-y-6 text-[17px] leading-[1.9] text-cream/80 md:text-[18.5px]">
            {STORY_INTRO.map((t, i) => (
              <Reveal key={t} delay={0.04}>
                <p className={i === 0 ? "font-display text-[1.35rem] leading-snug text-cream md:text-[1.6rem]" : undefined}>{t}</p>
              </Reveal>
            ))}
          </div>

          <Reveal className="my-16 md:my-20">
            <BeanDivider />
            <p className="font-display mt-10 text-[2.6rem] leading-none font-bold md:text-[3.4rem]">
              הקמנו את <span className="gold-text">MELA.</span>
            </p>
            <div className="mx-auto mt-10 inline-flex items-center gap-3 rounded-full border border-gold/20 bg-gold/[0.05] px-5 py-2.5 text-[13.5px] text-cream/75">
              <span className="font-display text-xl text-gold-2" dir="ltr">
                መላ
              </span>
              באמהרית: דרך, פתרון — תמיד יש דרך
            </div>
          </Reveal>

          <Reveal className="space-y-4 text-[17px] leading-[1.9] text-cream/80 md:text-[18.5px]">
            <p className="font-display text-[1.5rem] leading-snug text-cream md:text-[1.8rem]">{STORY_WHY[0]}</p>
            <p>{STORY_WHY[1]}</p>
          </Reveal>

          <ul className="mx-auto mt-12 max-w-xl space-y-3">
            {STORY_NO_EXPLAIN.map((t, i) => (
              <Reveal key={t} delay={i * 0.08}>
                <li className="glass rounded-[22px] px-6 py-5 text-[16.5px] leading-relaxed text-cream/90 md:text-[17.5px]">{t}</li>
              </Reveal>
            ))}
          </ul>

          <Reveal className="mt-12 space-y-4 text-[17px] leading-[1.9] text-cream/80 md:text-[18.5px]">
            {STORY_CLOSE.map((t, i) => (
              <p key={t} className={i === 0 ? "font-semibold text-cream" : undefined}>
                {t}
              </p>
            ))}
          </Reveal>

          <Reveal className="mt-14">
            <p className="font-display mx-auto max-w-lg text-[1.75rem] leading-snug text-gold-2 md:text-[2.2rem]">זה הזמן להפסיק להתפשר על מי שלא מבינה את מי שאתה.</p>
            <Link href="/signup" data-cta className="btn-gold mt-9 w-full px-12 text-[17px] sm:w-auto">
              הצטרפות חינם
            </Link>
          </Reveal>
        </div>
      </section>

      {/* ---------- about ---------- */}
      <section id="about" className="relative scroll-mt-20 overflow-hidden border-t border-line px-5 py-20 md:px-8 md:py-28">
        <div className="pointer-events-none absolute inset-x-0 top-0 mx-auto h-[380px] max-w-3xl bg-[radial-gradient(60%_60%_at_50%_0%,rgba(229,56,59,0.12),transparent_70%)]" />
        <div className="relative mx-auto max-w-6xl">
          <Reveal className="mx-auto max-w-2xl text-center">
            <p className="eyebrow">על MELA</p>
            <h2 className="font-display mt-3 text-[2.1rem] leading-tight font-bold md:text-[2.8rem]">
              החיבור החכם שלך <span className="gold-text">לאהבה אמיתית</span>
            </h2>
            <div className="gold-hairline mx-auto mt-7 w-24" />
          </Reveal>
          <div className="mx-auto mt-9 max-w-[40rem] space-y-5 text-center text-[17px] leading-[1.9] text-cream/80 md:text-[18px]">
            {ABOUT_INTRO.map((t) => (
              <Reveal key={t}>
                <p>{t}</p>
              </Reveal>
            ))}
          </div>
          <Reveal className="mt-14 text-center">
            <h3 className="font-display text-[1.5rem] font-bold md:text-[1.8rem]">מה עושה את MELA אחרת</h3>
          </Reveal>
          <ul className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {ABOUT_POINTS.map(({ Icon, t, d }, i) => (
              <Reveal key={t} delay={i * 0.08}>
                <li className="surface h-full rounded-[26px] p-6 text-center">
                  <span className="mx-auto grid h-12 w-12 place-items-center rounded-2xl border border-rose/30 bg-rose/[0.08] text-rose">
                    <Icon size={22} />
                  </span>
                  <h4 className="mt-5 text-lg font-semibold">{t}</h4>
                  <p className="mt-2 text-[14.5px] leading-relaxed text-mute">{d}</p>
                </li>
              </Reveal>
            ))}
          </ul>
          <Reveal className="mx-auto mt-14 max-w-2xl text-center">
            <p className="text-[17px] leading-relaxed text-cream/80 md:text-[18px]">בסוף, אנחנו לא כאן כדי שתעבירו את הזמן בגלילה אינסופית.</p>
            <p className="font-display mt-2 text-[1.9rem] leading-snug font-bold text-gold-2 md:text-[2.4rem]">אנחנו כאן כדי שתמצאו אהבה.</p>
          </Reveal>
        </div>
      </section>

      {/* ---------- how it works ---------- */}
      <section id="how" className="scroll-mt-20 border-t border-line bg-gradient-to-b from-fg/[0.02] to-transparent">
        <div className="mx-auto max-w-6xl px-5 py-20 md:px-8 md:py-28">
          <Reveal className="mx-auto max-w-2xl text-center">
            <p className="eyebrow">איך זה עובד</p>
            <h2 className="font-display mt-3 text-[2.1rem] leading-tight font-bold md:text-[2.8rem]">ארבעה צעדים עד השיחה הראשונה</h2>
          </Reveal>
          <ol className="mt-14 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {STEPS.map(({ Icon, t, d }, i) => (
              <Reveal key={t} delay={i * 0.08}>
                <li className="surface relative h-full rounded-[26px] p-6 text-center">
                  <span className="tabular absolute top-5 left-5 font-display text-4xl font-bold text-gold/15">{i + 1}</span>
                  <span className="mx-auto grid h-12 w-12 place-items-center rounded-2xl border border-gold/25 bg-gold/[0.08] text-gold-2">
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
              {FEATURES.map(({ Icon, t, d, soon }, i) => (
                <Reveal key={t} delay={i * 0.05}>
                  <div className="flex gap-4">
                    <span className={`grid h-11 w-11 shrink-0 place-items-center rounded-xl border border-gold/25 bg-gold/[0.07] text-gold-2 ${soon ? "opacity-60" : ""}`}>
                      <Icon size={20} />
                    </span>
                    <div>
                      <h3 className="flex flex-wrap items-center gap-2 font-semibold">
                        {t}
                        {soon && <SoonBadge />}
                      </h3>
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
      <section className="border-y border-line bg-fg/[0.015]">
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
          <p className="mx-auto mt-4 max-w-lg text-mute">נרשמים בחינם ובלי כרטיס אשראי. רוצים יותר? משדרגים ל־Premium מתוך האפליקציה, מתי שמתאים לכם.</p>
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
                    {f.includes("וואטסאפ") && <SoonBadge />}
                  </li>
                ))}
              </ul>
              <Link href="/signup" className="btn-gold mt-8 w-full">
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
                    <span className="absolute -top-3.5 right-7 flex items-center gap-1 rounded-full bg-gradient-to-l from-gold-2 to-gold px-3 py-1 text-[12px] font-bold text-[#2a1c12] shadow-lg">
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
                  <p className="mt-8 rounded-2xl border border-line-2 px-4 py-3 text-center text-[13px] text-mute">שדרוג מתוך האפליקציה, בכל רגע</p>
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
          <div className="leather on-dark relative isolate mx-auto max-w-5xl overflow-hidden rounded-[36px] border border-gold/25 px-6 py-16 text-center shadow-[var(--shadow-float)] md:py-20">
            <BadgeCheck className="mx-auto text-gold" size={34} />
            <h2 className="font-display mx-auto mt-5 max-w-2xl text-[2.2rem] leading-tight font-bold md:text-5xl">
              האדם הנכון אולי כבר <span className="emboss">כאן.</span>
            </h2>
            <p className="mx-auto mt-4 max-w-md text-mute">שתי דקות להרשמה, חינם ובלי כרטיס אשראי, וקהילה שמחכה להכיר אתכם.</p>
            <div className="mt-8 flex flex-col justify-center gap-3 sm:flex-row">
              <Link href="/signup" data-cta className="btn-gold px-10 text-[17px]">
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

      <StickyCta />
    </div>
  );
}

/** "Coming soon" sticker for features that aren't live yet. */
function SoonBadge() {
  return (
    <span className="inline-flex -rotate-3 items-center rounded-full border border-rose/50 bg-rose/15 px-2 py-0.5 text-[11px] leading-none font-bold tracking-wide text-[#ffb3b8] shadow-[0_0_14px_rgb(255_77_90/0.25)]">
      בקרוב
    </span>
  );
}
