import { parseLoopInput, solveLoop } from "@/domain/loop";
import { ApiError, apiError, rateLimit, readJson, signReceipt } from "@/lib/server";
export const runtime = "nodejs";
export const maxDuration = 30;
export async function POST(request: Request) {
  try {
    rateLimit(request, "solve", 24);
    let input; try { input = parseLoopInput(await readJson(request)); } catch (error) { if (error instanceof ApiError) throw error; throw new ApiError(error instanceof Error ? error.message : "Invalid loop inputs."); }
    const start = performance.now(), result = solveLoop(input), computedAt = new Date().toISOString();
    const receipt = result.status === "succeeded" ? signReceipt({ format: "motion-foundry/loop-receipt@1", input, candidates: result.candidates.map(c => ({ id: c.id, label: c.label, parameters: c.parameters })) }) : undefined;
    return Response.json({ ...result, receipt, computedAt, elapsedMs: performance.now() - start, cached: false }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) { return apiError(error); }
}
