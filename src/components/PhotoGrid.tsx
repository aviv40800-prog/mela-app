"use client";

import { useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { Camera, ImagePlus, Plus, RotateCw, Star, X } from "lucide-react";
import { compressImage, uploadPhoto } from "@/lib/upload";
import { haptic } from "@/lib/client";

export type Tile = { key: string; url?: string; preview?: string; progress: number; error?: string };

const MAX = 6;
const ACCEPT = ["image/jpeg", "image/png", "image/webp"];

export function tilesFromUrls(urls: string[]): Tile[] {
  return urls.map((url) => ({ key: url, url, progress: 1 }));
}

/**
 * Hinge-style photo grid: large main photo + 5 slots. Drop files anywhere on the grid, drag tiles to reorder
 * (desktop) or tap ★ to make a photo the main one. Uploads show an on-device preview under a shimmer + progress ring.
 */
export function PhotoGrid({ tiles, onChange }: { tiles: Tile[]; onChange: (update: (t: Tile[]) => Tile[]) => void }) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [dropping, setDropping] = useState(false);
  const [dragKey, setDragKey] = useState<string | null>(null);

  const patch = (key: string, p: Partial<Tile>) => onChange((ts) => ts.map((t) => (t.key === key ? { ...t, ...p } : t)));

  async function start(tile: Tile, file: File) {
    try {
      const blob = await compressImage(file);
      const url = await uploadPhoto(blob, (progress) => patch(tile.key, { progress: Math.min(progress, 0.98) }));
      // Preload the served image so the swap from preview is seamless.
      await new Promise((r) => {
        const img = new Image();
        img.onload = img.onerror = r;
        img.src = url;
      });
      patch(tile.key, { url, progress: 1 });
      haptic(10);
    } catch (e) {
      patch(tile.key, { error: (e as Error).message, progress: 0 });
    }
  }

  function add(files: FileList | File[] | null) {
    if (!files) return;
    const room = MAX - tiles.length;
    const accepted = Array.from(files)
      .filter((f) => ACCEPT.includes(f.type))
      .slice(0, room);
    if (!accepted.length) return;
    const fresh: [Tile, File][] = accepted.map((f) => [{ key: crypto.randomUUID(), preview: URL.createObjectURL(f), progress: 0.04 }, f]);
    onChange((ts) => [...ts, ...fresh.map(([t]) => t)]);
    fresh.forEach(([t, f]) => void start(t, f));
    if (fileRef.current) fileRef.current.value = "";
  }

  function retry(tile: Tile) {
    // The original File is gone; ask the member to pick it again.
    onChange((ts) => ts.filter((t) => t.key !== tile.key));
    fileRef.current?.click();
  }

  const move = (from: string, to: string) =>
    onChange((ts) => {
      const a = ts.findIndex((t) => t.key === from);
      const b = ts.findIndex((t) => t.key === to);
      if (a < 0 || b < 0 || a === b) return ts;
      const next = [...ts];
      const [item] = next.splice(a, 1);
      next.splice(b, 0, item);
      return next;
    });

  const slots = Array.from({ length: MAX }, (_, i) => tiles[i] ?? null);

  return (
    <div>
      <div
        onDragOver={(e) => {
          if (e.dataTransfer.types.includes("Files")) {
            e.preventDefault();
            setDropping(true);
          }
        }}
        onDragLeave={(e) => !e.currentTarget.contains(e.relatedTarget as Node) && setDropping(false)}
        onDrop={(e) => {
          if (!e.dataTransfer.files.length) return;
          e.preventDefault();
          setDropping(false);
          add(e.dataTransfer.files);
        }}
        className={`relative grid aspect-square grid-cols-3 grid-rows-3 gap-2.5 rounded-[28px] transition-all duration-300 ${
          dropping ? "ring-gold scale-[0.99] bg-gold/[0.04]" : ""
        }`}
      >
        {slots.map((tile, i) => {
          const main = i === 0;
          const span = main ? "col-span-2 row-span-2" : "";
          if (!tile) {
            const isNext = i === tiles.length;
            return (
              <motion.button
                layout
                key={`empty-${i}`}
                type="button"
                onClick={() => fileRef.current?.click()}
                whileTap={{ scale: 0.95 }}
                className={`${span} group relative grid place-items-center overflow-hidden rounded-[22px] border border-dashed transition-colors ${
                  isNext ? "border-gold/40 bg-gold/[0.035] text-gold" : "border-fg/10 bg-fg/[0.02] text-mute-2"
                } hover:border-gold/60 hover:text-gold`}
                aria-label={main ? "הוספת תמונה ראשית" : "הוספת תמונה"}
              >
                {main ? (
                  <span className="flex flex-col items-center gap-2 text-center">
                    <span className="grid h-14 w-14 place-items-center rounded-full bg-gold/10 transition-transform duration-300 group-hover:scale-110">
                      <Camera size={24} />
                    </span>
                    <span className="text-sm font-medium">תמונה ראשית</span>
                    <span className="text-[11px] text-mute">גררו לכאן או הקישו</span>
                  </span>
                ) : (
                  <Plus size={22} className="transition-transform duration-300 group-hover:rotate-90" />
                )}
              </motion.button>
            );
          }

          const uploading = !tile.url && !tile.error;
          const src = tile.url ?? tile.preview;
          return (
            <motion.div
              layout
              key={tile.key}
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: dragKey === tile.key ? 0.5 : 1, scale: 1 }}
              transition={{ type: "spring", stiffness: 420, damping: 32 }}
              draggable={!!tile.url}
              onDragStartCapture={(e: React.DragEvent) => {
                setDragKey(tile.key);
                e.dataTransfer.effectAllowed = "move";
              }}
              onDragEndCapture={() => setDragKey(null)}
              onDragOverCapture={(e: React.DragEvent) => dragKey && e.preventDefault()}
              onDropCapture={(e: React.DragEvent) => {
                if (dragKey) {
                  e.preventDefault();
                  e.stopPropagation();
                  move(dragKey, tile.key);
                  setDragKey(null);
                }
              }}
              className={`${span} relative overflow-hidden rounded-[22px] bg-ink-3 shadow-[0_10px_30px_-14px_rgba(90,52,26,0.27)] ${
                main ? "ring-1 ring-gold/50" : "ring-1 ring-fg/5"
              } ${tile.url ? "cursor-grab active:cursor-grabbing" : ""}`}
            >
              {src && (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={src}
                  alt=""
                  draggable={false}
                  className={`h-full w-full object-cover transition-[filter,transform] duration-700 ${uploading ? "scale-105 blur-md brightness-75" : ""}`}
                />
              )}

              {uploading && (
                <>
                  <div className="skeleton absolute inset-0 !bg-transparent" />
                  <ProgressRing value={tile.progress} />
                </>
              )}

              {tile.error && (
                <button type="button" onClick={() => retry(tile)} className="absolute inset-0 grid place-items-center bg-ink/80 p-2 text-center text-[11px] text-danger">
                  <span className="flex flex-col items-center gap-1">
                    <RotateCw size={18} />
                    {tile.error}
                  </span>
                </button>
              )}

              {main && tile.url && (
                <span className="on-dark absolute right-2.5 bottom-2.5 rounded-full bg-black/55 px-2.5 py-1 text-[10px] font-semibold text-gold-2 backdrop-blur">
                  תמונה ראשית
                </span>
              )}

              {!uploading && (
                <div className="absolute top-2 left-2 flex gap-1.5">
                  <IconChip label="הסרת תמונה" onClick={() => onChange((ts) => ts.filter((t) => t.key !== tile.key))}>
                    <X size={13} />
                  </IconChip>
                  {!main && tile.url && (
                    <IconChip label="קביעה כתמונה ראשית" onClick={() => move(tile.key, tiles[0].key)}>
                      <Star size={12} />
                    </IconChip>
                  )}
                </div>
              )}
            </motion.div>
          );
        })}

        <AnimatePresence>
          {dropping && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="pointer-events-none absolute inset-0 grid place-items-center rounded-[28px] bg-ink/70 backdrop-blur-sm"
            >
              <span className="flex flex-col items-center gap-2 text-gold-2">
                <ImagePlus size={30} />
                <span className="text-sm font-medium">שחררו כדי להעלות</span>
              </span>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      <input ref={fileRef} type="file" accept={ACCEPT.join(",")} multiple hidden onChange={(e) => add(e.target.files)} />
      <p className="mt-3 px-1 text-[11.5px] text-mute-2">טיפ: תמונות טבעיות באור יום, עם חיוך ובלי משקפי שמש, מקבלות הכי הרבה לייקים. ★ קובע תמונה ראשית.</p>
    </div>
  );
}

