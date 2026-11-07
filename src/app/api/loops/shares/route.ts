import QRCode from "qrcode";
import { buildLoopInputHash } from "@/domain/loop";
import { checkedLoopDesign, createLoopShare } from "@/lib/loop-share";
import { ApiError, apiError, rateLimit, readJson, verifyReceipt } from "@/lib/server";
export const runtime = "nodejs";
export async function POST(request: Request) {
  try {
    rateLimit(request, "solve", 24);
    const body = await readJson(request, 90000) as { receipt?: string; candidateId?: string; input?: unknown; candidate?: unknown };
    if (!body || typeof body !== "object" || Array.isArray(body)) throw new ApiError("Select a loop design.");
    let rawInput = body.input, rawCandidate = body.candidate;
    if (body.receipt !== undefined) {
      if (typeof body.receipt !== "string" || typeof body.candidateId !== "string") throw new ApiError("Invalid receipt or candidate.");
      const payload = verifyReceipt(body.receipt) as { format?: string; input: unknown; candidates?: { id: string }[] };
      if (payload?.format !== "motion-foundry/loop-receipt@1") throw new ApiError("A loop solve receipt is required.");
      rawInput = payload.input; rawCandidate = payload.candidates?.find(c => c.id === body.candidateId);
    }
    const { input, candidate } = checkedLoopDesign(rawInput, rawCandidate), token = createLoopShare(input, candidate);
    const origin = (process.env.BACKEND_BASE_URL || new URL(request.url).origin).replace(/\/$/, ""), url = `${origin}/design/loop/${token}`;
    const qr = url.length < 2800 ? QRCode.create(url, { errorCorrectionLevel: "L" }) : null;
    return Response.json({ url, code: buildLoopInputHash(input).slice(-8), revision: input.revision, qr: qr ? { size: qr.modules.size, data: Array.from(qr.modules.data) } : null, lifetime: "No scheduled expiry. Available while this service and its signing key are maintained." }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) { return apiError(error); }
}
