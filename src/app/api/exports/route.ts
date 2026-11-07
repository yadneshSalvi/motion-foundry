import { parseInput, type SolveResult } from "@/domain";
import { createAssemblySvg, createDesignPackage } from "@/lib/export";
import { ApiError, apiError, readJson, verifyReceipt } from "@/lib/server";
export const runtime = "nodejs";
export async function POST(request: Request) {
  try {
    const body = await readJson(request, 90000) as { receipt?: string; candidateId?: string; format?: string };
    if (!body || typeof body !== "object" || Array.isArray(body)) throw new ApiError("A JSON object is required.");
    if (typeof body.receipt !== "string" || typeof body.candidateId !== "string") throw new ApiError("A signed solve receipt and selected candidate are required.");
    if (body.format !== undefined && body.format !== "json" && body.format !== "svg") throw new ApiError("Choose JSON or SVG export.");
    const payload = verifyReceipt(body.receipt) as { format?: string; input: unknown; result: SolveResult; computedAt: string };
    if (payload?.format !== "motion-foundry/receipt@1.0" || !payload.result?.candidates) throw new ApiError("A solve receipt is required.");
    const input = parseInput(payload.input);
    const candidate = payload.result.candidates.find(c => c.id === body.candidateId); if (!candidate) throw new ApiError("That candidate is not part of this solve.");
    const filename = `motion-foundry-r${input.revision}`;
    if (body.format === "svg") return new Response(createAssemblySvg(input, candidate), { headers: { "Content-Type": "image/svg+xml", "Content-Disposition": `attachment; filename="${filename}.svg"`, "Cache-Control": "no-store" } });
    return Response.json(createDesignPackage(input, candidate, `Computed ${payload.computedAt}; signed receipt verified on export.`), { headers: { "Content-Disposition": `attachment; filename="${filename}.json"`, "Cache-Control": "no-store" } });
  } catch (error) { return apiError(error); }
}
