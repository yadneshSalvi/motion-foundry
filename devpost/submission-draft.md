# Motion Foundry

Motion Foundry turns a drawn curve into a machine you can turn by hand on your workbench.

## Who it is for

It helps makers of moving sculptures and small mechanisms explore a motion before building physical parts. I sketch a loop, choose how closely the machine should follow it, and see rods carry a pen around the path. If my mug gets in the way, I can ask for another mechanism while keeping the same drawing.

Glasses put the sketch at true scale on the bench where I would build it. I can turn it with my hands, lean in to inspect the gaps, and walk around its layers without holding a second screen.

## What it does

A nib follows the drawing pinch, and the loop snaps closed when its ends meet. A physical dial sets the allowed error. **Make it** searches rod lengths and pen position while keeping the drawing, mounts and obstacle fixed. The returned mechanism is checked with separate geometry before it appears.

The crank drives the real linkage. Bold ink grows from the moving pen over the thin dashed sketch; the sketch never drives the animation. Matching parts stay mint after the hand releases, so the result can be read. A mug stand-in makes obstruction tangible. Its rim handle sets a manually sized keep-out, and contact lights the particular rod. A fresh solve can replace that machine without changing the sketch. A named Undo stays beside a direct edit. Save keeps the design locally; Send to phone shows its exact signed Preview link, whose companion checks the design again and offers JSON/SVG downloads.

## Designing for glasses

Useful information belongs to the part: millimetres at the dial, fit rings at the pen, lengths beside rods, and contact on the obstacle. Detail changes with distance. The dock has at most three targets, while drawing, cranking and sizing happen on the objects themselves. The board stays on a table; placement controls remain near the wearer.

The [Devpost Learn plan-lens framework](https://github.com/challengepost/learn-specs/tree/main/skills/plan-lens) shaped the [design brief](design-brief.md). It helped turn an early floating mechanism and control rack into a physical workbench, and move fitting information from a report onto the drawing. The obstacle journey now keeps the maker's freshly drawn loop through the repair.

CLAD and Lens Studio MCP supported the native build and inspection. Spectacles Interaction Kit, UIKit and official hand hints supply normal spatial interaction. LEAF exercises the actual input routes, live HTTPS solve, crank, same-drawing repair and Undo; it does not call product handlers to manufacture a result. The [verification record](verification.md) separates those native checks from numerical tests.

## What we learned

A correct solver needs a legible cause and effect. The pen's trace must be visible, the grip must look graspable, and a miss needs a location. We also learned to keep the rendered dimensions inside the checked model, preserve the user's drawing during repair, and show an honest pending state while a real search runs.

Next is physical-Spectacles testing of placement, reach, readability and sound, then a fuller mechanical model before fabrication. The current testing, mug, sharing and mechanical boundaries are stated together in [Scope](../README.md#scope).

Built with Lens Studio 5.23.2, the Devpost Learn skill pack, CLAD, Lens Studio MCP, SIK 2.0.0, UIKit 2.0.0, 3D Hints 2.0.0, LEAF 2.0.2, TypeScript, Next.js, React and Three.js.
