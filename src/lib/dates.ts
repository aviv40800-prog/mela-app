import "server-only";
import { db } from "./db";
import { CITIES, CITY_NAMES, cityDistanceKm } from "./cities";
import { ALL_QUESTIONS } from "./content";
import type { User } from "./users";

/**
 * Date planner: three date ideas for a matched pair, scored against what both answered in the quizzes
 * and where they live. Places are public landmarks and neighbourhoods (never specific businesses), so
 * every suggestion stays true no matter what opens or closes.
 */

export type Vibe = "heritage" | "coffee" | "food" | "nature" | "active" | "city" | "night" | "calm" | "culture";
export type Region = "center" | "jerusalem" | "north" | "south" | "sharon";
export type DateKind = "coffee" | "meal" | "outdoor" | "evening" | "culture";

export type DateIdea = {
  id: string;
  kind: DateKind;
  title: string;
  place: string;
  when: string;
  pitch: string;
  /** Why this idea fits *these two* — written from their shared answers. */
  reason: string;
};

export type DatePlan = { region: Region; regionLabel: string; meetCity: string | null; distanceKm: number | null; ideas: DateIdea[]; vibes: Vibe[] };

// Which side of each question leans toward which vibe.
const VIBE_MAP: Record<string, { a?: Vibe[]; b?: Vibe[] }> = {
  coffee: { a: ["heritage", "coffee"], b: ["coffee", "city"] },
  bread: { a: ["heritage", "food"] },
  weekend: { a: ["calm"], b: ["night", "city"] },
  music: { a: ["heritage", "night"], b: ["night"] },
  vacation: { a: ["nature", "calm"], b: ["city", "night"] },
  shabbat: { a: ["heritage", "calm"], b: ["nature"] },
  dance: { a: ["night", "heritage"], b: ["calm"] },
  sport: { a: ["active"], b: ["active", "nature"] },
  trip: { a: ["heritage", "culture"], b: ["city"] },
  dinner: { a: ["heritage", "food"], b: ["food"] },
  city: { a: ["city"], b: ["culture"] },
  morning: { a: ["coffee", "active"], b: ["night"] },
  cooking: { a: ["food", "calm"], b: ["food", "city"] },
  fitness: { a: ["active"] },
  dream_home: { a: ["city"], b: ["nature"] },
  night_out: { a: ["night"], b: ["calm"] },
  screen: { a: ["culture", "calm"], b: ["calm"] },
  ethiopian_food: { a: ["heritage", "food"] },
  home_music: { a: ["heritage"] },
  buna_ritual: { a: ["heritage", "coffee"] },
  aliyah_story: { a: ["heritage", "culture"] },
  sigd_where: { a: ["heritage"] },
  travel: { a: ["culture"], b: ["nature"] },
};

const REGIONS: Record<Region, { label: string; cities: string[] }> = {
  center: {
    label: "גוש דן",
    cities: ["תל אביב", "ראשון לציון", "פתח תקווה", "חולון", "בני ברק", "רמת גן", "גבעתיים", "בת ים", "רחובות", "לוד", "רמלה", "נס ציונה", "יבנה", "אור יהודה", "ראש העין", "מודיעין", "גדרה"],
  },
  jerusalem: { label: "ירושלים והסביבה", cities: ["ירושלים", "בית שמש"] },
  north: {
    label: "חיפה והצפון",
    cities: ["חיפה", "עפולה", "נוף הגליל", "מגדל העמק", "יקנעם", "קריית אתא", "קריית ביאליק", "קריית ים", "עכו", "נהריה", "טבריה", "בית שאן", "קריית שמונה"],
  },
  south: { label: "הדרום", cities: ["באר שבע", "אשדוד", "אשקלון", "קריית גת", "קריית מלאכי", "נתיבות", "שדרות", "אופקים", "דימונה", "ערד", "אילת"] },
  sharon: { label: "השרון", cities: ["נתניה", "הרצליה", "כפר סבא", "רעננה", "הוד השרון", "חדרה"] },
};

