import { requirePageUser } from "@/lib/guard";
import { getPrompts } from "@/lib/users";
import { Stepper } from "@/components/Stepper";
import { ProfileForm } from "@/components/ProfileForm";

export default async function ProfileSetupPage({ searchParams }: { searchParams: Promise<{ edit?: string }> }) {
  const user = await requirePageUser("verified");
  const editing = !!(await searchParams).edit;
  return (
    <div className="flex flex-1 flex-col">
      {!editing && <Stepper step={2} />}
      <h1 className="font-display mt-8 text-3xl font-bold">{editing ? "עריכת פרופיל" : "בוא/י נכיר אותך"}</h1>
      <p className="mt-2 text-sm text-mute">פרופיל מלא ואמיתי מקבל פי 3 יותר התאמות.</p>
      <ProfileForm
        editing={editing}
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
    </div>
  );
}
