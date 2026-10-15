import Link from "next/link";
import { ShieldAlert } from "lucide-react";
import { SITE } from "@/lib/site";

export default function SuspendedPage() {
  return (
    <main className="mx-auto grid min-h-dvh max-w-md place-items-center px-8 text-center">
      <div>
        <div className="mx-auto grid h-16 w-16 place-items-center rounded-full bg-danger/10 text-danger">
          <ShieldAlert size={28} />
        </div>
        <h1 className="font-display mt-6 text-2xl font-bold">החשבון הושעה</h1>
        <p className="mt-3 text-sm leading-relaxed text-mute">החשבון שלך הושעה בעקבות דיווח או הפרה של כללי הקהילה. לבירור אפשר לפנות אלינו במייל {SITE.email}.</p>
        <Link href="/" className="btn-ghost mt-8">
          לדף הבית
        </Link>
      </div>
    </main>
  );
}
