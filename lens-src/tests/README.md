# Native workbench tests

These scripts use LEAF 2.0.2 and the installed SIK input path. They are test dependencies, not product startup components. Follow [the native setup guide](../../devpost/reproducibility.md#native-source-and-deliberate-testing) to attach the temporary index and bridge, run a scenario, and remove them afterward.

## Registered scenarios

- `motion-workbench-draw-solve-crank-repair`: a fresh Preview, a new reference-derived stroke translated 0.06 cm, endpoint snap, a real HTTPS solve, physical cranking, mug addition and a fresh repair. The drawing, mounts, fit limit and obstacle remain unchanged across repair.
- `motion-workbench-direct-reach-and-undo`: genuine direct IK reach, hand-wrapper restoration, a mount edit, a no-motion grab and exact Undo. An indirect route does not count as direct reach.
- `motion-workbench-menu-graph`: More, Tools, Back, idle exits, drawing cancellation, placement play-state restoration and pending-solve cancellation. It also checks that the on-object Undo remains usable after 6.3 seconds and restores the exact original input.
- `motion-workbench-placement-smoke`: real horizontal WorldQuery hit and actual Place here, without synthesis. It does not install a hit or a placement pose.
- `motion-workbench-crank-smoke`: a short first-crank and mug-contact probe. It holds the real contact phase for two seconds so the pinch, knob, drawing, nib and contact edge can be inspected in the recording.
- `motion-workbench-drawing-smoke`: current-point and earned-stroke visibility through actual input and snap closure.
- `motion-workbench-mount-smoke`: held live mount value, projected hand exclusions and exact Undo.
- `motion-workbench-support-smoke`: real reference solve and follow-up controls, placement and sharing. This isolated risk probe does not establish same-fresh-drawing continuity; the complete film session does.
- `motion-workbench-film-rehearsal`: the continuous fresh-drawing proof, including two actual revolutions and a live-camera near inspection. See [rehearsal details](FILM_REHEARSAL.md).
- `motion-workbench-film-session`: the same proof followed, in one scenario lifecycle, by fit and mug sizing, mount Undo, fresh HTTPS verification, real surface placement and the current design handoff.

A LEAF Preview run resets the Lens. Controls and export are helper flows inside the combined session, not separately registered scenarios that could reload a fixture. They require its current, freshly drawn and repaired HTTPS design. The constructor never overwrites a user's drawing to satisfy a test precondition.

## Genuine input and visibility

Each path driver owns a supported `LeafSingleHandInteractor` subclass and restores tracking when it finishes. Drawing uses a camera-relative outboard writing pose, so the accumulated stroke stays exposed below-left. Buttons use a camera-relative approach; mount editing reserves a visible readout beside the held hand. Crank input uses an outboard, closed-pinch pose, tracks the live knob during approach, then resolves its path at the actual SIK grab. Contact still targets the verifier's absolute witness phase. The physical mechanism is never paused or assigned a phase by a test handler.

The actual thumb/index midpoint stays on the input point. A crank pinch must lie within the visible knob's 0.8 cm radius, not merely inside its larger interaction collider. The driver observes actual trigger events and logs measured joint projections; those bounds are a silhouette proxy, not a substitute for reviewing native pixels. Every release retreats and hides the hand during playback and solve waits.

The scenario directly uses the installed interactor's protected test-input channel and its public selection methods. It does not call product handlers or install solver results. A scripted reference-derived stroke is not a claim of human freehand input, physical hand tracking, or testing on Spectacles.

## Evidence and cleanup

Receipts record the actual input, dimensions, mechanism, locally checked response and action timestamps. A read-only observer records tick/contact/clear scheduling deltas; it never plays audio. Such events can support transparently reconstructed film cues, but are not an acoustic recording.

Keep raw logs private: host logs can contain unrelated analytics identifiers. Public evidence should contain only the relevant results, hashes and scope. After testing, remove the index, messaging bridge and temporary probes, save and reopen the project, and verify the actual scene has no active test bindings. Moving source files does not establish scene cleanup.
