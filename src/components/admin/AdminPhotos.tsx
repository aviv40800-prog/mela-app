"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2, Plus, Star, X } from "lucide-react";
import { api } from "@/lib/client";
import { compressImage } from "@/lib/upload";

/** Admin photo manager for any member: upload (multiple), remove, make main. */
export function AdminPhotos({ userId, initial, name }: { userId: number; initial: string[]; name: string }) {
  const router = useRouter();
  const [photos, setPhotos] = useState(initial);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const input = useRef<HTMLInputElement>(null);

  async function save(next: string[]) {
    setPhotos(next);
    await api(`/api/admin/users/${userId}`, { method: "PATCH", json: { photos: next } }).catch((e) => setErr((e as Error).message));
    router.refresh();
  }

  async function upload(files: FileList | null) {
    if (!files?.length) return;
    setBusy(true);
    setErr(null);
    try {
      for (const f of Array.from(files).slice(0, 6 - photos.length)) {
        const body = new FormData();
        body.append("file", await compressImage(f), "photo.jpg");
        const res = await api<{ photos: string[] }>(`/api/admin/users/${userId}/photos`, { method: "POST", body });
        setPhotos(res.photos);
      }
      router.refresh();
    } catch (e) {
      setErr((e as Error).message);
    } finally {
      setBusy(false);
      if (input.current) input.current.value = "";
    }
  }

  return (
    <div>
      <div className="grid grid-cols-3 gap-2.5 sm:grid-cols-6">
        {photos.map((p, i) => (
          <div key={p} className={`group relative aspect-[3/4] overflow-hidden rounded-2xl ${i === 0 ? "ring-2 ring-gold/60" : "ring-1 ring-white/10"}`}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={p} alt={name} className="h-full w-full object-cover" />
            <div className="absolute inset-x-0 top-0 flex justify-between p-1.5 opacity-100 transition sm:opacity-0 sm:group-hover:opacity-100">
              <button onClick={() => save(photos.filter((x) => x !== p))} className="grid h-7 w-7 place-items-center rounded-full bg-black/60 backdrop-blur" aria-label="הסרה">
                <X size={13} />
              </button>
              {i > 0 && (
                <button onClick={() => save([p, ...photos.filter((x) => x !== p)])} className="grid h-7 w-7 place-items-center rounded-full bg-black/60 backdrop-blur" aria-label="קביעה כראשית">
                  <Star size={12} />
                </button>
              )}
            </div>
          </div>
        ))}
        {photos.length < 6 && (
          <button
            onClick={() => input.current?.click()}
            disabled={busy}
            className="grid aspect-[3/4] place-items-center rounded-2xl border border-dashed border-gold/40 bg-gold/[0.03] text-gold transition hover:border-gold/70"
            aria-label="העלאת תמונות"
          >
            {busy ? <Loader2 className="animate-spin" /> : <Plus />}
          </button>
        )}
      </div>
      <input ref={input} type="file" accept="image/jpeg,image/png,image/webp" multiple hidden onChange={(e) => upload(e.target.files)} />
      {err && <p className="mt-2 text-sm text-danger">{err}</p>}
    </div>
  );
}
