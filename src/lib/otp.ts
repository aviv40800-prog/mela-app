import "server-only";
import crypto from "node:crypto";
import { db } from "./db";

const TTL_MS = 5 * 60 * 1000;
const MAX_ATTEMPTS = 5;

function hash(phone: string, code: string) {
  return crypto.createHash("sha256").update(`${phone}:${code}`).digest("hex");
}

export async function issueOtp(phone: string): Promise<{ devCode?: string }> {
  const code = String(crypto.randomInt(0, 1_000_000)).padStart(6, "0");
  db.prepare(
    `INSERT INTO otp_codes (phone_number, code_hash, expires_at, attempts) VALUES (?, ?, ?, 0)
     ON CONFLICT(phone_number) DO UPDATE SET code_hash = excluded.code_hash, expires_at = excluded.expires_at, attempts = 0`,
  ).run(phone, hash(phone, code), Date.now() + TTL_MS);

  await sendSms(phone, `קוד האימות שלך ל־MELA: ${code}`);
  // In dev (console provider) we hand the code back so the flow can be tested without SMS.
  return (process.env.SMS_PROVIDER ?? "console") === "console" && process.env.NODE_ENV !== "production"
    ? { devCode: code }
    : {};
}

export type OtpResult = "ok" | "invalid" | "expired" | "locked";

export function verifyOtp(phone: string, code: string): OtpResult {
  const row = db.prepare("SELECT code_hash, expires_at, attempts FROM otp_codes WHERE phone_number = ?").get(phone) as
    | { code_hash: string; expires_at: number; attempts: number }
    | undefined;
  if (!row) return "expired";
  if (row.attempts >= MAX_ATTEMPTS) return "locked";
  if (row.expires_at < Date.now()) return "expired";
  const a = Buffer.from(row.code_hash, "hex");
  const b = Buffer.from(hash(phone, code), "hex");
  if (!crypto.timingSafeEqual(a, b)) {
    db.prepare("UPDATE otp_codes SET attempts = attempts + 1 WHERE phone_number = ?").run(phone);
    return "invalid";
  }
  db.prepare("DELETE FROM otp_codes WHERE phone_number = ?").run(phone);
  return "ok";
}

async function sendSms(to: string, body: string) {
  const provider = process.env.SMS_PROVIDER ?? "console";
  if (provider === "twilio") {
    const sid = process.env.TWILIO_ACCOUNT_SID!;
    const auth = Buffer.from(`${sid}:${process.env.TWILIO_AUTH_TOKEN}`).toString("base64");
    const res = await fetch(`https://api.twilio.com/2010-04-01/Accounts/${sid}/Messages.json`, {
      method: "POST",
      headers: { Authorization: `Basic ${auth}`, "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({ To: to, From: process.env.TWILIO_FROM_NUMBER!, Body: body }),
    });
    if (!res.ok) throw new Error(`SMS send failed: ${res.status}`);
    return;
  }
  console.info(`[sms:console] to=${to} body="${body}"`);
}
