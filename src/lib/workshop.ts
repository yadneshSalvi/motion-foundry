import { buildInputHash, evaluateMechanism, knownExampleParameters, makeDefaultInput, verifyCandidate, type Candidate, type DesignInput, type SolveResult } from "@/domain";
export const TAU = Math.PI * 2;
export const degrees = (rad: number) => rad * 180 / Math.PI;
export const radians = (deg: number) => deg * Math.PI / 180;
export const formatDegrees = (rad: number) => `${degrees(rad).toFixed(1)}°`;
export type DesignRecord = { input: DesignInput; result: SolveResult; selectedId: string; provenance: "bundled" | "computed"; receipt?: string; computedAt?: string };
export function bundledRecord(): DesignRecord {
  const input = makeDefaultInput();
  const candidate: Candidate = { id: "bundled-petal-01", family: "four-bar", parameters: { ...knownExampleParameters }, verification: verifyCandidate(input, knownExampleParameters), score: 0, label: "Petal study 01" };
  return { input, result: { status: "succeeded", inputHash: buildInputHash(input), revision: 0, candidates: [candidate], reason: "Bundled example, independently rechecked on load.", evaluations: 0 }, selectedId: candidate.id, provenance: "bundled" };
}
export function revise(input: DesignInput, update: (draft: DesignInput) => void): DesignInput {
  const next = structuredClone(input); delete next.inputHash; next.revision++; update(next); return next;
}
export function applyMotionPreset(input: DesignInput, name: "gentle" | "open" | "compact"): DesignInput {
  const sizes = name === "open" ? { crankCm: 2.6, couplerCm: 7.5, rockerCm: 5.2 } : name === "compact" ? { crankCm: 1.5, couplerCm: 6.2, rockerCm: 4.5 } : { crankCm: 2, couplerCm: 7, rockerCm: 5 };
  return revise(input, draft => { const p = { ...sizes, groundCm: draft.fixedMounts.groundCm, branch: 1 as const }; draft.targetPoses = draft.targetPoses.map(t => ({ ...t, outputAngleRad: evaluateMechanism(p, t.phaseRad)?.outputAngleRad ?? t.outputAngleRad })); });
}
export function maxError(candidate: Candidate) { return Math.max(...candidate.verification.targetResiduals.map(r => degrees(r.errorRad))); }
/** An obsolete response cannot replace a newer revision, including same-input retries. */
export function acceptsResponse(expected: { generation: number; input: DesignInput }, current: { generation: number; input: DesignInput }, result: SolveResult) {
  return expected.generation === current.generation && expected.input.designId === current.input.designId && expected.input.revision === current.input.revision && result.revision === current.input.revision && buildInputHash(expected.input) === buildInputHash(current.input) && result.inputHash === buildInputHash(current.input);
}
