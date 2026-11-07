import { buildLoopInputHash, knownLoopParameters, makeDefaultLoopInput, resampleClosedStroke, verifyLoopCandidate, type LoopInput, type LoopSolveResult } from "@/domain/loop";
import type { Vec2 } from "@/domain";
export type LoopRecord = { input: LoopInput; result: LoopSolveResult; selectedId: string; provenance: "bundled" | "computed"; receipt?: string; computedAt?: string };
/** Fixed input-capture precision. The solver and export never rescale or round again. */
export function normalizeStroke(points: readonly Vec2[], count = 64): Vec2[] {
  return resampleClosedStroke(points, count).map(p => ({ x: Math.round(p.x * 1000) / 1000, y: Math.round(p.y * 1000) / 1000 }));
}
export function bundledLoopRecord(): LoopRecord {
  const input = makeDefaultLoopInput(); input.stroke = normalizeStroke(input.stroke);
  const parameters = { ...knownLoopParameters }, verification = verifyLoopCandidate(input, parameters);
  const candidate = { id: "bundled-loop-01", family: "four-bar-coupler" as const, parameters, verification, score: verification.rmsFitErrorCm, label: "Reference loop" };
  return { input, result: { status: "succeeded", candidates: [candidate], inputHash: buildLoopInputHash(input), revision: input.revision, reason: "Known-mechanism reference, independently checked on load.", evaluations: 0 }, selectedId: candidate.id, provenance: "bundled" };
}
export function reviseLoop(input: LoopInput, edit: (draft: LoopInput) => void): LoopInput {
  const next = structuredClone(input); delete next.inputHash; next.revision++; edit(next); return next;
}
export function acceptsLoopResponse(expected: { input: LoopInput; generation: number }, current: { input: LoopInput; generation: number }, result: LoopSolveResult) {
  return expected.generation === current.generation && expected.input.designId === current.input.designId && expected.input.revision === current.input.revision && result.revision === current.input.revision && buildLoopInputHash(expected.input) === buildLoopInputHash(current.input) && result.inputHash === buildLoopInputHash(current.input);
}
export const LOOP_BOARD = { minX: -4, maxX: 13, minY: -6, maxY: 11 };
