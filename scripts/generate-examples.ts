import { mkdir, writeFile } from "node:fs/promises";
import { makeDefaultInput, makeObstacleInput, makeContradictoryInput, knownExampleParameters, verifyCandidate, type Candidate } from "../src/domain";
import { createAssemblySvg } from "../src/lib/export";

const directory = new URL("../examples/", import.meta.url);
await mkdir(directory, { recursive: true });
const fixtures = {
  "baseline.json": makeDefaultInput(),
  "obstacle-before.json": makeObstacleInput(false),
  "obstacle-after.json": makeObstacleInput(true),
  "contradictory.json": makeContradictoryInput(),
};
for (const [name, input] of Object.entries(fixtures)) {
  await writeFile(new URL(name, directory), JSON.stringify(input, null, 2) + "\n");
}
const input = fixtures["baseline.json"];
const candidate: Candidate = { id: "reference-petal-study", family: "four-bar", label: "Reference petal study", parameters: { ...knownExampleParameters }, verification: verifyCandidate(input, knownExampleParameters), score: 0 };
await writeFile(new URL("assembly.svg", directory), createAssemblySvg(input, candidate) + "\n");
console.log("Generated four input fixtures and the reference assembly drawing.");
