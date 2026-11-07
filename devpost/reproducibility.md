# Reproduce Motion Foundry

Live companion: **https://motion-foundry-nine.vercel.app**.

## Web and numerical examples

Install Node.js 22, then run the following from the repository root:

```sh
npm ci
cp .env.example .env
npm run typecheck
npm test
npm run verify:examples
npm run dev
```

Open `http://localhost:3101`. A real model key is optional. Production signing requires `MOTION_SIGNING_SECRET` with at least 32 random characters. Development uses an explicitly development-only key when no secret is configured. `OPENAI_API_KEY` enables the first language provider; `GEMINI_API_KEY` enables its bounded fallback. Defaults are `gpt-6.1-sol` and `gemini-4-argon`; environment overrides are supported. Each provider gets one attempt, a 23-second deadline, and a 2,200-output-token cap.

`npm run verify:examples` reads committed JSON and performs fresh synthesis. It does not load saved solver results or call AI.

| Fixture | Expected outcome |
| --- | --- |
| `examples/baseline.json` | Three verified alternatives; 8 cm ground, reference geometry 2/7/5 cm. |
| `examples/obstacle-before.json` | Three alternatives with the obstacle outside the moving links. |
| `examples/obstacle-after.json` | One alternative after relocation; the old geometry fails, the new geometry passes. |
| `examples/contradictory.json` | Infeasible: same-phase targets have disjoint angular tolerances. |

The obstacle fixtures explicitly allow 0.12 radians of angular error, about 6.88°. The baseline tolerance is 2°. The clearance challenge changes the tolerance visibly rather than hiding a relaxation in the solver. The reference assembly is also available as `examples/assembly.svg`.

To call the API locally:

```sh
curl http://localhost:3101/api/solve \
  -H 'Content-Type: application/json' \
  --data-binary @examples/baseline.json
```

For a production build, run `npm run build` then `npm run start`. The root Next.js app is Vercel-compatible. Keep the configured signing key stable to preserve existing links. Set `BACKEND_BASE_URL` only to the actual deployment origin. Per-instance request limits are a best-effort guard, not a distributed quota or an authentication system.

## Native project

Open `lens/MotionFoundry.esproj` in Lens Studio 5.23.2. The supplied scene includes SIK, UIKit, Icons, Motion, camera/render setup, and the authored Motion Foundry component. Use SPECS 27, Interactive Preview, and Plane or a suitable background. Focus Preview before clicking controls.

The saved root transform is `(0, 0, -110)` cm, identity rotation, unit scale. The component requires five material inputs: champagne, porcelain, mint, sky, and coral. Porcelain renders the thin petal surfaces on both sides. The installed scene already wires them. No vendor API keys or signing keys should be placed in any Lens field.

Set `backendUrl` in the component Inspector to `https://motion-foundry-nine.vercel.app` for the hosted solver and signed export flow. Clear that field to exercise the portable local solver. The displayed source distinguishes **Bundled example**, **Local solve**, and **HTTPS solve**. A missing endpoint is an intentional offline mode; a failed configured network request keeps the previous design and offers retry.

Authored scripts live in `lens-src/`. The numerical source of truth is `src/domain/index.ts`. After editing those sources outside an active editor test:

```sh
npm run lens:sync
npm run lens:check
```

The sync command copies source files only. Recompile and run Preview in Lens Studio afterward. The check command is read-only and detects divergence among the portable core, authored native scripts, and imported script mirrors.

## Demonstration walkthrough

1. Begin with the labeled bundled petal, running at revision 0. Pause, reveal the linkage, and scrub the crank through a full cycle.
2. Open Design. Cycle Pose to a target, drag its blue handle, and note the edited revision and retained previous mechanism.
3. Solve. Check the fresh source label, error, closure, and alternatives. Move to Checks and select Next.
4. Return to Design, change Mount or Space, and solve again. Undo should restore the previous input, candidate, and alternative list.
5. Open Checks and choose Test conflicting targets. Solve should report the same-phase contradiction; Undo recovers.
6. With the HTTPS endpoint configured, Save should display a QR for the selected current candidate. Open it on another screen, inspect the assembly drawing, and download JSON and SVG. Check that revision, link dimensions, and selected candidate match the Lens.

The web companion offers a parallel workflow with target sliders, obstacle position/radius controls, a motion chart, explicit verification details, and optional natural-language proposals. An accepted proposal remains an unverified edit until Solve succeeds.

## Interpreting the evidence

Centimetres and radians are canonical in every payload. The native study scales all dimensional input quantities by two; it does not merely enlarge the rendering. Its initial 16/4/14/10 cm mechanism has the same angular targets as the web's 8/2/7/5 cm reference.

A 365-pose report means 360 uniformly spaced input phases plus five target phases. The exported visualization samples 361 points, including both ends of a closed cycle; those are a trajectory representation, not an extra proof of continuous collision clearance. Review the explicit limitations in each JSON record before using the geometry beyond the demonstrated study.
