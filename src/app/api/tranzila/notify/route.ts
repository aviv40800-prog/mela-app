import { handleNotify } from "@/lib/payments";

/**
 * Tranzila's notify (server to server). Configure it in the terminal's iFrame settings as
 *   https://<site>/api/tranzila/notify?key=<TRANZILA_NOTIFY_KEY>
 * It always answers 200 so Tranzila doesn't retry a request we've decided to reject; every call is logged.
 */
export async function POST(req: Request) {
  const key = new URL(req.url).searchParams.get("key");
  const type = req.headers.get("content-type") ?? "";
  let payload: Record<string, string> = {};
  try {
    if (type.includes("application/json")) payload = Object.fromEntries(Object.entries(await req.json()).map(([k, v]) => [k, String(v)]));
    else payload = Object.fromEntries([...new URLSearchParams(await req.text())]);
  } catch {
    payload = {};
  }
  const result = handleNotify(key, payload, clientIp(req));
  console.log(`[tranzila] notify ${result.ok ? "accepted" : "rejected"}: ${result.note}`);
  return new Response("OK", { status: 200 });
}

/** The caller's IP as Railway's proxy reports it. */
function clientIp(req: Request) {
  return req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || req.headers.get("x-real-ip") || null;
}

export async function GET(req: Request) {
  const url = new URL(req.url);
  const payload = Object.fromEntries([...url.searchParams].filter(([k]) => k !== "key"));
  const result = handleNotify(url.searchParams.get("key"), payload, clientIp(req));
  console.log(`[tranzila] notify (GET) ${result.ok ? "accepted" : "rejected"}: ${result.note}`);
  return new Response("OK", { status: 200 });
}
