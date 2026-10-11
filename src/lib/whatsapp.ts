import "server-only";
import crypto from "node:crypto";
import { db } from "./db";
import type { User } from "./users";

type MatchPayload = {
  event: "match.created";
  match_id: number;
  matched_at: string;
  users: { id: number; full_name: string | null; phone_number: string }[];
};

function logDelivery(matchId: number, target: string, status: number | null, error: string | null) {
  db.prepare("INSERT INTO webhook_deliveries (event, match_id, target, status_code, error) VALUES ('match.created', ?, ?, ?, ?)").run(
    matchId,
    target,
    status,
    error,
  );
}

async function post(matchId: number, target: string, url: string, init: RequestInit) {
  try {
    const res = await fetch(url, { ...init, method: "POST", signal: AbortSignal.timeout(8000) });
    logDelivery(matchId, target, res.status, res.ok ? null : (await res.text()).slice(0, 500));
  } catch (err) {
    logDelivery(matchId, target, null, String(err));
  }
}

/**
 * Fired on every mutual match. Two independent channels (either, both or neither may be configured):
 *  1. WHATSAPP_WEBHOOK_URL — signed JSON POST (HMAC‑SHA256 in X-Mela-Signature) for n8n / Make / Zapier / Twilio flows.
 *  2. WhatsApp Cloud API — sends the approved template WHATSAPP_TEMPLATE_NAME to both members directly.
 * Never throws: delivery results are recorded in webhook_deliveries.
 */
export async function triggerMatchWhatsApp(matchId: number, a: User, b: User) {
  const payload: MatchPayload = {
    event: "match.created",
    match_id: matchId,
    matched_at: new Date().toISOString(),
    users: [a, b].map((u) => ({ id: u.id, full_name: u.full_name, phone_number: u.phone_number })),
  };
  const jobs: Promise<void>[] = [];

  const hookUrl = process.env.WHATSAPP_WEBHOOK_URL;
  if (hookUrl) {
    const body = JSON.stringify(payload);
    const signature = crypto
      .createHmac("sha256", process.env.WHATSAPP_WEBHOOK_SECRET ?? "")
      .update(body)
      .digest("hex");
    jobs.push(
      post(matchId, "webhook", hookUrl, {
        headers: { "Content-Type": "application/json", "X-Mela-Signature": `sha256=${signature}`, "X-Mela-Event": payload.event },
        body,
      }),
    );
  }

  const token = process.env.WHATSAPP_CLOUD_TOKEN;
  const phoneId = process.env.WHATSAPP_PHONE_NUMBER_ID;
  if (token && phoneId) {
    for (const [me, other] of [
      [a, b],
      [b, a],
    ]) {
      jobs.push(
        post(matchId, `cloud_api:${me.id}`, `https://graph.facebook.com/v21.0/${phoneId}/messages`, {
          headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
          body: JSON.stringify({
            messaging_product: "whatsapp",
            to: me.phone_number.replace("+", ""),
            type: "template",
            template: {
              name: process.env.WHATSAPP_TEMPLATE_NAME ?? "mela_new_match",
              language: { code: "he" },
              components: [{ type: "body", parameters: [{ type: "text", text: other.full_name ?? "" }] }],
            },
          }),
        }),
      );
    }
  }

  if (jobs.length === 0) console.info(`[whatsapp] match ${matchId}: no channel configured, payload=`, payload);
  await Promise.all(jobs);
}
