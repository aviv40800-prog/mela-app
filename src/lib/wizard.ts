// Shared (server + client) — profile wizard step ids, also used for ?step= deep links.
export const WIZARD_STEPS = ["photos", "basics", "looking", "about", "prompts", "quiz"] as const;
export type WizardStep = (typeof WIZARD_STEPS)[number];
