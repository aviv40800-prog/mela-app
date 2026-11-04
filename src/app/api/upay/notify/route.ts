import { handleUpayNotify } from "@/lib/upay";

/**
 * UPay's server update ("קישור לעדכון שרת"), set on the UPay payment page as
 *   https://<site>/api/upay/notify?key=<UPAY_NOTIFY_KEY>
 * Always answers 200 so UPay doesn't retry a call we've decided to reject; every call is logged.
 */
async function read(req: Request): Promise<Record<string, string>> {
  const url = new URL(req.url);
  const out: Record<string, string> = Object.fromEntries([...url.searchParams].filter(([k]) => k !== "key"));
  if (req.method !== "POST") return out;
  const type = req.headers.get("content-type") ?? "";
  try {
    const text = await req.text();
    if (type.includes("application/json") || /^\s*[{[]/.test(text)) {
      const flat = (o: unknown, pre = ""): [string, string][] =>
        o && typeof o === "object" ? Object.entries(o).flatMap(([k, v]) => flat(v, pre ? `${pre}.${k}` : k)) : [[pre, String(o)]];
      Object.assign(out, Object.fromEntries(flat(JSON.parse(text))));
    } else Object.assign(out, Object.fromEntries(new URLSearchParams(text)));
  } catch {}
  return out;
}

const clientIp = (req: Request) => req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || req.headers.get("x-real-ip") || null;

async function handle(req: Request) {
  const result = handleUpayNotify(new URL(req.url).searchParams.get("key"), await read(req), clientIp(req));
  console.log(`[upay] notify: ${result.note}`);
  return new Response("OK", { status: 200 });
}

export const POST = handle;
export const GET = handle;
