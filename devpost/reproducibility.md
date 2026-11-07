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

Open `http://localhost:3101`. `verify` runs typechecking, the 37-test suite, fresh Petal fixtures and a production build. For the built application, stop the development server and run `npm run start`.

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

## Native project and controls

Open `lens/MotionFoundry.esproj` in Lens Studio 5.23.2. Use SPECS 27, Interactive Preview and a suitable background. Focus Preview before interacting. The supplied scene includes SIK, UIKit, camera/render setup and the authored component. The saved root is `(0, 0, -110)` cm with identity rotation and unit scale; the camera is unchanged. Five material inputs are already wired.

The component's `backendUrl` is `https://motion-foundry-nine.vercel.app`. No provider or signing keys belong in the Lens. Native Loop searches use HTTPS so Preview remains responsive. Clearing the endpoint leaves the bundled mechanism and drafting usable, but fresh Loop synthesis and sharing require a connection. Petal alone retains a portable local solve with an empty endpoint.

The native Loop workflow below passed actual Preview gestures and production handoff. The [verification record](verification.md) includes the exact drawing/repair results, full-frame QR decoding and the separate supplemental delayed-response checks.

1. Begin in Loop. Play/pause and the crank slider expose physical motion; Reveal toggles construction and tracing views.
2. Open Draw. **Place** moves the pen before capture. **Draw** records the next standard SIK drag on the planar board. A large open stroke requires **Close** or **Clear**. The completed stroke becomes one input revision.
3. Controls offers **Point**, **Mount**, **Space** and fit-limit editing. Point selects an ordered handle; the pen drag changes its two coordinates. Press **Solve** for a fresh HTTPS result and **Undo** to restore prior work.
4. Checks offers **Next**, **Fit error**, **Contact**, **Study** and **Save**. Study adds the reference crank obstruction, and a new solve must preserve its drawing and stated constraints.
5. Save a verified reference or solved candidate, open the rendered QR/link on another screen and compare its exact JSON with the native input and parameters. QR image decoding in Preview does not establish physical camera scanning.
6. Switch to Petal to inspect the retained angular-target experience. The modes keep separate designs and saved-state keys.

The native reference consistently doubles all physical quantities from the web study: 16 cm mounts, 4/14/10 cm moving lengths and a 0.30 cm fit limit. This is physical geometry, not a cosmetic rendering scale.

Authored scripts are in `lens-src/`; the numerical sources of truth are `src/domain/index.ts` and `src/domain/loop.ts`. Outside an active editor test, synchronize and check the ten native source mirrors with:

```sh
npm run lens:sync
npm run lens:check
```

These commands copy/check sources only. Recompile and exercise Preview afterward; a matching mirror does not prove runtime behavior.

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
