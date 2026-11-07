# Motion Foundry — design brief

Motion Foundry is a SPECS Lens for kinetic makers. Draw a closed loop, synthesize a four-bar linkage, then inspect how its rigidly attached tracing point follows the requested path. Loop is the opening mode; Petal retains the original angular-target study.

## The spatial moment

Drag a pen on the virtual board. The desired loop stays visible while a bounded solver searches for a four-bar mechanism. Turn its crank: the rigidly attached tracing point follows the computed linkage, including its natural change in speed. Reveal the rods, pause at the largest fitting error, or inspect an obstacle contact. A fresh solve can change the machine while keeping the drawing and constraints fixed.

This belongs in space because the maker can inspect link layers, fixed pivots, moving rods and clearance around the same object at its declared scale. It is a virtual workshop with manually authored dimensions and constraints. Real-machine scanning and recognition are outside its scope.

## Placement and interaction

The saved Lens root is 110 cm in front of an identity Preview camera, with unit scale. The Loop reference uses 16 cm mount spacing and a 0.30 cm fit limit; the web reference uses half those physical dimensions. This is a consistent input-unit conversion, not an enlarged rendering with unchanged numerical dimensions.

The primary dock contains playback, drawing and contextual controls. A standard SIK pen handle supports placement, drawing and point editing through Preview MouseInteractor. World positions transform into the board's local centimetre frame. Releasing near the starting point closes the stroke under an explicit instruction; a larger gap requires Close or Clear. The captured drawing becomes 64 ordered points in 0.001 cm increments (0.01 mm) before solving. This is representational precision, not measurement accuracy.

Desired motion is blue and dashed; the actual trace is green and solid. The attachment is shown as rods B→P and C→P, with a tracing-point indicator. No solid triangle appears to have been collision-checked. A fit witness connects the desired point to an independently evaluated physical pose; a contact witness identifies the offending rod and obstacle.

Previous geometry remains visible after an edit. Its label says it belongs to the previous result, and export requires a fresh accepted revision. Undo restores the input, chosen candidate, alternatives and receipt together. Cancellation and retries have distinct request generations, including native share requests.

## What is computed

The solver searches three moving-link lengths, the tracing point's along/across coordinates, starting crank phase, assembly branch and drive direction. Fixed mounts, drawing scale, tolerance and obstacles are not optimization variables. Ordered cyclic arc-length correspondence preserves traversal through crossings; it does not claim to reproduce the speed of the user's hand.

A bounded seeded search uses obstacle-aware penalties and candidate retention. A separate law-of-cosines verifier checks each accepted design. Full-turn reachability is analytic; fitting and clearance are sampled. The default Loop report checks 720 crank poses. Exhausting the search is reported as no verified fit, not a proof of impossibility.

The clearance study is a concrete causal example: an obstacle intersects the existing crank, its contact phase is inspectable, and a slightly shorter crank with adjusted remaining dimensions fits the same drawing within the original tolerance. No preset destination is substituted for a fresh solve.

## Completed outcome

A selected fresh design can be shared by signed link and QR or downloaded as exact JSON and an SVG drawing. The drawing shows desired/actual paths, dimensions, obstacles and fit/clearance. Self-contained compressed shares preserve input coordinates losslessly and keep the older Petal link format separate.

Petal remains available for fixed-phase output-angle design, its rigid decorative rocker petal and optional AI target proposals. AI does not synthesize or verify a Loop mechanism. Petal proposals also require explicit acceptance and a separate numerical solve.

## Boundaries and evidence

The supported family is a planar four-bar crank-rocker with a rigid coupler attachment. Clearance uses declared capsule radii and layers, with adjacent-pivot exemptions. Rigid attachment-internal contacts, pen hardware, axle bridges, decorative surfaces, forces, bearings and fabrication are excluded. No arbitrary spatial-mechanism or manufacturing claim is made.

The Loop web/API workflow has passed numerical, security, browser and production checks. Actual native SIK drawing, fixed-constraint repair, physical witnesses, failure recovery, stale-response guards and exact production QR handoff also passed. The [verification record](verification.md) separates those observations from supplemental fault injection and the earlier Petal evidence. No physical glasses, hand-tracking accuracy, comfort or device-performance result is claimed.
