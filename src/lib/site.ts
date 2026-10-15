/** Public contact details and links, shown in the footer, the legal pages and error messages. */
export const SITE = {
  name: "MELA",
  /** Who operates the service, as named in the legal pages (until there is a registered business). */
  operator: "MELA",
  email: "datemela1@gmail.com",
  instagram: "https://www.instagram.com/mela_dating",
  facebook: "https://www.facebook.com/share/1CrUjvVLg6/",
  /** Effective date of the current terms / privacy policy. */
  legalUpdated: "15.10.2026",
} as const;

export const LEGAL_LINKS = [
  { href: "/terms", label: "תקנון ותנאי שימוש" },
  { href: "/privacy", label: "מדיניות פרטיות" },
  { href: "/cancellation", label: "ביטול מנוי והחזרים" },
  { href: "/safety", label: "דייט בטוח" },
  { href: "/accessibility", label: "הצהרת נגישות" },
] as const;
