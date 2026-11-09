# Verification

Updated 10 November 2026. These results separate numerical checks, actual Lens Studio Preview interactions and physical-device testing. The [technical reference](technical-reference.md) describes the model; [Scope](../README.md#scope) states its limits.

## Source and saved project

The final check set passed **99 tests across 14 files**, three shipping-scene tests, web and native TypeScript, four freshly solved Petal examples, and the production build. The saved native mirrors pass `lens:check` across 38 files. The shipping check finds 144 scene entities, one product entry and 18 resolved optional test assets, with no active test registry or LEAF messaging bridge.

The numerical tests cover ordered closed-curve fitting, both drive directions, full-turn reachability, capsule contact and height layers, bounded no-fit results, signed exports and stale-result rejection. Spatial tests cover live match segments, plane projection, gesture seams, placement gates, state restoration, hints, label placement and hit-target separation. Mocked SDK boundaries establish source behavior; the Preview runs below establish actual native interaction.

After filming, the temporary registry, messaging bridge and frame sampler were removed through the editor. The project was saved, closed, reopened, compiled and started successfully. Its exact scene hash is in the [current native summary](evidence/native-r004.json). Optional scenarios remain in the clearly named Tests folders and are not attached to the shipping scene.

## Current Preview workflow

The current recording uses Lens Studio 5.23.2, SPECS 27 Interactive Preview in Sunlit Room, SIK 2.0.0, UIKit 2.0.0, official 3D Hints 2.0.0 and LEAF 2.0.2. Visible synthetic hands use the actual SIK hover, pinch, drag and release paths. HTTPS synthesis is followed by independent local checking before installation.

| Interaction | Observed result |
| --- | --- |
| Draw and solve | The new closed drawing committed as `fnv1a-7dda7bc7`; the solver returned a machine for that input. |
| Crank and persistent match | The first recorded full cycle advanced 6.30082 radians in 14.957 seconds. All 360 displayed segments were inspected and matched. Mint persists after the pen passes. |
| Lean in | The actual camera approached and returned. At least two length plates and the fitting detail remained readable for 8.262 seconds. |
| Add the mug | The hand added the stand-in to the drawn design. A rod physically entered it by 0.04269 cm; the collision was not merely a safety-buffer warning. |
| Repair the same drawing | The blocked and repaired requests were exactly equal, hash `fnv1a-c35a3906`. The new machine completed another full cycle, 6.29504 radians in 14.939 seconds, with all 360 displayed segments matched. |
| Edit and undo | On this same drawing, the fit dial changed 3 → 2 → 3 mm, the mug radius changed 4.5 → 5 → 4.5 cm, and the mounts changed 16 → 17 cm. The held 17 cm value stayed exposed; Undo restored the prior input. |
| Place the workbench | A genuine upward WorldQuery hit and visible SIK confirmation produced exactly one placement commit. The dashed footprint was 30 × 24 cm. |
| Save and share | The final revision-6 design was checked again, saved and exported. Its exact native QR decoded from four recorded frames. Opening that link in the companion revalidated its signature, input and 720 sampled poses. |

The final handoff hash is `fnv1a-ec80dc0a`. Its maximum fit error is **0.296973 cm**, within the 0.30 cm limit; its sampled clearance margin is **0.025001 cm**. These final values follow the deliberate control edits and are not substituted for the earlier repair result.

The main native interval is 90.5 seconds at normal speed. Dense sampled image review found the touched drawing, outboard crank, mug and resulting motion visible. The selected first mint payoff has at most 18.75% recorded projected loop coverage. This is a selected-view result, not a claim about every phase or every frame. The actual additive Center image shows the earned mint drawing. Film encoding and sound checks are documented separately from native acceptance.

## Host Preview frame times

A five-second busy-state window from the same product revision, with the crank playing and near labels visible, recorded 222 host UpdateEvent intervals: median **22.226 ms**, p95 **24.469 ms**, maximum **63.842 ms**. This was collected during diagnostic logging and screen recording. It is not physical SPECS FPS, GPU timing or script self-time.

## Practical limits

Placement is a surface hit, not object recognition. The mug is a manually sized stand-in. Physical Spectacles tracking, comfort, performance and phone scanning have not been tested. The present handoff is a Preview QR/link; sending directly to a paired phone is future work.

Fit and contact checks sample the modeled geometry. They do not establish fabrication feasibility, loads, bearings or between-sample clearance. A failed bounded search does not prove that no solution exists. Earlier [verification](archive/verification-before-r004.md) and [film records](archive/film-r002.md) remain historical evidence for their own source revisions.
