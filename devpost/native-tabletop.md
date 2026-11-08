# Tabletop revision — November 8, 2026

**Integration status:** all 24 product/test TypeScript files compile against the installed APIs. The final 9 × 4 cm fixture passed actual LEAF drawing/HTTPS/crank/repair and direct-reach/Undo checks. The continuous main source, camera orbit, close detail and actual SPECS Center capture are independently accepted. The main proof is 82.1 seconds at the recorded frame rate, with both complete crank revolutions. The fresh side-tag/companion match is accepted for the exact main Study input and mechanism. The [156.1-second edited film](film-review.md) passed independent encoded QA and complete browser playback; user approval remains pending. Optional one-shot placement remains unverified. [Native test receipts](evidence/native-tabletop-leaf.json), [capture measurements](evidence/native-tabletop-captures.json) and [the gallery](gallery.md) keep those scopes distinct.

## The experience

A maker draws a closed loop on a table. A fresh numerical search finds a four-bar linkage, and turning its large crank grip makes a decorative pen draw the actual coupler path back. The useful information sits with the machine: a small error ring, a brief fit label and a glow on the rod that meets the declared container envelope.

The native experience contains Loop only. Petal remains in the companion, numerical code and retained source, including existing signed designs. It is hidden from the native opening rather than competing for the maker's attention.

## Physical input and rendering contract

| Quantity | Native tabletop revision |
| --- | --- |
| Board | 30 × 24 cm, flat on a table; outline and luminous traces rather than opaque white paper |
| Reference fixed mounts | 16 cm |
| Reference moving rods | 4 / 14 / 10 cm |
| Capsule radius / depth | 0.45 / 0.70 cm |
| Ground / crank / rocker / coupler layer centres | 0.6 / 1.8 / 3.0 / 4.2 cm above the board frame |
| Required obstacle separation | 0.16 cm |
| Maximum ordered fitting error | 0.30 cm (3 mm) |
| Drawing representation | 64 ordered points in 0.001 cm increments before hashing and solving |
| Declared keep-out study | Provided low container: radius 4.5 cm, height 4 cm, centre (−8.90, 0) cm, vertical centre 2 cm |

The native link radius, depth and layer spacing are deliberate new input values. The web fixture is unchanged. The native design therefore must not be described as simply doubling every physical web quantity.

The rounded-bar mesh is an XY capsule extruded through the declared depth. Tests check its full envelope, normals and triangle orientation. Through-axles connect visible layers; clamps, the 3.6 cm crank grip and the pen nib/stem are decorative hardware. They are **not** included in the rod-clearance result. The attachment remains B→P and C→P rods, not a collision-checked solid plate.

Ink grows only from evaluated physical crank poses. The input drawing is never interpolated to drive the linkage or used to manufacture a more accurate trace. Reversing the crank draws the actually visited path in reverse; history is bounded.

## Placement and controls

The table frame is at the actual board centre. The mechanism's XY plane rotates internally onto the horizontal table; the tool tray and QR tag have their own orientations. The current saved Sunlit Room staging uses table owner position `(−30, −142.4, −474)` cm, yaw 0° and unit scale. Earlier Colorful Home measurements used `(−48, −62, −318)` cm and yaw 45°; they are historical setup evidence. The accepted front, oblique orbit and SPECS Center captures show the workbench in that simulated room; these are native rendered views, not backgrounds added in an editor.

Manual placement is the default fallback. **Place** explicitly starts a WorldQuery session. A standard SIK ray must hit an upward horizontal surface; a pinch fixes the owner's position/yaw once and stops the session. The workbench does not chase subsequent hits or become head-locked. Surface-placement behavior still requires recorded native acceptance.

The board, crank, mount, fit dial and measured keep-out use SIK near/far interaction. Ray input intersects the board's local plane; direct input projects the SDK's hand anchor onto that same plane. There is no duplicate touch-event path or custom glasses-only gesture.

- Idle offers **Draw**; the large crank grip can be turned directly.
- Drawing offers **Clear · Done**. Releasing near the start closes the loop. A larger open gap needs the explicit Done action; it is not silently bridged.
- An edited closed loop offers **Make it**, with recovery under Undo.
- A fresh result offers **Keep · Try another · More**, or Draw when only one candidate exists.
- More contains the study and secondary tools. Mount spacing, obstacle position and fit limit have physical handles; the optional phase slider is behind More.

Each state has at most three active primary UI targets. Buttons are created once, sized 9.2 × 5 cm with 1.4 cm gaps, and use UIKit audio feedback. Revisions, hashes, pose counts and long scope text remain in diagnostics/exports. Geometry labels are depth tested and appear by proximity, hover or a short event window. A brief Preview/provided-measurements disclosure is retained.

