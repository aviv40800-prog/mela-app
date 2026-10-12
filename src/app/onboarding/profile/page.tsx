import { requirePageUser } from "@/lib/guard";
import { getPrompts } from "@/lib/users";
import { ProfileWizard } from "@/components/ProfileWizard";
import { WIZARD_STEPS, type WizardStep } from "@/lib/wizard";

export default async function ProfileSetupPage({ searchParams }: { searchParams: Promise<{ edit?: string; step?: string }> }) {
  const user = await requirePageUser("verified");
  const { edit, step } = await searchParams;
  return (
    <ProfileWizard
      editing={!!edit}
      startStep={WIZARD_STEPS.includes(step as WizardStep) ? (step as WizardStep) : undefined}
      initial={{
        full_name: user.full_name ?? "",
        email: user.email ?? "",
        age: user.age ?? undefined,
        gender: user.gender ?? undefined,
        seeking: user.seeking,
        location: user.location ?? "",
        occupation: user.occupation ?? "",
        bio: user.bio ?? "",
        photos: user.photos,
        prompts: getPrompts(user.id),
      }}
    />
  );
}
