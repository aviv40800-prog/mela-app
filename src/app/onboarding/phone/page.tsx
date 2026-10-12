import { redirect } from "next/navigation";

// Kept for old links: signup now lives at /signup.
export default function LegacyPhonePage() {
  redirect("/signup");
}