type CatalogIdea = Omit<DateIdea, "reason"> & { vibes: Vibe[]; regions: Region[] | "any" };

const CATALOG: CatalogIdea[] = [
  // — heritage & coffee —
  { id: "buna-home", kind: "coffee", vibes: ["heritage", "coffee", "calm"], regions: "any", title: "טקס בונה בשלושה סבבים", place: "בית קפה אתיופי בשכונה, או אצל מי שיש לו/ה ג׳בנה", when: "שישי בצהריים", pitch: "אבול, תונה, בראקה — שלושה סבבים זה בדיוק הזמן להכיר באמת. מי שמכין/ה מספר/ת על הבונה של סבתא." },
  { id: "levinsky-tlv", kind: "coffee", vibes: ["coffee", "city", "food"], regions: ["center"], title: "סיבוב טעימות בשוק לוינסקי", place: "שוק לוינסקי, תל אביב", when: "שישי בבוקר", pitch: "תבלינים, בורקס וקפה במעמד — וכל אחד/ת בוחר/ת עצירה אחת שהשני/ה לא מכיר/ה." },
  { id: "mahane-yehuda", kind: "meal", vibes: ["food", "city", "night"], regions: ["jerusalem"], title: "מחנה יהודה — מהדוכנים לבר", place: "שוק מחנה יהודה, ירושלים", when: "חמישי בערב", pitch: "בערב הדוכנים נסגרים והשוק נהיה מתחם ברים. מתחילים בטעימה, נשארים למוזיקה." },
  { id: "injera-dinner", kind: "meal", vibes: ["heritage", "food"], regions: "any", title: "ערב אינג׳רה ודורו וואט", place: "מסעדה אתיופית בעיר — או מטבח של אחד/ת מכם", when: "ערב באמצע השבוע", pitch: "אוכלים מצלחת אחת, עם הידיים, כמו בבית. גורשה ראשונה — מי מעז/ה?" },
  { id: "cook-together", kind: "meal", vibes: ["food", "calm", "heritage"], regions: "any", title: "מבשלים מתכון של סבתא", place: "שוק מקומי לקניות, ואז מטבח", when: "שבת בצהריים", pitch: "כל אחד/ת מביא/ה מתכון מהבית. קונים יחד בשוק ומבשלים — הכי טוב לראות איך מישהו/י מתנהל/ת במטבח." },
  { id: "sigd-promenade", kind: "culture", vibes: ["heritage", "culture", "calm"], regions: ["jerusalem"], title: "שקיעה בטיילת ארמון הנציב", place: "טיילת ארמון הנציב (טיילת שרובר), ירושלים", when: "שעה לפני השקיעה", pitch: "המקום של תפילת הסיגד, עם נוף לעיר העתיקה. מביאים תרמוס בונה ומספרים את סיפורי העלייה של המשפחות." },
  { id: "museum-night", kind: "culture", vibes: ["culture", "city", "calm"], regions: ["center", "jerusalem", "north"], title: "ערב במוזיאון", place: "מוזיאון ישראל בירושלים / מוזיאון תל אביב / מוזיאון חיפה לאמנות", when: "שלישי בערב", pitch: "בוחרים כל אחד/ת יצירה אחת שמספרת משהו עליכם — ומסבירים למה. שיחה עמוקה בלי לחץ." },
  // — outdoors & active —
  { id: "jaffa-sunset", kind: "outdoor", vibes: ["nature", "calm", "city"], regions: ["center"], title: "שקיעה בנמל יפו", place: "נמל יפו וגבעת העלייה", when: "שקיעה, ואז ארוחה קלה", pitch: "הולכים מהטיילת לנמל, עוצרים לגלידה, ונשארים לראות את השמש נעלמת בים." },
  { id: "yarkon-bikes", kind: "outdoor", vibes: ["active", "nature"], regions: ["center"], title: "אופניים בפארק הירקון", place: "פארק הירקון — מגני יהושע עד הנמל", when: "שבת בבוקר", pitch: "אופניים שכורים, קפה בסוף המסלול. מסתבר שהרבה יותר קל לדבר כשרוכבים זה לצד זה." },
  { id: "ein-kerem", kind: "outdoor", vibes: ["nature", "calm", "culture"], regions: ["jerusalem"], title: "סמטאות עין כרם", place: "עין כרם, ירושלים", when: "שישי אחר הצהריים", pitch: "סמטאות אבן, מעיין וכנסיות על ההר. הליכה רגועה ובית קפה קטן בסוף." },
  { id: "carmel-trail", kind: "outdoor", vibes: ["nature", "active"], regions: ["north"], title: "מסלול בכרמל עם תצפית למפרץ", place: "שמורת הכרמל — מסלול נחל כלח", when: "שבת בבוקר", pitch: "מסלול קצר ויפה, סנדוויצ׳ים בתיק ותצפית שמצדיקה כל עלייה." },
  { id: "german-colony", kind: "evening", vibes: ["city", "night", "food"], regions: ["north"], title: "ערב במושבה הגרמנית", place: "שדרות בן גוריון, חיפה — מול הגנים הבהאיים", when: "חמישי בערב", pitch: "השדרה מוארת, המדרגות של הגנים מעל, ושפע מקומות לשבת. מתחילים בטיול ונשארים לקינוח." },
  { id: "beach-walk", kind: "outdoor", vibes: ["nature", "calm", "active"], regions: ["center", "sharon", "south", "north"], title: "הליכה על החוף בשקיעה", place: "טיילת החוף הקרובה — אשדוד, נתניה, בת ים או הרצליה", when: "שעה לפני השקיעה", pitch: "נעליים ביד, רגליים במים. אין שקט יותר טוב לדייט ראשון מאשר רעש של גלים." },
  { id: "negev-stars", kind: "outdoor", vibes: ["nature", "calm"], regions: ["south"], title: "לילה של כוכבים במכתש", place: "מצפה רמון — תצפית שפת המכתש", when: "ערב בלי ירח", pitch: "שמיכה, תרמוס ושמיים שאי אפשר לראות מהעיר. נסיעה ארוכה — שווה כל דקה." },
  { id: "beersheva-old", kind: "evening", vibes: ["city", "food", "culture"], regions: ["south"], title: "ערב בעיר העתיקה של באר שבע", place: "רחוב סמילנסקי והעיר העתיקה, באר שבע", when: "חמישי בערב", pitch: "בתים עות׳מאניים, ברים קטנים ואווירה של עיר סטודנטים. מושלם לשיחה ארוכה." },
  { id: "sharon-park", kind: "outdoor", vibes: ["nature", "active", "calm"], regions: ["sharon"], title: "פיקניק בפארק רעננה", place: "פארק רעננה, ליד האגם", when: "שישי אחר הצהריים", pitch: "שמיכה על הדשא, פירות ובונה בתרמוס. פשוט, נעים ובלי שעון." },
  { id: "padel", kind: "outdoor", vibes: ["active", "city"], regions: "any", title: "משחק פאדל זוגי", place: "מגרש פאדל בעיר — שעה אחת", when: "ערב באמצע השבוע", pitch: "קצת תחרות, הרבה צחוק, ושייק אחרי. דרך מצוינת לשבור את הקרח." },
  // — evenings —
  { id: "eskista-night", kind: "evening", vibes: ["night", "heritage"], regions: ["center", "jerusalem", "south"], title: "ערב מוזיקה אתיופית", place: "ערב אתיו־ג׳אז או מסיבת אסקסטה בעיר", when: "חמישי בלילה", pitch: "כתפיים, קצב וטדי אפרו. מי שזז/ה ראשון/ה — מזמין/ה סיבוב." },
  { id: "jazz-bar", kind: "evening", vibes: ["night", "city", "culture"], regions: ["center", "jerusalem", "north"], title: "הופעה חיה בבר קטן", place: "בר עם הופעה חיה במרכז העיר", when: "רביעי בערב", pitch: "מוזיקה ברקע, שולחן קטן, ומספיק שקט בין השירים בשביל לדבר." },
  { id: "rooftop", kind: "evening", vibes: ["city", "night", "calm"], regions: ["center", "sharon"], title: "קוקטייל על גג", place: "גג עם נוף לעיר", when: "שקיעה באמצע השבוע", pitch: "שני משקאות, נוף לקו הרקיע, ואופציה להמשיך לארוחה אם הולך טוב." },
  { id: "cinema", kind: "culture", vibes: ["culture", "calm"], regions: "any", title: "סרט בסינמטק ואז קפה", place: "הסינמטק הקרוב — תל אביב, ירושלים, חיפה או שדרות", when: "ערב באמצע השבוע", pitch: "סרט טוב נותן נושא לשיחה. הכלל: אסור לדבר על העבודה עד שמסיימים לנתח את הסוף." },
  { id: "pottery", kind: "culture", vibes: ["culture", "calm", "active"], regions: "any", title: "סדנת קרמיקה לזוגות", place: "סטודיו לקרמיקה בעיר", when: "שישי בבוקר", pitch: "ידיים בחימר, לכלוך מותר. בסוף כל אחד/ת לוקח/ת הביתה את הספל של השני/ה." },
];

