import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { parseInput, solveDesign, verifyCandidate, type SolveResult, type DesignInput } from "../src/domain";

const results: Record<string, SolveResult> = {};
const inputs: Record<string, DesignInput> = {};
for (const name of ["baseline", "obstacle-before", "obstacle-after", "contradictory"]) {
  const input = parseInput(JSON.parse(await readFile(new URL(`../examples/${name}.json`, import.meta.url), "utf8")));
  const result = solveDesign(input);
  inputs[name] = input;
  results[name] = result;
  assert.equal(result.status, name === "contradictory" ? "infeasible" : "succeeded");
  for (const candidate of result.candidates) assert.equal(verifyCandidate(input, candidate.parameters).valid, true);
  console.log(JSON.stringify({ fixture: name, status: result.status, alternatives: result.candidates.length, inputHash: result.inputHash, evaluations: result.evaluations }));
}
const before = results["obstacle-before"].candidates[0].parameters;
const after = results["obstacle-after"].candidates[0].parameters;
assert.notDeepEqual(before, after, "Relocating the obstacle must change the synthesized dimensions.");
assert.equal(verifyCandidate(inputs["obstacle-after"], before).valid, false, "The original mechanism must really hit the relocated obstacle.");
console.log("All examples passed; the obstacle change invalidates the old design and produces a different verified mechanism.");