function IconChip({ children, label, onClick }: { children: React.ReactNode; label: string; onClick: () => void }) {
  return (
    <motion.button
      type="button"
      whileTap={{ scale: 0.85 }}
      onClick={onClick}
      aria-label={label}
      className="on-dark grid h-7 w-7 place-items-center rounded-full bg-black/55 text-cream backdrop-blur-md transition hover:bg-black/75"
    >
      {children}
    </motion.button>
  );
}

function ProgressRing({ value }: { value: number }) {
  const r = 16;
  const c = 2 * Math.PI * r;
  return (
    <div className="absolute inset-0 grid place-items-center">
      <svg width="44" height="44" viewBox="0 0 44 44" className="-rotate-90 drop-shadow-[0_0_8px_rgba(180,87,58,0.6)]">
        <circle cx="22" cy="22" r={r} fill="rgba(90,52,26,0.135)" stroke="rgba(70,42,24,0.15)" strokeWidth="3" />
        <motion.circle
          cx="22"
          cy="22"
          r={r}
          fill="none"
          stroke="#c46a48"
          strokeWidth="3"
          strokeLinecap="round"
          strokeDasharray={c}
          animate={{ strokeDashoffset: c * (1 - value) }}
          transition={{ type: "spring", stiffness: 80, damping: 20 }}
        />
      </svg>
    </div>
  );
}
