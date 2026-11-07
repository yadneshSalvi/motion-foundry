import { parseInput, solveDesign } from "@/domain";
import { ApiError, apiError, rateLimit, readJson, signReceipt } from "@/lib/server";
export const runtime = "nodejs";
export const maxDuration = 30;
export async function POST(request: Request) {
  try { rateLimit(request, "solve", 24); const body = await readJson(request); let input;
    try { input = parseInput(body); } catch (error) { throw new ApiError(error instanceof Error ? error.message : "Invalid design."); }
    const start = performance.now(), result = solveDesign(input), computedAt = new Date().toISOString();
    const receipt = result.status === "succeeded" ? signReceipt({ format: "motion-foundry/receipt@1.0", input, result, computedAt }) : undefined;
    return Response.json({ ...result, receipt, computedAt, elapsedMs: Math.round(performance.now() - start), cached: false }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) { return apiError(error); }
}
