# Motion Foundry — design brief

Motion Foundry is a SPECS workbench for kinetic makers exploring how rods and pivots could reproduce a desired motion. Draw a closed loop on a table, synthesize a four-bar linkage, and turn its crank to watch a rigidly attached pen trace the computed path.

## The spatial moment

The maker draws directly on the tabletop board. Make it searches for a mechanism while preserving the drawing, mount spacing, scale, tolerance and obstacles. New rods appear at their declared dimensions. Turning the large crank grows ink from actual coupler positions, including their natural changes in speed.

A small ring and connector locate the largest fitting error. Approach or inspect the machine to reveal the relevant detail. In the separate provided-container study, the original crank overlaps the declared obstacle; Make it again must find new dimensions without moving the obstacle or loosening the fit limit.

This belongs in space because the drawing, layered rods, hand controls and keep-out occupy one work surface. The complete action is visible where the maker is already looking. Native focuses on Loop. Petal remains in the companion and retained code with its existing angular-target designs.

## Four glasses design habits

| Habit | Product decision |
| --- | --- |
| Put information on the thing it concerns | Fit rings belong to the drawing; contact belongs to the offending rod; dimensions and detailed scope remain in the kept design. |
| Show it when needed | Labels respond to proximity, hover or brief events. Drawing, solving and keeping have separate contextual tools. |
| Use a few big targets | At most three primary UI targets per state; a 3.6 cm crank grip, physical mount and fit dial use standard SIK interaction. |
| Keep it where the person is looking | Place the flat workbench on a table below eye level, with the tool tray and QR beside the active geometry. |

The Devpost Learn planning guidance shaped the bounded mechanism family and complete Preview workflow. Applying it again to the first release led to table placement, direct crank action and removal of the persistent dashboard. [The iteration record](iteration-log.md) separates those decisions from measured acceptance.

## Physical placement and input

The current saved Sunlit Room setup uses table owner pose `(−30, −142.4, −474)` cm, yaw 0° and unit scale. Internal centering places the 30 × 24 cm board about that owner. The scene is spatially anchored; it does not follow the head. Manual placement is the fallback. An explicit Place action starts WorldQuery, accepts an upward horizontal hit on a standard SIK pinch, sets the owner once and ends the session.

Native rods use a 0.45 cm capsule radius, 0.70 cm depth and layer centres of 0.6, 1.8, 3.0 and 4.2 cm. These deliberate input changes are independently reverified; the visual mesh has the same envelope. The native reference retains 16 cm mounts, moving links of 4/14/10 cm and a 0.30 cm fit limit. The web fixture is unchanged. This is not a uniform scaling claim across all physical quantities.

SIK ray input intersects the board in local centimetres. Direct input uses the SDK's hand anchor projected into that plane, with relative offsets for a stable grip. A release near the start closes a drawing; a larger gap needs the explicit Done action. Capture fixes 64 ordered points in 0.001 cm increments before hashing or solving. That is representational precision, not measurement accuracy.

The crank changes only physical phase. Mount, keep-out or fit-limit edits invalidate the prior result; one completed nonzero drag creates one revision. A no-motion grab creates none. Undo restores input, selected mechanism, alternatives and receipt together. Search and share requests have independent generation guards so late responses cannot replace newer work.

## What is computed

The solver searches moving-link lengths, the tracing point's along/across coordinates, starting phase, branch and crank direction. Ordered closed arc-length correspondence preserves traversal through crossings. It does not prescribe the speed of a hand-drawn stroke.

A seeded bounded search includes obstacle penalties and feasible-candidate retention. Separate law-of-cosines pose math verifies each accepted candidate. Full-turn reachability is analytic; fit and capsule clearance are sampled, using 720 poses by default. Search exhaustion means no acceptable result was found within the budget, not that no mechanism can exist.

The rigid attachment is represented by rods B→P and C→P, with a decorative pen at P. Ink is evaluated from crank poses; desired coordinates never drive the assembly. The low container is a declared, manually aligned keep-out, 9 cm in diameter and 4 cm high. It is not recognized scenery. Fresh repair results and exact constraints are recorded in [native-tabletop.md](native-tabletop.md).

## A useful handoff

Keep displays a signed QR tag beside the workbench. The server rechecks the selected candidate and preserves exact drawing coordinates and dimensions. The companion presents the assembly SVG, obstacles and fitting/clearance result, plus JSON for an independent copy. Existing Petal shares remain compatible.

## Boundaries and acceptance

The product supports one planar four-bar family with a rigid coupler attachment. Axles, clamps, the grip, pen hardware and attachment-internal contacts are outside the rod-clearance model. Through-axles explain the visible layers; they are not fabrication-verified parts. Forces, bearings, loads, recognition and manufacturing are not claimed.

The web and earlier Plane Preview release passed their recorded checks. The current tabletop revision has local numerical, mesh, interaction-math and native compilation evidence, plus clean native LEAF drawing/repair and direct-reach/Undo runs. Sound scheduling passed. Independently accepted native source includes the complete drawing/repair sequence, room orbit and SPECS Center view; the fresh side-tag/companion handoff now matches the exact main Study input and mechanism. The [156.1-second edited film](film-review.md) passed independent encoded QA and complete browser playback; user approval remains pending. Optional explicit placement remains unverified. See [verification.md](verification.md) for the precise current status. No physical glasses, tracking-accuracy, comfort or device-performance result is claimed.
