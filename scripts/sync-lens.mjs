import { readFile, writeFile, mkdir } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = fileURLToPath(new URL("..", import.meta.url));
const check = process.argv.includes("--check");
const names = ["DragInteraction.ts", "MotionAssembly.ts", "MotionDomain.ts", "MotionExportCard.ts", "MotionFoundry.ts", "MotionWorkshopUI.ts"];
async function mirror(source, destination) {
  const data = await readFile(join(root, source));
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
for (const name of names) await mirror(`lens-src/${name}`, `lens/Assets/Scripts/${name}`);
console.log(check ? "Portable domain and all six native script mirrors match." : "Native source sync complete. Recompile the Lens in Lens Studio.");
