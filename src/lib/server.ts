import { createHmac, timingSafeEqual } from "node:crypto";
export class ApiError extends Error { constructor(message: string, public status = 400) { super(message); } }
export async function readJson(request: Request, maxBytes = 24000): Promise<unknown> {
  if (!request.headers.get("content-type")?.includes("application/json")) throw new ApiError("Send application/json.", 415);
  if (Number(request.headers.get("content-length") || 0) > maxBytes) throw new ApiError("Request is too large.", 413);
  const reader = request.body?.getReader(); if (!reader) throw new ApiError("A JSON body is required.");
  const chunks: Uint8Array[] = []; let length = 0;
  while (true) { const { done, value } = await reader.read(); if (done) break; length += value.byteLength; if (length > maxBytes) { await reader.cancel(); throw new ApiError("Request is too large.", 413); } chunks.push(value); }
  try { return JSON.parse(Buffer.concat(chunks).toString("utf8")); } catch { throw new ApiError("Malformed JSON."); }
}
export function apiError(error: unknown): Response { return Response.json({ error: error instanceof ApiError ? error.message : "The request could not be completed. Please try again." }, { status: error instanceof ApiError ? error.status : 500 }); }
function signingKey(): string {
  const key = process.env.MOTION_SIGNING_SECRET; if (key && key.length >= 32) return key;
  if (process.env.VERCEL || process.env.NODE_ENV === "production") throw new ApiError("Result signing is not configured.", 503);
  return "motion-foundry-local-development-receipts-only";
}
export function signReceipt(payload: unknown): string { const body = Buffer.from(JSON.stringify(payload)).toString("base64url"); return `${body}.${createHmac("sha256", signingKey()).update(body).digest("base64url")}`; }
export function verifyReceipt(token: string): unknown {
  if (typeof token !== "string" || token.length > 80000) throw new ApiError("Invalid receipt."); const parts = token.split("."); if (parts.length !== 2) throw new ApiError("Invalid receipt.");
  const [body, signature] = parts, expected = createHmac("sha256", signingKey()).update(body).digest(), supplied = Buffer.from(signature, "base64url");
  if (supplied.length !== expected.length || !timingSafeEqual(supplied, expected)) throw new ApiError("Receipt signature does not match.", 403);
  try { return JSON.parse(Buffer.from(body, "base64url").toString("utf8")); } catch { throw new ApiError("Invalid receipt."); }
}
// Per-instance abuse guard, not a distributed quota. Every solver/model call is also bounded.
const budgets = new Map<string, { count: number; until: number }>();
export function rateLimit(request: Request, kind: "solve" | "intent", max: number): void {
  const origin = request.headers.get("origin"); if (kind === "intent" && origin && origin !== new URL(request.url).origin) throw new ApiError("Use the Motion Foundry workshop to request a proposal.", 403);
  const ip = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "local", key = `${kind}:${ip}`, now = Date.now(), budget = budgets.get(key);
  if (budget && budget.until > now) { if (budget.count >= max) throw new ApiError("Give the workshop a moment, then try again.", 429); budget.count++; } else budgets.set(key, { count: 1, until: now + 60000 });
  if (budgets.size > 4000) for (const [id, value] of budgets) if (value.until < now) budgets.delete(id);
}
