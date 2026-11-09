# Third-party notices

Motion Foundry combines original application, solver, verifier, procedural geometry, and interface work with the following supplied tools and dependencies.

## Lens resources

- The SPECS base project, Spectacles Interaction Kit 2.0.0, Spectacles UIKit 2.0.0, Icons, and Motion packages are supplied through Lens Studio. Their package metadata and notices are retained in the native project. The base template also supplies its camera/render setup and Echopark environment asset. These resources retain their own terms; this repository does not relicense them.
- **3D Hints 2.0.0**, with its **Utilities** and **SnapDecorators** dependencies, supplies the original animated gesture hints. Installed package metadata and terms are retained. The Lens instantiates the public hand-hint prefab and controller; SDK sources are unchanged.
- **LEAF 2.0.2** and **Bitmoji 3D 10.0.1** are retained official Lens Studio package dependencies for reproducing the authored native tests. Original package metadata and terms remain intact. The production scene has no active `LeafIndex`, LEAF messaging bridge or inspection handler. The main product does not instantiate a Bitmoji avatar; the accepted reach test uses the supported IK driver and synthetic SIK hand visuals without its optional avatar visualizer. These packages are not relicensed as original Motion Foundry code.
- **Sunlit Room** and the SPECS Center simulation shown in the current gallery and native footage are built-in Lens Studio Preview resources. Their original terms apply. The room is rendered by Preview with the actual Lens; it is not a stock background composited behind a reconstructed interface.
- `lens-src/DragInteraction.ts`, mirrored in the Lens's Assets/Scripts directory, comes from the CLAD `specs-interaction-recipes` reference scripts. Its **Copyright 2026 Specs Inc.** and **Apache-2.0** header are retained. The license is included in [licenses/Apache-2.0.txt](licenses/Apache-2.0.txt), from the [Apache Software Foundation](https://www.apache.org/licenses/LICENSE-2.0.txt).
- Other native application scripts and the sculpture's procedural petal/link meshes were authored for Motion Foundry. The Preview images in `devpost/media/` are actual project captures, not stock imagery or hardware captures.

## Web dependencies

Next.js, React, Three.js, Vercel AI SDK and its provider adapters, Lucide, Zod, and node-qrcode provide the application framework, rendering, model transport, icons, schema validation, and QR encoding. TypeScript, Vitest, and tsx support development and verification. Exact resolved versions and transitive dependencies are recorded in `package-lock.json`; their upstream licenses remain applicable.

Typography uses DM Sans, Manrope, and Instrument Serif through `next/font`. Each is distributed under the SIL Open Font License 1.1; the original notices and license texts are included:

- [DM Sans](licenses/DM-Sans-OFL.txt) — [upstream notice](https://raw.githubusercontent.com/google/fonts/main/ofl/dmsans/OFL.txt).
- [Manrope](licenses/Manrope-OFL.txt) — [upstream notice](https://raw.githubusercontent.com/google/fonts/main/ofl/manrope/OFL.txt).
- [Instrument Serif](licenses/Instrument-Serif-OFL.txt) — [upstream notice](https://raw.githubusercontent.com/google/fonts/main/ofl/instrumentserif/OFL.txt).

## Methods and services

Four-bar linkage closure, circle intersection, the law of cosines, and Freudenstein's relation are established kinematic methods. This project implements its own deterministic search, verifier, schema, examples, and export flow; it does not claim those mathematical methods as novel.

OpenAI and Gemini are optional external model services used only for structured motion proposals. Vercel hosts the companion application. These services are identified as infrastructure, not as authors of a verified mechanical result. No AI-generated imagery is required by the sculpture or interface.
