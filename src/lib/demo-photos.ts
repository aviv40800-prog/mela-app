// Photo URLs for the seeded demo profiles, grouped by gender.
//
// Left empty on purpose: drop in licensed, high‑resolution photography of Ethiopian‑Israeli /
// Habesha models (your own shoot, or stock you hold rights to) — e.g.
//   female: [["https://cdn.example.com/mela/tigist-1.jpg", "https://cdn.example.com/mela/tigist-2.jpg"], ...]
// Profiles without photos render an elegant gold monogram card instead.
// Delete data/mela.db (or run `npm run db:reset`) after editing so the seed re-runs.
export const DEMO_PHOTOS: Record<"male" | "female", string[][]> = {
  female: [],
  male: [],
};

// Two portrait photos for the landing hero (e.g. a stylish Habesha couple, one photo each). Empty → abstract hero.
export const HERO_PHOTOS: string[] = [];
