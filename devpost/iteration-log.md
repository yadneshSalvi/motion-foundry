# Motion Foundry — implementation and iteration record

All observations below were made during the November 7, 2026 build. This record describes actual changes and checks, rather than an inferred user study.

| Observation | Change | Evidence |
| --- | --- | --- |
| A convincing moving flower alone would not establish a real mechanism. | Scoped the artwork to one rigid petal on a numerically solved four-bar rocker, with exposed links and joints. | Playback closure, held-out geometry, and independent-verifier tests pass. |
| Reusing a cached example could hide whether an obstacle influenced synthesis. | Added before/after fixtures with unchanged targets and a relocated capsule obstacle. | The old design fails the new obstacle; a fresh solve returns different passing dimensions. |
| A broad search can fail without proving impossibility. | Separated analytic contradiction detection from bounded-search exhaustion. | Conflicting same-phase targets report infeasible; a difficult obstructed search reports no-result. |
| Initial native controls created a large flat rack beside a small sculpture. | Enlarged the physical fixture with every centimetre quantity scaled together, removed the panel background, and introduced contextual control views. | Final Preview capture shows the sculpture above a compact three-control dock. |
| Programmatic UIKit layout initialization conflicted with automatic item discovery. | Disabled automatic discovery on authored FlexLayouts and populated them through the expected lifecycle. | Fresh native compile and runtime logs are clean. |
| Target dragging and normal rendering could compete for the handle position. | Added an explicit drag state; commit the completed drag as one revision. | Actual Preview drag changed a target, paused playback, and a subsequent solve returned new parameters. |
| Browser edits retained selectable alternatives from the prior input. | Disabled and dimmed old alternatives and labeled their previous revision. | Desktop browser review confirmed fresh solving and stale-state recovery. |
| A small obstacle's displayed radius did not match the slider step. | Matched the step to hundredth-centimetre values. | The control now represents the actual 0.12 cm fixture radius. |
| Undo initially restored a native candidate without restoring its alternatives. | Snapshot and restore the full alternative list. | After editing and solving, Undo followed by Next restores an original valid alternative. |
| Saving only into device storage was an incomplete cross-device handoff. | Added server-reverified signed links, QR rendering, a shared assembly preview, and JSON/SVG downloads. | Actual Preview pose edit → HTTPS solve → receipt Save passed; fresh bundled Save also passed. Both signed pages and JSON/SVG downloads returned HTTP 200. |
| OpenCV could not automatically locate the dense solved QR reliably. | Cross-checked the unchanged full Preview screenshots with ZXing. | ZXing automatically decoded both full screenshots to the exact runtime URLs. OpenCV also recovered both with crops and supplied corners for the solved card. No hardware scan was performed. |
| A shared mutable reference allowed one modified example to contaminate another. | Copy reference parameters when creating a workspace. | Invalid-export testing no longer affects later fixtures. |
| Long valid Unicode identifiers could create a token larger than the reader accepts. | Enforce byte and token limits before issuing a share; offer JSON export instead. | The boundary case returns HTTP 413 instead of an unusable signed link. |

The final web review covered desktop and a 390 × 844 mobile viewport. It included a real OpenAI proposal, accepting the edit, a fresh numerical solve, contradictory-input recovery, and exact-candidate downloads. The final local production shared page rendered the generated drawing and reopened the signed design without browser console errors.

![Actual Lens Studio Preview after production integration](media/native-preview.png)

This capture shows the final bundled browse/play state after the production integration pass. It is a Lens Studio Preview capture. The separate share-card capture and decoding results appear in the verification record.
