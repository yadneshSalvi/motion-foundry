import { deflateRawSync, inflateRawSync } from "node:zlib";
import { z } from "zod";
import { parseLoopInput, verifyLoopCandidate, type LoopCandidate, type LoopInput } from "@/domain/loop";
import { ApiError, signReceipt, verifyReceipt } from "./server";
const parameters = z.object({ groundCm: z.number().positive().max(10000), crankCm: z.number().positive().max(10000), couplerCm: z.number().positive().max(10000), rockerCm: z.number().positive().max(10000), branch: z.union([z.literal(1), z.literal(-1)]), attachmentAlongCm: z.number().min(-10000).max(10000), attachmentAcrossCm: z.number().min(-10000).max(10000), startingPhaseRad: z.number().min(-10000).max(10000), driveDirection: z.union([z.literal(1), z.literal(-1)]) }).strict();
export function checkedLoopDesign(rawInput: unknown, rawCandidate: unknown): { input: LoopInput; candidate: LoopCandidate } {
  let input: LoopInput; try { input = parseLoopInput(rawInput); } catch { throw new ApiError("Invalid loop inputs."); }
  const c = rawCandidate as LoopCandidate;
  if (!c || typeof c.id !== "string" || !c.id.length || c.id.length > 150) throw new ApiError("Select a loop mechanism.");
  const parsed = parameters.safeParse(c.parameters); if (!parsed.success) throw new ApiError("Invalid loop mechanism dimensions.");
  const verification = verifyLoopCandidate(input, parsed.data);
  if (!verification.valid) throw new ApiError("The mechanism does not pass this drawing and its constraints.");
  return { input, candidate: { id: c.id, family: "four-bar-coupler", parameters: parsed.data, verification, score: verification.rmsFitErrorCm, label: typeof c.label === "string" ? c.label.slice(0, 100) : "Loop mechanism" } };
}
/** Lossless packing only: never round the canonical drawing during export. */
export function createLoopShare(input: LoopInput, candidate: LoopCandidate): string {
  const { stroke, ...rest } = input; let x = 0, y = 0;
  const exact = stroke.every(p => Math.round(p.x * 1000) / 1000 === p.x && Math.round(p.y * 1000) / 1000 === p.y);
  const drawing = exact ? { encoding: "delta-0.001cm", points: stroke.flatMap(p => { const nx = Math.round(p.x * 1000), ny = Math.round(p.y * 1000), pair = [nx - x, ny - y]; x = nx; y = ny; return pair; }) } : { encoding: "json", points: stroke };
  const payload = JSON.stringify({ input: rest, drawing, candidate: { id: candidate.id, label: candidate.label, parameters: candidate.parameters } });
  const tooLarge = () => new ApiError("This drawing is too large for a share link. Download its JSON package instead.", 413);
  if (Buffer.byteLength(payload, "utf8") > 24000) throw tooLarge();
  const token = signReceipt({ format: "motion-foundry/loop-share@1", packed: deflateRawSync(payload, { level: 9 }).toString("base64url") });
  if (token.length > 12000) throw tooLarge(); return token;
}
export function readLoopShare(token: string) {
  if (typeof token !== "string" || token.length > 12000) throw new ApiError("Invalid loop link.");
  const value = verifyReceipt(token) as { format?: string; packed?: string };
  if (value?.format !== "motion-foundry/loop-share@1" || typeof value.packed !== "string") throw new ApiError("A loop design link is required.");
  try {
    const data = JSON.parse(inflateRawSync(Buffer.from(value.packed, "base64url"), { maxOutputLength: 24000 }).toString("utf8")); let stroke;
    if (data.drawing.encoding === "json") stroke = data.drawing.points;
    else if (data.drawing.encoding === "delta-0.001cm") {
      const values = data.drawing.points; if (!Array.isArray(values) || values.length < 24 || values.length > 4096 || values.length % 2 || !values.every(v => Number.isSafeInteger(v) && Math.abs(v) <= 20000000)) throw Error();
      let x = 0, y = 0; stroke = []; for (let i = 0; i < values.length; i += 2) { x += values[i]; y += values[i + 1]; stroke.push({ x: x / 1000, y: y / 1000 }); }
    } else throw Error();
    return checkedLoopDesign({ ...data.input, stroke }, data.candidate);
  } catch (error) { if (error instanceof ApiError) throw error; throw new ApiError("Invalid loop package."); }
}
