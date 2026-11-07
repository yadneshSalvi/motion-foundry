import { readLoopShare } from "@/lib/loop-share";
import { createLoopPackage, createLoopSvg } from "@/lib/loop-export";
import { ApiError, apiError } from "@/lib/server";
export const runtime = "nodejs";
export async function GET(request: Request) {
  try {
    const search = new URL(request.url).searchParams, token = search.get("token"), format = search.get("format") || "json";
    if (!token || !["json", "svg"].includes(format)) throw new ApiError("A design link and JSON or SVG format are required.");
    const { input, candidate } = readLoopShare(token);
    return new Response(format === "svg" ? createLoopSvg(input, candidate) : JSON.stringify(createLoopPackage(input, candidate, "Signature checked; ordered fit and physical geometry independently reverified on download."), null, 2), { headers: { "Content-Type": format === "svg" ? "image/svg+xml" : "application/json", "Content-Disposition": `attachment; filename="motion-foundry-loop-r${input.revision}.${format}"`, "Cache-Control": "no-store" } });
  } catch (error) { return apiError(error); }
}
