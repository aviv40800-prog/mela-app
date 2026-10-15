import "server-only";
import crypto from "node:crypto";

/**
 * Tranzila API v2 client: authentication only, for now.
 *
 * Every request carries four headers. The access token is an HMAC-SHA256 of the public app key, keyed with
 * secret + request time (Unix seconds) + nonce (40 random bytes as 80 hex chars).
 *
 * Credentials come from the environment (never from code): TRANZILA_APP_KEY, TRANZILA_SECRET, TRANZILA_TERMINAL.
 */

export const TRANZILA_API = process.env.TRANZILA_API_URL ?? "https://api.tranzila.com/v1";

export function tranzilaConfigured(): boolean {
  return !!(process.env.TRANZILA_APP_KEY && process.env.TRANZILA_SECRET && process.env.TRANZILA_TERMINAL);
}

export function tranzilaTerminal(): string {
  const t = process.env.TRANZILA_TERMINAL;
  if (!t) throw new Error("TRANZILA_TERMINAL is not set");
  return t;
}

/** The four auth headers. `now` and `nonce` are injectable for tests. */
export function tranzilaHeaders(
  appKey = process.env.TRANZILA_APP_KEY ?? "",
  secret = process.env.TRANZILA_SECRET ?? "",
  now: number = Math.floor(Date.now() / 1000),
  nonce: string = crypto.randomBytes(40).toString("hex"),
): Record<string, string> {
  if (!appKey || !secret) throw new Error("Tranzila credentials are not set (TRANZILA_APP_KEY / TRANZILA_SECRET)");
  const accessToken = crypto.createHmac("sha256", secret + String(now) + nonce).update(appKey).digest("hex");
  return {
    "X-tranzila-api-app-key": appKey,
    "X-tranzila-api-request-time": String(now),
    "X-tranzila-api-nonce": nonce,
    "X-tranzila-api-access-token": accessToken,
  };
}

export class TranzilaError extends Error {
  constructor(
    readonly status: number,
    readonly body: unknown,
  ) {
    super(`Tranzila API ${status}`);
  }
}

/** POST a JSON body to an API v2 path (e.g. "/transaction/credit_card/create") and return the parsed reply. */
export async function tranzilaPost<T = unknown>(path: string, body: unknown): Promise<T> {
  const res = await fetch(`${TRANZILA_API}${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Accept: "application/json", ...tranzilaHeaders() },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(20_000),
  });
  const data = await res.json().catch(() => null);
  if (!res.ok) throw new TranzilaError(res.status, data);
  return data as T;
}
