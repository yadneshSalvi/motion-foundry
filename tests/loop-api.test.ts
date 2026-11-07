import { afterEach, describe, expect, it, vi } from "vitest";
import { deflateRawSync } from "node:zlib";
import { POST as solve } from "../src/app/api/loops/solve/route";
import { POST as share } from "../src/app/api/loops/shares/route";
import { POST as exportDesign } from "../src/app/api/loops/exports/route";
import { GET as download } from "../src/app/api/loops/download/route";
import { buildLoopInputHash, evaluateCouplerPoint, makeDefaultLoopInput, knownLoopParameters, verifyLoopCandidate } from "../src/domain/loop";
import { acceptsLoopResponse, bundledLoopRecord, reviseLoop } from "../src/lib/loop-workshop";
import { createLoopPackage, createLoopSvg } from "../src/lib/loop-export";
import { checkedLoopDesign, createLoopShare, readLoopShare } from "../src/lib/loop-share";
import { bundledRecord } from "../src/lib/workshop";
import { createShare } from "../src/lib/share";
import { signReceipt } from "../src/lib/server";
const request = (path: string, body: unknown) => new Request(`http://localhost:3101${path}`, { method: "POST", headers: { "Content-Type": "application/json", "x-forwarded-for": "loop-api-tests" }, body: JSON.stringify(body) });
afterEach(() => vi.unstubAllEnvs());
describe("typed loop API and exact signed handoff", () => {
  it("solves, exports the selected candidate, and round-trips the exact canonical drawing", async () => {
    const record = bundledLoopRecord(), input = record.input; input.revision = 8;
    const response = await solve(request("/api/loops/solve", input)); expect(response.status).toBe(200); const result = await response.json();
    expect(result.status).toBe("succeeded"); expect(result.cached).toBe(false); expect(result.inputHash).toBe(buildLoopInputHash(input)); expect(result.receipt).toBeTypeOf("string");
    const candidate = result.candidates.at(-1), exported = await exportDesign(request("/api/loops/exports", { receipt: result.receipt, candidateId: candidate.id }));
    expect(exported.status).toBe(200); const manifest = await exported.json(); expect(manifest.input).toEqual(input); expect(manifest.mechanism).toEqual(candidate.parameters); expect(manifest.selectedCandidateId).toBe(candidate.id); expect(manifest.samples).toHaveLength(361);
    vi.stubEnv("BACKEND_BASE_URL", "https://motion-foundry-nine.vercel.app");
    const shared = await share(request("/api/loops/shares", { receipt: result.receipt, candidateId: candidate.id })); expect(shared.status).toBe(200); const value = await shared.json(); expect(value.url.startsWith("https://motion-foundry-nine.vercel.app/design/loop/")).toBe(true); expect(value.url.length).toBeLessThan(2800); expect(value.qr.data).toHaveLength(value.qr.size ** 2);
    const token = new URL(value.url).pathname.split("/").at(-1)!, restored = readLoopShare(token); expect(restored.input).toEqual(input); expect(restored.candidate.parameters).toEqual(candidate.parameters); expect(buildLoopInputHash(restored.input)).toBe(result.inputHash);
    const file = await download(new Request(`http://localhost:3101/api/loops/download?token=${token}`)); expect(file.status).toBe(200); expect((await file.json()).input.stroke).toEqual(input.stroke);
    const svg = await download(new Request(`http://localhost:3101/api/loops/download?token=${token}&format=svg`)); expect(svg.status).toBe(200); expect(await svg.text()).toContain("Maximum ordered error");
  }, 15000);
  it("rejects tampered receipts, unrelated candidates and petal token purpose", async () => {
    const r = bundledLoopRecord(), candidate = r.result.candidates[0], receipt = signReceipt({ format: "motion-foundry/loop-receipt@1", input: r.input, candidates: [candidate] });
    const [body, signature] = receipt.split("."), tampered = `${body}.${signature[0] === "a" ? "b" : "a"}${signature.slice(1)}`;
    expect((await exportDesign(request("/api/loops/exports", { receipt: tampered, candidateId: candidate.id }))).status).toBe(403);
    expect((await exportDesign(request("/api/loops/exports", { receipt, candidateId: "unrelated" }))).status).toBe(400);
    const petal = bundledRecord(), old = createShare(petal.input, petal.result.candidates[0]);
    expect(() => readLoopShare(old)).toThrow("loop design"); expect((await share(request("/api/loops/shares", { receipt: old, candidateId: candidate.id }))).status).toBe(400);
    candidate.parameters.crankCm = 100; candidate.verification.valid = true;
    expect((await share(request("/api/loops/shares", { input: r.input, candidate }))).status).toBe(400);
  });
  it("keeps unquantized API input exact and bounds decompression", () => {
    const input = makeDefaultLoopInput(), candidate = { ...bundledLoopRecord().result.candidates[0], parameters: { ...knownLoopParameters } };
    const token = createLoopShare(input, candidate); expect(readLoopShare(token).input.stroke).toEqual(input.stroke); expect(buildLoopInputHash(readLoopShare(token).input)).toBe(buildLoopInputHash(input));
    const bomb = signReceipt({ format: "motion-foundry/loop-share@1", packed: deflateRawSync("x".repeat(30000)).toString("base64url") }); expect(() => readLoopShare(bomb)).toThrow("Invalid loop package");
    const malformed = signReceipt({ format: "motion-foundry/loop-share@1", packed: deflateRawSync(JSON.stringify({ input, drawing: { encoding: "delta-0.001cm", points: [1, 2, 3] }, candidate })).toString("base64url") }); expect(() => readLoopShare(malformed)).toThrow("Invalid loop package");
    const large = makeDefaultLoopInput(); large.stroke = Array.from({ length: 2048 }, (_, i) => ({ ...large.stroke[i % large.stroke.length] })); expect(() => createLoopShare(large, candidate)).toThrow("too large");
  });
  it("returns clear client errors and never signs an analytically infeasible request", async () => {
    for (const route of [solve, share, exportDesign]) expect((await route(request("/api/test", null))).status).toBe(400);
    const input = bundledLoopRecord().input; expect((await solve(request("/api/loops/solve", { ...input, units: "inches" }))).status).toBe(400);
    expect((await solve(request("/api/loops/solve", { padding: "x".repeat(30000) }))).status).toBe(413);
    input.fixedMounts.groundCm = 80; const result = await (await solve(request("/api/loops/solve", input))).json(); expect(result.status).toBe("infeasible"); expect(result.receipt).toBeUndefined();
  });
  it("includes obstacles, declared layer and clearance in the assembly drawing", () => {
    const r = bundledLoopRecord(), candidate = r.result.candidates[0]; r.input.obstacles = [{ id: "far<&constraint", center: { x: 14, y: 4 }, radiusCm: .3, layerZCm: 0, depthCm: .2 }];
    expect(verifyLoopCandidate(r.input, candidate.parameters).valid).toBe(true); const svg = createLoopSvg(r.input, candidate); expect(svg).toContain("Sampled clearance margin"); expect(svg).toContain("Coral: obstacles (1)"); expect(svg).toContain("layer 0 cm"); expect(svg).toContain("far&lt;&amp;constraint"); expect(svg).not.toContain("far<&constraint");
    const manifest = createLoopPackage(r.input, candidate, "test"); expect(manifest.input.obstacles).toEqual(r.input.obstacles); expect(manifest.verification.inputHash).toBe(buildLoopInputHash(r.input));
    candidate.parameters.attachmentAcrossCm = 999; expect(() => checkedLoopDesign(r.input, candidate)).toThrow("does not pass"); expect(() => createLoopSvg(r.input, candidate)).toThrow("does not pass");
  });
  it("reports the largest-error witness at an actual independent linkage pose", () => {
    const r = bundledLoopRecord(), candidate = r.result.candidates[0]; r.input.stroke = r.input.stroke.map(p => ({ x: p.x + 1, y: p.y }));
    const report = verifyLoopCandidate(r.input, candidate.parameters), witness = report.fitWitness!;
    expect(report.valid).toBe(false); expect(witness.errorCm).toBe(report.maxFitErrorCm);
    expect(Math.hypot(witness.desired.x - witness.actual.x, witness.desired.y - witness.actual.y)).toBeCloseTo(witness.errorCm, 12);
    const actual = evaluateCouplerPoint(candidate.parameters, witness.phaseRad)!.point;
    expect(actual.x).toBeCloseTo(witness.actual.x, 10); expect(actual.y).toBeCloseTo(witness.actual.y, 10);
  });
  it("ignores results after edits, cancellation, retries and reordered strokes", () => {
    const r = bundledLoopRecord(), expected = { input: r.input, generation: 1 };
    expect(acceptsLoopResponse(expected, { input: r.input, generation: 1 }, r.result)).toBe(true);
    expect(acceptsLoopResponse(expected, { input: r.input, generation: 2 }, r.result)).toBe(false);
    const revised = reviseLoop(r.input, x => { x.stroke = [...x.stroke].reverse(); });
    expect(acceptsLoopResponse(expected, { input: revised, generation: 1 }, r.result)).toBe(false);
    expect(buildLoopInputHash(revised)).not.toBe(buildLoopInputHash(r.input));
  });
});
