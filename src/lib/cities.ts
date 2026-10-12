// Israeli cities with approximate coordinates (city centre, ±1–2 km) — used for distance filtering and
// as suggestions in the city field. Members may type any other place; unknown places skip distance filters.
export const CITIES: Record<string, [number, number]> = {
  "תל אביב": [32.0853, 34.7818],
  ירושלים: [31.7683, 35.2137],
  חיפה: [32.794, 34.9896],
  "ראשון לציון": [31.973, 34.7925],
  "פתח תקווה": [32.084, 34.8878],
  אשדוד: [31.8044, 34.6553],
  נתניה: [32.3215, 34.8532],
  "באר שבע": [31.252, 34.7915],
  חולון: [32.0158, 34.7874],
  "בני ברק": [32.0807, 34.8338],
  "רמת גן": [32.0684, 34.8248],
  גבעתיים: [32.0722, 34.8125],
  "בת ים": [32.0231, 34.7503],
  רחובות: [31.8928, 34.8113],
  אשקלון: [31.6688, 34.5743],
  הרצליה: [32.1624, 34.8447],
  "כפר סבא": [32.175, 34.907],
  רעננה: [32.1848, 34.8713],
  "הוד השרון": [32.15, 34.888],
  "ראש העין": [32.0956, 34.9566],
  חדרה: [32.434, 34.9196],
  "מודיעין": [31.898, 35.0104],
  לוד: [31.951, 34.8953],
  רמלה: [31.9279, 34.8625],
  "נס ציונה": [31.9293, 34.7987],
  יבנה: [31.8781, 34.7398],
  גדרה: [31.8137, 34.7786],
  "קריית גת": [31.61, 34.7642],
  "קריית מלאכי": [31.7317, 34.7461],
  "אור יהודה": [32.0293, 34.8467],
  "בית שמש": [31.747, 34.9881],
  עפולה: [32.6078, 35.2897],
  "נוף הגליל": [32.7056, 35.327],
  "מגדל העמק": [32.676, 35.239],
  "יקנעם": [32.659, 35.105],
  "קריית אתא": [32.809, 35.105],
  "קריית ביאליק": [32.8275, 35.0858],
  "קריית ים": [32.8496, 35.069],
  עכו: [32.9281, 35.082],
  נהריה: [33.0089, 35.0981],
  טבריה: [32.7922, 35.5312],
  "בית שאן": [32.497, 35.497],
  "קריית שמונה": [33.2073, 35.5703],
  נתיבות: [31.421, 34.5885],
  שדרות: [31.525, 34.5961],
  אופקים: [31.3141, 34.6203],
  דימונה: [31.07, 35.0333],
  ערד: [31.261, 35.214],
  אילת: [29.5577, 34.9519],
};

export const CITY_NAMES = Object.keys(CITIES);

const norm = (s: string) => s.replace(/[\s״"'\-־]/g, "").replace(/^קרית/, "קריית");

/** Approximate road-agnostic distance in km between two city names; null when either is unknown. */
export function cityDistanceKm(a: string | null | undefined, b: string | null | undefined): number | null {
  if (!a || !b) return null;
  const find = (s: string) => {
    const n = norm(s);
    const key = CITY_NAMES.find((c) => norm(c) === n);
    return key ? CITIES[key] : null;
  };
  const p = find(a);
  const q = find(b);
  if (!p || !q) return null;
  const R = 6371;
  const rad = (x: number) => (x * Math.PI) / 180;
  const dLat = rad(q[0] - p[0]);
  const dLng = rad(q[1] - p[1]);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(rad(p[0])) * Math.cos(rad(q[0])) * Math.sin(dLng / 2) ** 2;
  return Math.round(2 * R * Math.asin(Math.sqrt(h)));
}
