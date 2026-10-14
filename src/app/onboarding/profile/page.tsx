import { requirePageUser } from "@/lib/guard";
import { getPrompts } from "@/lib/users";
import { ProfileWizard } from "@/components/ProfileWizard";
import { WIZARD_STEPS, type WizardStep } from "@/lib/wizard";
import { loadChat } from "@/lib/ai-onboarding";

export default async function ProfileSetupPage({ searchParams }: { searchParams: Promise<{ edit?: string; step?: string }> }) {
  const user = await requirePageUser("verified");
  const { edit, step } = await searchParams;
  // Switching from the AI chat to the form keeps everything the conversation already filled in.
  const d = edit ? {} : loadChat(user.id).draft;
  return (
    <ProfileWizard
      editing={!!edit}
      emailLocked={user.email_verified}
      draftKey={`mela:wizard:${user.id}`}
      startStep={WIZARD_STEPS.includes(step as WizardStep) ? (step as WizardStep) : undefined}
      initial={{
        full_name: user.full_name ?? d.full_name ?? "",
        email: user.email ?? "",
        age: user.age ?? d.age ?? undefined,
        gender: user.gender ?? d.gender ?? undefined,
        seeking: user.seeking,
        location: user.location ?? d.location ?? "",
        occupation: user.occupation ?? d.occupation ?? "",
        bio: user.bio ?? d.bio ?? "",
        photos: user.photos.length ? user.photos : (d.photos ?? []),
        prompts: getPrompts(user.id).length ? getPrompts(user.id) : (d.prompts ?? []),
        pref_age_min: user.pref_age_min,
        pref_age_max: user.pref_age_max,
        pref_distance_km: user.pref_distance_km,
        religiosity: user.religiosity ?? d.religiosity ?? undefined,
        partner_religiosity: user.partner_religiosity ?? d.partner_religiosity ?? undefined,
        marital_status: user.marital_status ?? d.marital_status ?? undefined,
        looking_for: user.looking_for ?? d.looking_for ?? undefined,
      }}
    />
  );
}
