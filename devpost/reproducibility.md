# Reproduce Motion Foundry

[Open the deployed workshop](https://motion-foundry-nine.vercel.app). Loop is the opening mode; Petal remains available from the mode switch.

## Run the web companion

Install Node.js 22 and run these commands from the repository root:

```sh
npm ci
cp .env.example .env
npm run verify
npm run dev
```

Open `http://localhost:3101`. `verify` runs typechecking, the 46-test suite, fresh Petal fixtures and a production build. For the built application, stop the development server and run `npm run start`.

Manual design, deterministic synthesis and downloads need no model key. Production signing requires `MOTION_SIGNING_SECRET` with at least 32 random characters. Development uses an explicitly development-only key if none is configured. Set `BACKEND_BASE_URL` only to the actual deployment origin. Keep the signing key stable to preserve links. Request limits are per-instance best-effort guards, not a distributed quota or account authentication.

Optional Petal language proposals use `OPENAI_API_KEY` and/or `GEMINI_API_KEY`. Defaults are `gpt-6.1-sol` and `gemini-4-argon`, with environment overrides. Each provider gets one attempt, a 23-second deadline and a 2,200-output-token cap. A model proposal is never a verified mechanism.

## Draw, synthesize and inspect

1. Start in Loop. The reference is explicitly a known mechanism: 8 cm mounts, 2/7/5 cm moving links and a rigid coupler attachment. Pause or scrub the crank to inspect its actual timing.
2. Choose **Draw loop** and draw inside the centimetre board. End near the starting ring, or use **Close loop** to add a deliberate final segment. A large open gap is not silently closed. **Edit points** changes the ordered stroke.
3. Check the mount spacing and maximum fit error, then choose **Synthesize linkage**. The search cannot change these values, physical scale or obstacles to manufacture success. It returns only independently verified candidates.
4. Compare dashed desired and solid actual traces. Open **Checks → Inspect largest error** to pause at a physical crank pose and inspect the connected desired/actual points. The displayed error must be below the declared limit for a fresh accepted result.
5. Load **Try the clearance study**. The obstacle intersects the reference crank. Inspect contact, then solve again. The drawing, 8 cm mounts and 0.15 cm fit limit stay unchanged. The selected repaired design has a different crank and a positive sampled clearance margin.
6. Try a large or sharply cornered drawing. If the bounded search finds no acceptable mechanism, the previous geometry remains visible and stale, and export is disabled. Undo recovers the prior input and result.
7. Export a fresh candidate. Open its signed page, inspect the assembly SVG including obstacles, and download JSON. Compare `input`, selected parameters, revision/hash and verification scope with the workshop. Keep JSON as an independent copy; links depend on the service and signing key.

Capture establishes 64 ordered samples in 0.001 cm increments (0.01 mm) before hashing or solving. This is representational precision, not measurement accuracy. Signed handoff preserves those exact values. Arbitrary valid API drawings that are not quantized retain their exact JSON coordinates.

Cyclic ordered arc-length correspondence allows the start of a closed drawing to vary while preserving traversal order. It does not reproduce the speed of the hand stroke. Playback uses a uniformly advancing physical crank, so the tracing point changes speed naturally. Self-intersections are supported when a mechanism can reproduce their ordered traversal.

## Native tabletop project

Open `lens/MotionFoundry.esproj` in Lens Studio 5.23.2. Select SPECS 27, Interactive Preview and **Sunlit Room** for the current staging. The saved project supplies SIK, UIKit, camera/render setup and the authored component. For Horizontal Preview, use the explicit SPECS Device Override; that configuration was observed to retain working SIK input. Use the actual native Preview window for visual review: a diagnostic MCP screenshot path was observed to stretch the viewport vertically, while the native window kept correct proportions.

The current saved table-frame contract is position `(−30, −142.4, −474)` cm, yaw 0° and unit scale, with the board centred internally on the Sunlit Room sideboard. The earlier Colorful Home pose is retained in the revision record as historical setup evidence. The current composition has accepted native front/orbit and Spectacles Center source captures; repeat those views after changing placement or geometry. A separately recorded direct-reach camera is `(-30, -100, -438)` cm looking at `(-30, -139, -474)`; a passing far-field gesture does not prove direct reach.

The `MotionFoundry` component uses `https://motion-foundry-nine.vercel.app` as its backend. Provider and signing secrets stay on the server. Five material inputs, the three original cue WAVs and a camera AudioListener are wired through native editor tools. The optional provided cylinder must measure **9 cm in diameter × 4 cm high**, Y-up. Its declared centre is `(−8.90, 0, 2)` in the board's x/y/height frame; the runtime positions it from that exact input. It is a manually aligned fixture, not a detected object. For the bundled cylinder mesh with unit AABB approximately `0.999332 × 1 × 0.999332`, use scale approximately `9.006016 × 4 × 9.006016` cm to obtain the intended envelope.

Native rods have 0.45 cm radius, 0.70 cm depth and layer centres 0.6/1.8/3.0/4.2 cm. The reference has 16 cm mounts, 4/14/10 cm moving rods and a 0.30 cm fit limit. These are explicit native inputs; do not describe them as uniformly doubling every web quantity. The engines and exported contracts are unchanged.

## Native journey

1. At idle, turn the large crank grip or select **Draw**. Standard SIK near/far input drives the physical targets; Preview input simulates the interaction.
2. Pinch-drag directly on the board. Releasing within 0.9 cm of the start closes it; a larger gap remains open until **Done** explicitly adds the final segment. **Clear** restarts the drawing.
3. Select **Make it**. Wait for the actual HTTPS response and independent local verification. The linkage's pen traces only physical coupler poses. Turning the grip changes phase without editing the drawing or its revision.
4. Approach the largest-error rings, or reach **More → Tools → More → Error**. The witness shows desired and actual positions at a physical crank phase. The fit dial changes the declared limit; it does not visually improve a prior result.
5. Select **More → Study** to load the separate provided-container case. The old crank meets the container. Select **Make it again**; require a fresh result with every input field unchanged and a positive sampled rod-clearance margin. Record the actual run's values, not an earlier fixture's numbers.
6. Drag the movable mount or container. One nonzero completed drag creates one edit; a no-motion grab creates none. Undo restores the exact prior input, selected candidate, alternatives and receipt. A failed or timed-out solve retains the prior mechanism without treating it as current.
7. Choose **Keep**. The side tag must show the exact new signed URL without covering the assembly. Decode a fresh full Preview frame, open that URL, and compare the downloaded input and selected mechanism with the native snapshot. The earlier large-card QR test does not validate this smaller tag.
8. For explicit placement, use **More → Tools → More → Place**. An upward WorldQuery hit and a standard SIK pinch place the owner once; cancel keeps the authored fallback. Record the real native outcome before claiming placement acceptance.

The active status is in [native-tabletop.md](native-tabletop.md). Native UI has at most three primary contextual tools per state. Petal is hidden in this native journey but remains available in the companion and retained source.

## Native source and LEAF

Authored scripts are in `lens-src/`; numerical sources of truth are `src/domain/index.ts` and `src/domain/loop.ts`. Outside an active native test, the editor owner synchronizes the **16 product and eight LEAF source files**:

```sh
npm run lens:sync
npm run lens:check
npx tsc -p tsconfig.lens-source.json --pretty false
```

Sync copies source only. Compile and exercise Preview afterward; matching mirrors do not prove runtime behavior. Scene, package and asset edits use Lens Studio MCP. Never modify generated Cache files.

The production scene starts without an active scenario index, LEAF messaging bridge or inspection helper. The retained test dependencies are **LEAF 2.0.2** and **Bitmoji 3D 10.0.1**, alongside the existing SpectaclesInteractionKit package. They support deliberate testing; the main workbench does not instantiate a Bitmoji avatar.

To re-enable testing, use a working copy of the scene and native Lens Studio editor tools:

1. Create a temporary `LeafIndex` SceneObject and attach `Assets/Scripts/leaf/LeafIndex.ts`. Its imported capture index also registers the isolated export scenario; do not attach individual scenario classes.
2. Open the installed **LEAF** panel intentionally. The official panel creates its temporary `LEAF Plugin Bridge` using `Leaf.lspkg/Scenarios/scenario/MessagingBridge.ts`. Let the panel own that component; adding a second bridge can run a scenario twice.
3. Compile, select **Preview** as the LEAF target, wait for registration and list the scenarios. Use the matching documented viewpoint, fresh Preview when required, fail-fast diagnostics, and the actual scene controls.
4. After the run, retain its report and matching runtime interval. Close the LEAF panel (its teardown removes its bridge), remove the temporary index attachment and any inspection helper, then restart Preview and save the clean production scene.

Run these primary scenarios:

- `motion-workbench-draw-solve-crank-repair` uses real SIK target routes for an open stroke, explicit closure, fresh HTTPS solve, crank/ink motion and same-input repair. It also records all three configured cue scheduling counters and rejects an audio exception.
- `motion-workbench-direct-reach-and-undo` requires actual direct routing with fail-fast IK diagnostics, then tests a mount drag, no-motion input and exact Undo.

The separate `motion-workbench-film-rehearsal` has a [paced Preview contract](../lens-src/leaf/FILM_REHEARSAL.md), real full-cycle checks and explicit scripted-input disclosure. It is not either primary acceptance test. Its accepted continuous main source contains the complete drawing and separate Study repair with both actual cycles. The separate `motion-workbench-export-film` capture test requires a fresh Preview at revision 0; it uses real controls to reconstruct r3 Study, checks the exact accepted input/mechanism, and opens Keep after a 3-second readiness lead-in. The returned QR is held for 8 seconds.

The [scenario source guide](../lens-src/leaf/README.md) gives the scene snapshot and test contract. These are simulated native inputs, not human performance or physical hand tracking. Preserve the actual scenario report and matching runtime interval, including warnings. The shipped demonstration scene keeps the scenario index and bridge absent; merely retaining their source and package dependencies does not activate a test.

## Existing Petal examples

`npm run verify:examples` freshly synthesizes the committed Petal JSON fixtures without AI or cached solver results.

| Fixture | Expected outcome |
| --- | --- |
| `examples/baseline.json` | Three verified alternatives; 8 cm ground and 2/7/5 cm reference links. |
| `examples/obstacle-before.json` | Three alternatives with the obstacle outside the moving links. |
| `examples/obstacle-after.json` | One alternative after relocation; old geometry fails, new geometry passes. |
| `examples/contradictory.json` | Infeasible: same-phase angular tolerances are disjoint. |

The Petal obstacle fixtures explicitly allow 0.12 radians of angular error, about 6.88°, versus the baseline's 2°. This older Petal challenge visibly changes tolerance. The new Loop clearance study preserves its original fit limit throughout.

```sh
curl http://localhost:3101/api/solve \
  -H 'Content-Type: application/json' \
  --data-binary @examples/baseline.json
```

Loop uses separate `/api/loops/solve`, `/api/loops/exports` and `/api/loops/shares` contracts. For a saved Loop JSON, send its `input` object to `/api/loops/solve`; do not send the complete export manifest. Both families require the selected candidate to pass independent checks again before export/share.

## Reading verification reports

Centimetres and radians are canonical. Loop's default verification uses 720 poses; Petal's reference uses 360 uniform phases plus five target phases, totaling 365. Exported trajectories contain 361 physical poses, including both ends of the cycle; they are a visualization, not additional continuous-clearance proof.

Reports cover analytic full-turn reachability and sampled closure, fit and capsule clearance. They do not rule out collisions between samples. Exempt joint neighborhoods, rigid attachment-internal contacts, pen hardware, decorative surfaces, axles, loads and fabrication are outside the checks. No physical glasses, hardware hand tracking, device-performance or hardware QR-scanning result is claimed.
