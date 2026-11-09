# Native workbench LEAF scenarios

These test-only scripts use installed LEAF and SIK. Root owns synchronization, editor, camera and capture; the registry is imported through the existing LeafIndex component.

- `motion-workbench-draw-solve-crank-repair`: start a fresh Preview. A visible synthetic right hand draws a reference-derived stroke translated +0.06 cm, closes by the product's endpoint snap, obtains a real HTTPS result, turns the crank, touches the empty mug outline, turns to actual contact, and requests a fresh same-input repair. Assertions require physical overlap before repair, exact stroke/mount/fit/constraint preservation, a visible contact ring, scheduled contact audio, and independent local acceptance of the real result.
- `motion-workbench-direct-reach-and-undo`: fresh Preview at the near working pose. Existing IK direct crank reach runs without an avatar visualizer, disposes its wrapper, then the shared hand edits the mount. More → Tools → Undo restores the snapshot. It does not fall back to indirect reach.
- `motion-workbench-film-rehearsal`: fresh Preview with WARN logging and no diagnostic cameras. See FILM_REHEARSAL.md.
- `motion-workbench-export-film`: continue a valid HTTPS mug-repair result from the journey/rehearsal. Save uses a visible synthetic hand; the actual returned QR and URL must preserve that current design. See EXPORT_FILM.md.

The first three scenarios explicitly reject modified Preview state. They never install a fixture or replace user work to reset. Tools navigation exposes Undo when its on-object chip has expired.

WorkbenchPathInteractor gets the official shared right hand. The visible SIK mesh is oriented with the reviewed relaxed hand basis toward (−0.55, −0.10, −0.83), so fingers point left and away and the wrist enters from the lower right. Gestures use 120 ms and rotations 150 ms; rotation/gesture animations never use zero duration. Every sample measures wrist minus the actual index/thumb midpoint and places that midpoint at the intended Direct anchor. The Direct test channel uses that anchor and a tiny direction parallel to the posed fingers. Trigger, hover and drag all use this posed route rather than the SDK's unrotated constant offset. Every release retreats for 350 ms and hides the hand during playback/solve.

Continuous paths bridge only installed BaseLeafInteractor's protected test-input fields, with public startSelecting/stopSelecting; no product method, result callback or collision callback is invoked. Genuine SIK trigger start/end observations have bounded waits. Default Direct targeting is retained. This is scripted synthetic input, not physical hand recognition or a freehand drawing claim.

Additional takes in WorkbenchControlsFilm (WARN, 150-second runner deadline):

- `motion-workbench-controls-film`: fit 3→2→3 mm, mug radius 4.5→5→4.5 cm, mount +1 cm and its actual Undo chip, then fresh HTTPS solve of the final exact input.
- `motion-workbench-fit-film`: only the fit dial action, followed by a fresh HTTPS solve.
- `motion-workbench-mug-film`: only the rim sizing action, followed by a fresh HTTPS solve. Touches the actual empty ring first if no mug has been added.
- `motion-workbench-mount-film`: mount +1 cm and Undo. Asserts exact original input and mechanism restoration; it makes no new HTTPS receipt claim.
- `motion-workbench-placement-film`: More → Place, wait at most 20 seconds for an actual WorldQuery hit, then the hand pinches Place here. Root must aim the camera at a real Preview table. No hit or placement pose is injected. Placement must preserve the exact design input and increment the real placement commit count.
- `motion-workbench-opening-film`: a visible hand turns the actual crank, then retreats while the real ink continues. Requires a currently verified machine, and preserves the exact input/candidate.

Controls take preconditions: finish any active edit/draw/solve/share first; fit starts at 3 mm and mug at radius 4.5 cm. These takes can start after a repaired main rehearsal; standalone fit/mug takes also support the original starter. A direct edit invalidates freshness even when final dimensions return, so fit/mug/combined takes require their own new HTTPS result. Receipts print current input hashes and exact snapshots; no previous observed hash or mechanism is hard-coded. Root owns framing and capture for every take.

Native Preview execution and screenshots remain required; local numeric feasibility and TypeScript checks do not prove rendering or physical device behavior.


Film audio receipts: the rehearsal, every controls mode and export bind one read-only UpdateEvent observer while running. `product-audio-cue` records deltas in tick/contact/clear counters, cumulative counts and wall/Lens clocks within the take's runId/eventNumber stream. Multiple cues in one frame can be coalesced into one delta receipt. These are product sound-scheduling observations for video-only capture, not recorded sound. The observer never schedules audio and removes both its update and destroy events on completion, failure or destruction.
