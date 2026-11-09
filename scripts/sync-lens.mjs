import { readFile, writeFile, mkdir } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = fileURLToPath(new URL("..", import.meta.url));
const check = process.argv.includes("--check");
const names = ["DragInteraction.ts", "MotionAssembly.ts", "MotionDomain.ts", "MotionExportCard.ts", "MotionFoundry.ts", "MotionWorkshopUI.ts", "LoopDomain.ts", "LoopAssembly.ts", "LoopWorkshopUI.ts", "LoopController.ts", "WorkbenchProfile.ts", "WorkbenchGeometry.ts", "PlanarInteraction.ts", "WorkbenchLabels.ts", "WorkbenchPlacement.ts", "WorkbenchAudio.ts", "WorkbenchPresentation.ts", "WorkbenchStyle.ts", "WorkbenchHints.ts"];
async function mirror(source, destination, transform) {
  const original = await readFile(join(root, source));
  const data = transform ? Buffer.from(transform(original.toString("utf8"))) : original;
  const previous = await readFile(join(root, destination)).catch(error => {
    if (error.code === "ENOENT") return null;
    throw error;
  });
  if (previous?.equals(data)) return;
  if (check) throw new Error(`${destination} differs from ${source}; run npm run lens:sync.`);
  await mkdir(dirname(join(root, destination)), { recursive: true });
  await writeFile(join(root, destination), data);
  console.log(`Updated ${destination}`);
}
await mirror("src/domain/index.ts", "lens-src/MotionDomain.ts");
await mirror("src/domain/loop.ts", "lens-src/LoopDomain.ts", text => text.replace("from './index'", "from './MotionDomain'"));
for (const name of names) await mirror(`lens-src/${name}`, `lens/Assets/Scripts/${name}`);
for (const name of ["WorkbenchScenarioTools.ts", "WorkbenchPathInteractor.ts", "WorkbenchJourney.ts", "WorkbenchReach.ts", "WorkbenchFilmRehearsal.ts", "WorkbenchExportFilm.ts", "WorkbenchControlsFilm.ts", "FilmCaptureIndex.ts", "LeafIndex.ts"]) await mirror(`lens-src/leaf/${name}`, `lens/Assets/Scripts/leaf/${name}`);
console.log(check ? "Portable domain and all native script mirrors match." : "Native source sync complete. Recompile the Lens in Lens Studio.");
