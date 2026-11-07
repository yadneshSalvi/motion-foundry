import { checkedLoopDesign } from "@/lib/loop-share";
import { createLoopPackage, createLoopSvg } from "@/lib/loop-export";
import { ApiError, apiError, readJson, verifyReceipt } from "@/lib/server";
export const runtime = "nodejs";
export async function POST(request: Request) {
  try {
    const body = await readJson(request, 90000) as { receipt?: string; candidateId?: string; format?: string };
    if (!body || typeof body !== "object" || typeof body.receipt !== "string" || typeof body.candidateId !== "string") throw new ApiError("A signed loop receipt and selected candidate are required.");
    if (body.format !== undefined && body.format !== "json" && body.format !== "svg") throw new ApiError("Choose JSON or SVG export.");
    const payload = verifyReceipt(body.receipt) as { format?: string; input: unknown; candidates?: { id: string }[] };
    if (payload?.format !== "motion-foundry/loop-receipt@1") throw new ApiError("A loop solve receipt is required.");
    const { input, candidate } = checkedLoopDesign(payload.input, payload.candidates?.find(c => c.id === body.candidateId));
    const svg = body.format === "svg", output = svg ? createLoopSvg(input, candidate) : JSON.stringify(createLoopPackage(input, candidate, "Server-signed solve receipt; geometry independently revalidated on export."), null, 2);
    return new Response(output, { headers: { "Content-Type": svg ? "image/svg+xml" : "application/json", "Content-Disposition": `attachment; filename="motion-foundry-loop-r${input.revision}.${svg ? "svg" : "json"}"`, "Cache-Control": "no-store" } });
  } catch (error) { return apiError(error); }
}