const KIND_LABEL: Record<DateKind, string> = { coffee: "קפה", meal: "ארוחה", outdoor: "בחוץ", evening: "ערב", culture: "תרבות" };
export const dateKindLabel = (k: DateKind) => KIND_LABEL[k];

function regionOf(city: string | null): Region | null {
  if (!city) return null;
  const n = city.replace(/[\s״"'\-־]/g, "");
  for (const [r, def] of Object.entries(REGIONS) as [Region, (typeof REGIONS)[Region]][]) {
    if (def.cities.some((c) => c.replace(/[\s״"'\-־]/g, "") === n)) return r;
  }
  return null;
}

/** The known city closest to the midpoint of two places — a fair place to meet. */
function meetingCity(a: string | null, b: string | null): string | null {
  const find = (s: string | null) => (s ? CITY_NAMES.find((c) => c.replace(/\s/g, "") === s.replace(/\s/g, "")) ?? null : null);
  const ka = find(a);
  const kb = find(b);
  if (!ka || !kb) return ka ?? kb;
  if (ka === kb) return ka;
  const mid: [number, number] = [(CITIES[ka][0] + CITIES[kb][0]) / 2, (CITIES[ka][1] + CITIES[kb][1]) / 2];
  // Prefer cities that are a natural meeting point (bigger hubs first) when they're near the midpoint.
  let best = ka;
  let bestD = Infinity;
  for (const c of CITY_NAMES) {
    const d = Math.hypot(CITIES[c][0] - mid[0], (CITIES[c][1] - mid[1]) * 0.85);
    if (d < bestD) {
      bestD = d;
      best = c;
    }
  }
  return best;
}

function answers(userId: number): Map<string, "a" | "b"> {
  const rows = db.prepare("SELECT question_key, choice FROM quiz_answers WHERE user_id = ?").all(userId) as { question_key: string; choice: "a" | "b" }[];
  return new Map(rows.map((r) => [r.question_key, r.choice]));
}

/** A small deterministic PRNG so the same pair sees the same ideas until they ask for more. */
function rng(seed: number) {
  let s = seed >>> 0 || 1;
  return () => {
    s ^= s << 13;
    s ^= s >>> 17;
    s ^= s << 5;
    return ((s >>> 0) % 10_000) / 10_000;
  };
}

export function datePlan(me: User, other: User, round = 0): DatePlan {
  const mine = answers(me.id);
  const theirs = answers(other.id);

  // Vibe scores: a vibe both of you lean toward counts double; one-sided leanings count once.
  const score = new Map<Vibe, number>();
  const sharedLabels = new Map<Vibe, string>();
  for (const [key, map] of Object.entries(VIBE_MAP)) {
    const x = mine.get(key);
    const y = theirs.get(key);
    const q = ALL_QUESTIONS.find((qq) => qq.key === key);
    for (const side of ["a", "b"] as const) {
      const vibes = map[side] ?? [];
      const n = (x === side ? 1 : 0) + (y === side ? 1 : 0);
      if (!n) continue;
      for (const v of vibes) {
        score.set(v, (score.get(v) ?? 0) + (n === 2 ? 3 : 1));
        if (n === 2 && q && !sharedLabels.has(v)) sharedLabels.set(v, q[side]);
      }
    }
  }

  const meet = meetingCity(me.location, other.location);
  const region = regionOf(meet) ?? regionOf(me.location) ?? regionOf(other.location) ?? "center";
  const distanceKm = cityDistanceKm(me.location, other.location);

  const rand = rng(me.id * 7919 + other.id * 104_729 + Math.min(me.id, other.id));
  const ranked = CATALOG.filter((i) => i.regions === "any" || i.regions.includes(region))
    .map((i) => {
      const fit = i.vibes.reduce((a, v, idx) => a + (score.get(v) ?? 0) * (idx === 0 ? 1.4 : 1), 0);
      const local = i.regions === "any" ? 0 : 1.5;
      return { i, s: fit + local + rand() * 2 };
    })
    .sort((a, b) => b.s - a.s)
    .map((x) => x.i);

  // Three different kinds of date so the options actually feel different.
  const pickThree = (pool: CatalogIdea[]) => {
    const out: CatalogIdea[] = [];
    for (const i of pool) if (out.length < 3 && !out.some((p) => p.kind === i.kind)) out.push(i);
    for (const i of pool) if (out.length < 3 && !out.includes(i)) out.push(i);
    return out;
  };
  // "More ideas" walks down the ranking without repeating, and starts over once the list runs out.
  let seen = new Set<string>();
  let picked = pickThree(ranked);
  for (let r = 0; r < round; r++) {
    picked.forEach((i) => seen.add(i.id));
    let pool = ranked.filter((i) => !seen.has(i.id));
    if (pool.length < 3) {
      seen = new Set(picked.map((i) => i.id));
      pool = ranked.filter((i) => !seen.has(i.id));
    }
    picked = pickThree(pool);
  }

  const first = other.full_name?.split(" ")[0] ?? "";
  const reasonFor = (idea: CatalogIdea): string => {
    for (const v of idea.vibes) {
      const label = sharedLabels.get(v);
      if (label) return `שניכם בחרתם ״${label}״`;
    }
    const top = idea.vibes.find((v) => (score.get(v) ?? 0) > 0);
    if (top) return VIBE_REASON[top](first);
    return idea.regions === "any" ? "עובד בכל עיר, בלי תכנון מסובך" : `קרוב — ב${REGIONS[region].label}`;
  };

  const vibes = [...score.entries()].sort((a, b) => b[1] - a[1]).slice(0, 3).map(([v]) => v);
  return {
    region,
    regionLabel: REGIONS[region].label,
    meetCity: meet,
    distanceKm,
    vibes,
    ideas: picked.map(({ vibes: _v, regions: _r, ...rest }) => ({ ...rest, reason: reasonFor({ vibes: _v, regions: _r, ...rest }) })),
  };
}

const VIBE_REASON: Record<Vibe, (name: string) => string> = {
  heritage: () => "חיבור לבית — משהו ששניכם מכירים מהילדות",
  coffee: () => "שניכם אנשים של קפה",
  food: () => "אוכל טוב הוא שפה משותפת",
  nature: (n) => (n ? `${n} אוהב/ת טבע ושקט` : "בשביל מי שאוהב/ת טבע"),
  active: () => "בשביל מי שלא יושב/ת במקום",
  city: () => "אנרגיה של עיר",
  night: () => "בשביל מי שהלילה צעיר אצלו",
  calm: () => "רגוע, אינטימי ובלי רעש",
  culture: () => "נותן נושא לשיחה מהרגע הראשון",
};
