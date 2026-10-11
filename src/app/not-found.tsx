import Link from "next/link";

export default function NotFound() {
  return (
    <main className="grid min-h-dvh place-items-center px-8 text-center">
      <div>
        <p className="font-display gold-text text-6xl font-bold">404</p>
        <p className="mt-3 text-mute">העמוד לא נמצא</p>
        <Link href="/" className="btn-gold mt-8">
          חזרה הביתה
        </Link>
      </div>
    </main>
  );
}
