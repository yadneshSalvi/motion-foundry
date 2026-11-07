# Motion Foundry — design brief

## Intent

**Show the motion. Invent the machine.** Motion Foundry helps kinetic artists, makers, and educators connect a desired movement to the geometry that could produce it. The implemented study is a single mechanical petal driven by a planar crank-rocker four-bar. The project owner selected this concept and approved the build; interaction and numerical scope were refined through implementation and Preview testing.

The desired outcome is a comprehensible, editable mechanism. A successful interaction ends with a user understanding why an alternative passes, or why the current request failed, and being able to keep the selected dimensions and evidence.

## Why a spatial Lens

Mount spacing, a moving joint, and a clearance obstacle are spatial constraints. The Lens lets the user see the petal and its generating linkage together, scrub a full input rotation, move a target handle, and reveal the underlying motion. A separate companion provides a more detailed record, optional language proposals, and downloadable artifacts.

The sculpture is placed about 110 cm in front of the Preview camera. Its physical native fixture has a 16 cm ground link, 4 cm input crank, 14 cm coupler, and 10 cm rocker. These are actual serialized centimetre dimensions. The web reference fixture is half that size. The decorative petal and its rigid sepals move with one output rocker; the artwork does not imply an independently solved radial flower.

## Experience

The opening state is a labeled, preverified bundled example that already moves. Three primary controls keep the sculpture central: pause/play, reveal, and design. A crank slider makes cause and effect immediately inspectable.

The Design view contains contextual Pose, Mount, and Space tools, with Solve, Undo, and Checks. Targets are angles at fixed crank phases. Moving a handle pauses playback and creates a new revision. Previous geometry stays available for inspection while its stale status is explicit. Checks exposes alternatives, measured target error, sample count, and Save. A deliberate conflicting-target study makes failure and recovery demonstrable.

The Lens uses standard SIK interaction and UIKit controls. The demonstrated input method is Preview's MouseInteractor. Browser controls provide keyboard access, visible state, mobile layouts, reduced-motion handling, and modal focus management. Physical hand tracking and device ergonomics require a separate hardware evaluation.

## Computation and trust

The bounded deterministic search varies three link lengths and assembly branch. It never adjusts phase timing or silently relaxes constraints. Analytic initialization and seeded refinement generate candidates; a separate trigonometric path checks geometry and each target tolerance. A rejected result never replaces the last inspectable mechanism.

AI is an optional web companion feature. Its structured proposal may change target angles and explicitly requested mount spacing after user acceptance. AI does not verify a mechanism, choose tolerances, or certify an export. If providers are unavailable, manual editing and numerical solving continue.

The server signs solve receipts and self-contained links only after geometric checks. Exports revalidate the selected candidate. No model credentials are present in the Lens or browser bundle. All design-link data is readable by anyone with the link.

## Deliberate boundaries

The supported family is one crank-rocker cell. Full-cycle reachability is checked analytically, while collision clearance is sampled using declared capsule radii and layers. Joint neighborhoods have an explicit exemption. Ornamental surfaces, inter-layer axle bridges, loading, bearings, fabrication, and manufacturability are outside this study.

The resulting JSON and SVG are an inspectable kinematic record. They support learning and further engineering work; they do not constitute a production-ready mechanical design.
