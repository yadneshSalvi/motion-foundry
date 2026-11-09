# Reproduce Motion Foundry

## Open the native workbench

Open `lens/MotionFoundry.esproj` in Lens Studio 5.23.2. Select Interactive Preview and Sunlit Room. SPECS 27 works directly; Horizontal Preview needs the SPECS Device Override for the same SIK input setup.

The saved table owner is `(−30, −142.4, −474)` cm, yaw 0°, scale 1. The board is centred internally. A working camera is `(-30,-101.1,-424.2)` cm looking at `(-30,-142.9,-474)`, about 65 cm away and 40° below horizontal. Set the camera after a Preview refresh because refresh restores its saved pose. Use the actual Preview window when assessing proportions.

The `MotionFoundry` component uses `https://motion-foundry-nine.vercel.app` for HTTPS synthesis and sharing. Its material inputs, three original cue tracks and camera AudioListener are wired. The old separate cylinder input is disabled by the product; LoopAssembly creates the bounded mug body, handle and rim itself.

## Try the native flow

1. Turn the large grip. Hover highlights it; release leaves a smoothly slowing crank and a trace produced by actual linkage poses.
2. Choose **Draw**. Pinch and move on the board. The nib follows. A sufficiently long stroke closes on returning within 1.5 cm of its start. A large open gap stays open; resume at the bright end or choose **Clear**.
3. Turn the fit dial to select 1–5 mm, then **Make it**. The pending pulse is not a proposed mechanism. Wait for the actual response and independent local check.
4. Turn the new mechanism through a complete cycle. Approach to see the actual fitting gap and rod lengths. Moving away hides detailed controls.
5. Pinch the empty mug ring to add the stand-in, move it, and drag its rim handle to size the keep-out. If it meets a rod, inspect that contact and choose **Make it** again. The current drawing, mount spacing, fit limit and obstacle must remain identical throughout the search.
6. Move a mount and use its nearby **Undo** chip. One completed nonzero edit creates one history entry. A no-motion grab creates none. Tools retains Undo after the chip closes.
7. Choose **Save**. Decode the tag and compare the companion's downloaded input and mechanism with the native snapshot. The companion independently rechecks it.
8. Use **More → Place**, aim at a horizontal Preview surface and pinch **Place here** after a real hit. The board moves once and stays there. The initial device branch requires placement; Preview also offers its saved spot.

Native starts at 16 cm mounts and 3 mm fit limit. The web example starts at 8 cm and 1.5 mm. Both store lengths in centimetres. [Technical reference](technical-reference.md) describes physical envelopes and [Scope](../README.md#scope) distinguishes simulation from hardware.

## Native source and deliberate testing

Canonical native source is in `lens-src/`. Numerical sources of truth are `src/domain/index.ts` and `src/domain/loop.ts`. When Preview is stopped:

```sh
npm run lens:sync
npm run lens:check
npx tsc -p tsconfig.lens-source.json --pretty false
```

The sync command mirrors 19 product/domain and 9 LEAF scripts. It copies files; runtime compilation and actual interaction still need Lens Studio. Scene and package edits use Lens Studio MCP. Never edit generated Cache files.

Test dependencies are LEAF 2.0.2 and Bitmoji 3D 10.0.1. The normal workbench does not instantiate a Bitmoji avatar. Run tests intentionally in a working copy:

1. Add a temporary SceneObject with `Assets/Scripts/leaf/LeafIndex.ts`. Its imports register the scenarios; do not attach each scenario as another component.
2. Open the official LEAF panel and choose Preview. Let it own its single messaging bridge. Wait for the registration list; do not create duplicate bridges or start the same scenario twice.
3. Start Preview and set the documented camera afterward. Follow each scenario's input preconditions. Each scenario constructs its own supported hand-interactor subclass and restores tracking on teardown; it does not reuse LEAF's destroyed static hand wrapper. The journey, controls, opening and export have also run sequentially through the real manager.
4. Retain the scenario result and matching runtime interval. Remove the index, bridge and diagnostic bindings when returning to normal use, then recompile and restart the scene.

If the panel fails to list already registered scenarios, the installed `DefaultScenarioManager.startScenario` and `ScenarioConfig` APIs can start the same registered scenario from a temporary test-only component. This route uses the actual LEAF runner; it must not inject product state or replace the scenario with direct handler calls. Remove that bootstrap afterward.

| Scenario | What it checks |
| --- | --- |
| `motion-workbench-draw-solve-crank-repair` | A visible synthetic SIK hand captures a new stroke, snap-closes it, obtains a live result, cranks, adds the mug and repairs with the same input. |
| `motion-workbench-direct-reach-and-undo` | Direct IK crank reach, clean hand-driver teardown, a mount edit, no-op handling and exact Undo. |
| `motion-workbench-film-rehearsal` | A paced continuous version with actual solve waits, full cycles and timestamped observations. |
| `motion-workbench-controls-film` | Fit 3 → 2 → 3 mm, rim 4.5 → 5 → 4.5 cm, mount edit/Undo, then a fresh solve of the final input. |
| `motion-workbench-placement-film` | Real WorldQuery hit and real SIK Place here; no injected hit or pose. |
| `motion-workbench-opening-film` | A visible hand turns a current valid mechanism without editing it. |
| `motion-workbench-export-film` | Save the current valid repaired design and require its actual returned tag. |

Individual fit, mug and mount scenarios are also registered. See the [scenario guide](../lens-src/leaf/README.md). Export continues the current repaired design rather than resetting to a fixture. The test drawing follows a reference-derived path translated 0.06 cm; runtime capture and resampling determine its exact input. It is a scripted input test, not a human freehand claim.

The per-scenario hand helper keeps the actual thumb/index midpoint at each Direct input point, observes genuine SIK trigger events, releases selection and retreats after actions. Product-audio observers only read cue counters and timestamps. They do not play sounds or establish acoustic capture.

## Run the companion and numerical checks

Use Node.js 22:

```sh
npm ci
cp .env.example .env
npm run verify
npm run dev
```

Open `http://localhost:3101`. `verify` runs the web typecheck, 59 tests, four freshly solved Petal fixtures and a production build. The native typecheck and `lens:check` are separate commands above. Stop the development server before `npm run start` to use the production build on the same port.

Manual Loop/Petal synthesis needs no model key. Server signing and optional model settings are in `.env.example` and the [configuration reference](technical-reference.md#configuration). Never put credentials in the Lens or browser.

For Loop, draw or edit a path, solve, inspect its largest error, add an obstacle and solve again. A large unachievable stroke should keep the prior geometry with stale export disabled; Undo should restore it. Save and reopen a signed page; compare exact input and selected parameters. Desktop and 390 px mobile layouts are supported.

Petal's four retained fixtures are `baseline.json`, `obstacle-before.json`, `obstacle-after.json` and `contradictory.json`. `npm run verify:examples` synthesizes them afresh. The contradiction has disjoint same-phase angular bounds and is rejected before search. Its older obstacle fixture has a wider explicit angular allowance; do not confuse it with Loop's unchanged-fit repair.