## Fresh numerical result

The unchanged solver was run against the new, thicker native input. The reference crank physically overlaps the provided container envelope by **0.050 cm**. Including the required 0.16 cm separation, its margin is **−0.210 cm**. A fresh solve returns three independently verified candidates while preserving the exact drawing, mounts, tolerance, rod radius/depth/layers and obstacle.

The first candidate changes the crank from **4.000 to 3.766742 cm**, with **0.242353 cm** maximum fitting error and **+0.023258 cm** sampled clearance margin after the required separation. The same dimensions and metrics were then obtained by the actual native HTTPS repair. Its revision-3 input hash was `fnv1a-3049b059`; all requested fields stayed unchanged across that repair. The [complete sanitized record](evidence/native-tabletop-numerical.json) contains its exact input, parameters and verifier report.

The 12 cm-tall interim prop was replaced with this low container because the large decorative grip visibly intersected the taller object even after rod clearance passed. The current grip bottom is 4.95 cm above the board, above the container's 4 cm top. A separate conservative bounding-volume check across 721 phases for each of the three candidates found positive separation for the grip, post, axles, clamps, pen and dial. This fixture-only review is recorded with the numerical evidence; it does not add hardware to the solver's verified scope.

## Audio, handoff and test source

UIKit and SIK provide normal interaction cues. Three original, analytically generated mono WAV files provide a ratchet tick, contact thud and clear chime through three bounded low-latency spatial voices. Each voice retains its assigned track, matching the installed UIKit audio-service pattern. Source generation, hashes and CC0 provenance are retained in `scripts/generate-native-audio.py` and `lens-src/audio/`.

Keep displays the same server-reverified signed design on a side tag instead of covering the linkage. Exact-input signing, bounded compression, existing Petal tokens and JSON/SVG formats are unchanged. The new tag was decoded from a full encoded Preview frame. Its exact signed payload matches the main Study; the earlier large-card decode is not reused.

Two [LEAF acceptance scenarios](../lens-src/leaf/README.md) cover the SIK drawing/closure/HTTPS/crank/repair journey and a separate direct-reach/Undo path. The final journey recorded 0.066984 cm error for its drawn input, a 1.01547-radian SIK-driven crank change and growing ink. Its separate container Study repaired to the dimensions above. Audio counters were tick 3, contact 1 and clear 3, with three configured voices and `failed=false`. This proves scheduling, not microphone output or physical Spectacles audio.

The reach scenario uses fail-fast IK diagnostics and rejects indirect routing. Its first cleanup failed because IK and the shared-hand driver simultaneously wrapped the same hand. Releasing IK through its public API before acquiring the shared hand restored both original tracking parents; the clean repeat passed native runner and runtime checks. No SDK code or warning policy was weakened.

The separate [Preview rehearsal](../lens-src/leaf/FILM_REHEARSAL.md) now has an independently accepted 82.1-second continuous source interval. It uses deliberate SIK input pacing, real backend waits and two complete physical cycles. Its new drawn input (`fnv1a-3e15a867`) returned 0.064951 cm maximum error. The second Study visibly loads its own reference drawing (`fnv1a-3049b059`) and returns the exact repair described above. Runtime/source clock comparison measured a slope of 0.999979; the source is not retimed. The main input has no hand mesh and is not a human-performed drawing. A separate accepted LEAF excerpt shows synthetic SIK hand meshes driven by the test driver, without a Bitmoji avatar placed at the camera.

A separate Preview-only `motion-workbench-export-film` test reconstructs the accepted Study through real controls, checks its exact input and mechanism, then uses actual SIK Keep and waits for the returned tag. That scenario passed, and the fresh recorded tag decodes the exact 1,655-character URL. Losslessly decoded input and mechanism deeply equal the main Study. The production read-only JSON endpoint accepts the signature and independently reverifies 720 samples with the same 0.242353 cm fit error and +0.023258 cm sampled extra margin. An actual fresh companion capture shows that result. Its four-second film insert is a static page image, not evidence of a replay or download click. [Sanitized handoff receipt](evidence/native-tabletop-handoff.json).

## Boundaries

This is a simulated room and a provided, manually aligned low container. It is not object recognition, scanning, a physical-world measurement, a fabrication-ready machine, or a continuous collision guarantee. Clearance samples the stated rods and obstacles; hardware, internal attachment contacts, joint exemptions, forces, bearings and fabrication remain outside scope. No physical Spectacles tracking, comfort, performance or phone-camera scanning result is claimed.
