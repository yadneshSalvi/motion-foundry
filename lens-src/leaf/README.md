# Native workbench scenarios

These sources target the installed **LEAF 2.0.2** runtime and the project's existing Spectacles Interaction Kit. They typecheck against the installed package sources. **Authoring and compilation are not a recorded scenario pass.** The editor owner must register, run, and retain the actual Preview report.

The test-only path interactor extends LEAF's `DefaultLeafInteractor` and supplies a sequence of standard SIK ray-pinch positions. It never calls product action handlers, mutates product input, installs a cached result, or replaces a network response. This is simulated test input, not evidence of physical hand tracking.

## Source-confirmed scene snapshot

| Object | Component or role | Expected relationship |
| --- | --- | --- |
| `Motion Foundry workbench` | Runtime product root | Parent contains the `MotionFoundry` component and public state snapshot. |
| `Tabletop linkage` | Board coordinate frame | One local unit is one centimetre; world transform includes table yaw and the flat-plane rotation. |
| `Workbench drawing surface` | `PlanarInteraction` / SIK Interactable | Active in drawing state; an open stroke awaits Done. |
| `Workbench crank knob` | `PlanarInteraction` / SIK Interactable | Drag changes physical crank phase, not input revision/hash. |
| `Workbench movable mount` | `PlanarInteraction` / SIK Interactable | One completed nonzero drag creates one revision; no-motion input creates none. |
| `Workbench action left` | UIKit Button subtree | First action in two/three-action states. |
| `Workbench action middle` | UIKit Button subtree | Sole action, or second action in two/three-action states. |
| `Workbench action right` | UIKit Button subtree | Third action in three-action states. |

Names are read from the canonical authored source. Each active lookup also checks the actual runtime object, hierarchy, collider and current action. No object was renamed to satisfy a test.

## Registered scenarios

- `motion-workbench-draw-solve-crank-repair`: navigate through real controls to Reference; draw an open path; explicitly close it; await a new HTTPS result and local verification; turn the physical crank; check growing kinematic ink; load the declared keep-out study; prove the old crank physically meets the provided low container and the new result preserves every input field while clearing the sampled constraint. The final audio snapshot must report no failure; when all cues are configured, tick/contact/clear must each have been scheduled at least once. This checks scheduling, not microphone output.
- `motion-workbench-direct-reach-and-undo`: reset through controls; require the crank to route directly at the chosen seated/near camera pose; use the supported `IKBodyInteractor` with diagnostic policy **fail-fast**, without the optional camera-anchored avatar visualizer; then use the shared right-hand interactor for a mount drag, no-motion grab/release, and exact Undo.

A separate [exact-design export capture test](EXPORT_FILM.md) reconstructs the accepted Study through real controls and opens its actual share tag. It has its own capture registry and requires fresh Preview revision 0.

A third, separate [film rehearsal](FILM_REHEARSAL.md) uses the same SIK dispatch with deliberate pacing, real backend waits and two complete physical cycles. It is Preview-only, has no hand mesh, and explicitly distinguishes the second Study case from the preceding drawing. It does not replace either acceptance scenario.

The open path uses 59 points from the current reference stroke translated by 0.06 cm. The offline numerical probe found a 1.8842 cm endpoint gap and a fresh fit below 0.30 cm after explicit closure. The scenario still requires a fresh service response; it cannot pass from that offline result. Assertions use the before/after revision, full input, candidate, alternatives and receipt state, rather than assuming an absolute starting revision.

The direct-reach test releases its IK driver through the supported `destroy()` API before acquiring the shared right-hand driver. Both original tracking parents must be restored first; this prevents overlapping wrappers from corrupting teardown. An indirect route, convergence error or unreachable target fails the direct-reach gate. A useful far-field interaction must not be reported as a direct-reach pass. Any loading failure or diagnostic warning must remain in the report. No result here establishes hardware comfort or tracking accuracy.

## Editor integration

1. Outside an active native test, run `npm run lens:sync`. It mirrors this directory to `lens/Assets/Scripts/leaf/` along with product source.
2. In a test working copy, use native Lens Studio MCP to create a temporary `LeafIndex` SceneObject and attach the `leaf/LeafIndex.ts` script asset. Do not attach the scenario classes directly. The production scene intentionally has no active index.
3. Open the installed LEAF panel. It creates the temporary `LEAF Plugin Bridge` with `Leaf.lspkg/Scenarios/scenario/MessagingBridge.ts`; do not add a duplicate bridge. Compile, select Preview as LEAF's target, wait for scenario registration, and run the journey at the accepted table viewpoint. Record its report and runtime interval.
4. Move to the intended direct-reach viewpoint and run the reach scenario. Preserve diagnostic failures; adjust the product placement only if a real interaction finding warrants it.
5. Close the LEAF panel so its bridge is torn down, remove the temporary index attachment and inspection helpers, restart Preview and save the clean production scene. Keep source and reports for reproduction. Retained LEAF 2.0.2 and Bitmoji 3D 10.0.1 packages are test dependencies; no Bitmoji avatar is part of the product.
