import { SITE } from "@/lib/site";

/** The "last updated" line under a legal page's title. */
export function LegalUpdated() {
  return <p className="!mt-2 text-sm text-mute">עודכן לאחרונה: {SITE.legalUpdated}</p>;
}
