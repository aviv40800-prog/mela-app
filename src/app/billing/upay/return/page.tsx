import Link from "next/link";
import { Logo } from "@/components/Logo";

export const metadata = { title: "התשלום התקבל · MELA" };

/** Where UPay sends the member's browser after paying ("קישור לדף החזרה"). Premium itself is turned on by the server update. */
export default function UpayReturn() {
  return (
    <main className="mx-auto flex min-h-dvh max-w-md flex-col items-center justify-center px-6 text-center">
      <Logo size="sm" />
      <div className="mt-10 text-5xl">💛</div>
      <h1 className="mt-5 font-display text-[2rem] leading-tight font-bold">
        ברוך הבא ל־<span className="gold-text">Premium</span>
      </h1>
      <p className="mt-3 text-[15px] leading-relaxed text-mute">התשלום התקבל. Premium נפתח בחשבון שלך תוך דקה, ואפשר להתחיל: לייקים ללא הגבלה, כל הבחירות היומיות, ולראות מי אהב/ה אותך.</p>
      <Link href="/discover" className="btn-gold mt-9 w-full">
        להתחיל
      </Link>
      <p className="mt-4 text-[12.5px] text-mute-2">לא רואים Premium אחרי כמה דקות? כתבו לנו ונסדר את זה מיד.</p>
    </main>
  );
}
