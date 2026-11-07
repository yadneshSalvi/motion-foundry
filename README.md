# Motion Foundry

**Show the motion. Invent the machine.**

[Open the live workshop](https://motion-foundry-nine.vercel.app)

Motion Foundry is a working SPECS Lens and web companion for exploring a kinetic petal. Set the petal's desired angles at fixed crank phases, change its mount spacing or obstacle, and synthesize a four-bar linkage. Reveal the mechanism, turn the crank, inspect alternatives, and keep the exact selected design with its verification record.

The sculpture is one independently solved cell with a rigid decorative petal on its output rocker. Its motion comes from link geometry, not an animation fitted to the requested poses. AI can propose target edits in the companion; only the deterministic solver and separate geometric verifier decide whether a mechanism passes.

## Try the Lens

Open `lens/MotionFoundry.esproj` in Lens Studio. The project was compiled and exercised in Lens Studio 5.23.2 using SPECS 27 Preview, Interactive mode, and SIK mouse interactions. No physical glasses are required for this demonstrated workflow.

1. Watch the petal move, press **Reveal**, and drag **Turn the crank**.
2. Open **Design**. Select **Pose** to cycle through targets; drag the blue target handle or use its slider. **Mount** changes pivot spacing. **Space** adds an obstacle and lets you move it.
3. Press **Solve**. The previous mechanism remains visible until a fresh result passes checks. **Undo** restores the earlier revision and its exact alternatives.
4. Open **Checks**, use **Next** to compare, and press **Save**. With a configured HTTPS companion, a QR code opens the signed design and its JSON/SVG downloads. Without a backend, Save explicitly reports local storage only.
5. **Test conflicting targets**, then Solve, demonstrates an actual infeasible input. Undo recovers the previous design.

The controller uses the portable solver locally when `backendUrl` is empty. Set the Motion Foundry component's `backendUrl` to your deployed companion origin to use HTTPS solving and sharing. Credentials never belong in the Lens. See [reproducibility](devpost/reproducibility.md) for the scene contract and testing details.

## Run the companion

Use Node.js 22:

```sh
npm ci
cp .env.example .env
npm run dev
```

Open `http://localhost:3101`. The example, manual edits, solver, JSON export, and drawing work without a model key. The optional **Describe a movement** flow calls the server, displays a proposed change, and requires acceptance before a separate solve.

Configure `MOTION_SIGNING_SECRET` with a randomly generated secret of at least 32 characters for production signing. Configure `OPENAI_API_KEY` and/or `GEMINI_API_KEY` to enable language proposals. Optional `OPENAI_MODEL` and `GEMINI_MODEL` select provider models. `BACKEND_BASE_URL`, when set, must be the real HTTPS origin used in shared links. All of these are server environment variables; none use a public-client prefix.

```sh
npm run typecheck
npm test
npm run verify:examples
npm run build
npm run start
```

The Next.js application uses Node route handlers compatible with Vercel. No database, queue, or object store is required. A fixed search takes tens of milliseconds on the development machine; this is not a hosted-service latency guarantee. Every solve is fresh and bounded. Do not confuse a bounded search finding no result with a proof that no mechanism exists.

## How it works

`src/domain/index.ts` is the portable numerical core. Circle intersection drives playback. A separate law-of-cosines implementation verifies closure and target error at the specified phases. Full-cycle reachability uses analytic distance extrema; clearance uses capsule geometry at the reported phase samples, including declared layers and thicknesses.

Search uses an analytic Freudenstein seed plus a deterministic seeded multistart refinement. Input phases, tolerances, obstacles, and mount positions are immutable during a solve. Results identify the input revision and canonical input hash. Edits, cancellation, and retries prevent old requests from replacing a newer design.

The web companion is Next.js, React, and Three.js. The Lens uses authored procedural meshes, SIK interaction, and UIKit controls. `lens-src/` contains the editable native scripts. `npm run lens:sync` updates the portable domain copy and mirrors authored scripts into `lens/Assets/Scripts/`; the command does not operate the editor.

## API and exports

| Endpoint | Purpose |
| --- | --- |
| `POST /api/solve` | Validate a `DesignInput`, search, independently verify, and sign a successful result. |
| `POST /api/intent` | Return a validated proposal tied to the current input hash; never approve geometry. |
| `POST /api/exports` | Revalidate a selected candidate from a solve receipt and download JSON or SVG. |
| `POST /api/shares` | Revalidate a selected receipt candidate or a local candidate and issue a signed, self-contained link plus a QR matrix when it fits. |
| `GET /design/[token]` | Verify the signature and geometry, show the drawing, and offer downloads. |
| `GET /api/download?token=…` | Download the shared JSON; add `format=svg` for the drawing. |
| `GET /api/health` | Check service and configuration availability without disclosing credentials. |

The JSON records centimetres/radians, coordinate frame, complete inputs, selected dimensions, seed, revision, verification, and a sampled trajectory. The SVG is an inspection drawing, not a fabrication file. Export always uses the selected alternative and rechecks it. HMAC signing protects receipts and links; the portable FNV input hash is only an identity check, not a cryptographic signature.

Links have **no scheduled expiry**. They remain usable while the service and signing key are maintained. Rotating the key invalidates existing links. Link payloads are bounded and contain the design itself; anyone with a link can read it. There is no account-based access control or server-side deletion list. Download the JSON for an independent copy.

## Verification and limits

The test suite covers continuous playback closure, an independent verification path, held-out mechanisms, real obstacle-driven resynthesis, singularity rejection, contradictory inputs, deterministic search, stale responses, tampered receipts, key rotation, bounded payloads, and exact-alternative exports. The four committed [examples](examples/) can be recomputed with `npm run verify:examples`.

Actual Preview interactions passed playback, reveal, crank dragging, contextual navigation, pose dragging, mount edits, obstacle edits, local solving, undo, alternative selection, contradiction recovery, and local save. A QR fixture was decoded from an actual Preview capture. See the [verification record](devpost/verification.md) for precisely what was tested.

Clearance is sampled; collisions between samples are not excluded. Adjacent pivot neighborhoods are exempt. Decorative petals, the display base, inter-layer axles, loads, bearings, fabrication, and physical manufacturability are outside the verifier. No hardware hand-tracking or device performance claims are made.

## Project record

- [Design brief](devpost/design-brief.md)
- [Iteration log](devpost/iteration-log.md)
- [Reproducibility and demo walkthrough](devpost/reproducibility.md)
- [Verification evidence](devpost/verification.md)
- [Third-party notices](THIRD_PARTY_NOTICES.md)

Built for [Learn AR with SPECS](https://learn-specs.devpost.com/). Private working plans and populated environment files are excluded from Git. Public submission and video publication are separate release steps.
