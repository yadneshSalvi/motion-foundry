# Verification record

Updated November 9, 2026. Motion Foundry combines independently checked linkage geometry with actual Lens Studio Preview interaction tests. The [technical reference](technical-reference.md) explains the computations; [Scope](../README.md#scope) states their practical limits.

## Numerical and build checks

`npm run verify` passed **63 tests across eight files**, the web typecheck, four freshly solved Petal examples and the production build. The native source also passes `npx tsc -p tsconfig.lens-source.json` against the installed Lens, SIK, UIKit, LEAF and 3D Hints APIs.

The suite includes:

- Held-out Loop mechanisms with different lengths, attachment coordinates and assembly branches; ordered cyclic and reversed-drive comparisons; physically generated crossing paths and incorrect traversal rejection.
- Bounded no-fit behavior, obstacle-aware search, independent contact locations for every base and attachment rod, exact exports, signed shares and bounded decompression.
- Exact rendered capsule bounds, normals and winding; world/local plane projection; crank seam/reversal; physical ink; the thicker native input and containment of the mug body, handle and rim.
- Ordered green-match segments, dashed input, snap-close criteria, distance-band hysteresis, time-based crank friction, placement policy and same-drawing obstacle edits.
- Hint eligibility, one animation per encounter, persistent poses, re-entry and success-only permanent dismissal across all six gesture types.

The native checks are separate from the unchanged numerical engines. The script manifest covers **19 product/domain files and nine test files**. `npm run lens:check` compares their saved mirrors; it does not operate the editor or establish visual correctness.

## Actual Preview interactions

Tests ran in Lens Studio 5.23.2 with Sunlit Room, the SPECS device override, SIK 2.0.0, UIKit 2.0.0, 3D Hints 2.0.0 and LEAF 2.0.2. The visible synthetic hand follows real SIK hover, pinch, drag and release paths. Returned geometry is solved over HTTPS and checked locally before installation. A successful input call alone is not counted as a completed action.

| Interaction | Observed result |
| --- | --- |
| New drawing, snap-close and Make it | The drawing committed as `fnv1a-0928ec60`; a fresh solve produced 0.057521 cm maximum ordered error under the 0.30 cm limit. |
| Direct crank and ink | After the real hand turn, the first complete ink cycle advanced 6.28885 radians in 14.936 seconds; the repaired cycle advanced 6.30543 radians in 15.011 seconds. |
| Mug contact | Adding the mug preserved the new drawing. Turning the mechanism reached actual crank contact; its clearance margin was −0.213602 cm after the required separation. |
| Same-drawing repair | The blocked request `fnv1a-5a34a9e4` stayed exact. The crank changed from 4.003602 to 3.766783 cm; maximum error was 0.251659 cm and sampled margin became +0.023217 cm. |
| Fit dial | Actual rotations changed 3 → 2 → 3 mm. Each meaningful edit invalidated result freshness. |
| Mug rim | Actual drags changed radius 4.5 → 5.0 → 4.5 cm while retaining the mug centre and height. |
| Mount and Undo | A real drag changed spacing from 16 to 17 cm. The on-object Undo restored the exact prior input. Fresh synthesis then checked the completed control edits. |
| Surface placement | A real upward WorldQuery hit was followed by a real SIK Place action, one commit and unfolding of the workbench. No fallback pose was used; the input stayed exact. |
| Direct reach | A separate IK test required direct routing to the crank, returned no diagnostics and restored both original hand-tracking parents. A mount edit and Undo restored the exact starting hash. |

The [recorded interaction receipt](evidence/native-workbench-recorded.json) retains exact new-drawing repair values, equality checks and actual surface placement. The [gesture receipt](evidence/native-workbench-gestures.json) also retains direct-reach and control checks. It separates the new-drawing repair from the control demonstration that begins with the bundled drawing. Those inputs are not presented as one unchanged mechanism.

The drawing/repair test scheduled 22 ratchet ticks, one contact cue and three clear cues through three configured voices, with `failed=false`. These counts establish successful scheduling. The film's cue reconstruction uses its own recorded event clock.

## Spatial presentation

Native front, side and Center views were inspected after correcting UIKit's initialization order. Buttons retain a dark fill and bright rim; rods use unlit colour. At a far view, controls and detail disappear, leaving one status mark. Near views expose a few safe rod-length plates and the computed fitting gap. Live mount and mug readouts replace the general instruction during editing.

The final [hint check](evidence/native-hints.json) separately verified a visible static pose beyond the old timeout, hiding on field-of-view exit, reappearing on re-entry and dismissal after a genuine SIK crank gesture. The input stayed unchanged. The public clip clock, rather than the SDK’s ambiguous playing flag, established the stationary pose. Temporary probes were removed and the saved product started cleanly; an unrelated host authentication transport warning is retained in the receipt.

Dimensions remain centimetres. The mug's body, handle and rim lie inside the cylinder used by the checker. The result does not include every decorative component; see [Scope](../README.md#scope).

Placement tests execute the actual placement class against mocked native boundaries: camera-gaze direction, in-view controls, invalid and stale-hit rejection, and one-shot commits. They cover editor and non-editor source branches. The separate real Preview Place run verifies the visible surface interaction; neither test establishes physical-device tracking. Reproduction steps and the deliberate Preview test setup are in [reproducibility](reproducibility.md).

## Companion and earlier checks

The deployed [companion](https://motion-foundry-nine.vercel.app) retains the verified Loop and Petal route families. Earlier desktop/mobile browser checks covered drawing, error inspection, obstacle repair, no-fit recovery, stale-result guards, Undo, downloads and signature/geometry revalidation. Delayed genuine responses exercised timeout, cancellation and overlapping Save behavior. Full records remain in the [historical verification archive](archive/verification-through-2026-11-08.md).

Earlier film and QR measurements describe their recorded geometry. They remain in the [earlier film record](archive/film-r002.md); they do not substitute for a current signed handoff or a new film's frame checks.
