# Technical reference

## Mechanism and independent checks

Fixed pivots A and D establish the mount spacing. Circle intersection computes the moving joints B and C for each crank phase. A tracing point P has constant along/across coordinates in the coupler's local frame. The two rods B→P and C→P represent that rigid attachment; its interior is not rendered or checked as a solid plate.

The bounded solver searches three moving-link lengths, two pen coordinates, starting phase, assembly branch and drive direction. Seeded differential evolution and refinement minimize ordered fitting error with obstacle penalties and feasible-result retention. A separate law-of-cosines calculation verifies returned geometry. Full-turn reachability is analytic; fitting and clearance use 720 poses by default.

Cyclic ordered arc-length correspondence permits a different starting point on a closed stroke, while preserving its direction and traversal through crossings. Playback advances the physical crank, so the pen's speed varies naturally. The desired stroke never sets the pen's animated position. Largest-error and collision reports identify actual crank phases and geometric locations.

`src/domain/loop.ts` contains Loop. `src/domain/index.ts` retains Petal's fixed-phase angular synthesis. Petal reference verification uses 360 uniform phases plus five target phases, totaling 365. Exported trajectories contain 361 points including both ends of a cycle; that visualization array is distinct from the verifier's pose count.

## Physical display

Native defaults are centimetres: 16 cm mounts, rod radius 0.45, depth 0.70, and layer centres ground 0.6 / crank 1.8 / rocker 3.0 / coupler 4.2. The native fit limit is 0.30 cm. Web Loop starts with 8 cm mounts and 0.15 cm fit limit. They are separate inputs; native thickness was explicitly reverified.

Rod meshes use the same capsule envelope as the numerical input. The mug's bowl, handle and rim are procedurally contained inside its declared cylinder. Its starting radius is 4.5 cm, depth 4 cm and vertical centre 2 cm; sizing changes its actual input and invalidates the prior result. The stand-in is shown only in Preview. Other decorative hardware is outside the general verification scope; see [Scope](../README.md#scope).

## API

| Endpoint | Purpose |
| --- | --- |
| `POST /api/loops/solve` | Validate `loop-1.0` input, perform bounded synthesis, independently check results and sign a success receipt. |
| `POST /api/loops/exports` | Recheck a selected receipt result and return JSON or SVG. |
| `POST /api/loops/shares` | Recheck a receipt or raw result and issue a signed self-contained design link and QR when it fits. |
| `GET /design/loop/[token]` | Check signature and geometry, then show the drawing and downloads. |
| `GET /api/loops/download?token=…` | Download exact JSON; add `format=svg` for the assembly drawing. |
| `POST /api/solve`, `/api/exports`, `/api/shares` | Compatible Petal contracts. |
| `POST /api/intent` | Optional structured Petal proposal; never numerical approval. |
| `GET /api/health` | Report configuration availability without credentials. |

The Next.js Node handlers are Vercel-compatible. No database or object store is required. Numerical requests have fixed budgets; there is no per-frame network dependency. Failure to find a mechanism within a budget is not proof of mathematical impossibility.

## Exact sharing and state

Capture establishes 64 ordered points in 0.001 cm increments before solving or hashing. This is storage precision, not a measurement claim. The signed format losslessly packs these coordinates; arbitrary unquantized API inputs retain their exact JSON values. Payload sizes and decompression are bounded. An oversized link returns an explicit failure rather than an unusable QR.

JSON includes exact input, units, coordinate frame, dimensions, input identity, verification scope and physical motion samples. SVG includes desired/actual paths, obstacles, fit, clearance and dimensions. HMAC authenticates tokens; FNV only identifies an input. Anyone with the link can read its design. Links have no scheduled expiry and depend on the service and signing key; key rotation invalidates old links. Download JSON for an independent copy. Older Petal links remain compatible.

Native solve and share use distinct request generations, deadlines and exact input/result checks. Cancel, edits and Undo invalidate older work. Export requires the current input to match the accepted result and is checked again on the server.

## Configuration

Use Node.js 22. Production signing requires `MOTION_SIGNING_SECRET` with at least 32 randomly generated characters. `BACKEND_BASE_URL` must be the actual HTTPS origin used for links. These values and model keys remain server-only. Development's fallback signing key is explicitly unsuitable for production.

Optional Petal language proposals use `OPENAI_API_KEY` and/or `GEMINI_API_KEY`; `OPENAI_MODEL` and `GEMINI_MODEL` override the configured models. Each provider gets one bounded attempt. A validated proposal still requires a numerical solve. Request limits are best-effort per-instance guards, not distributed quotas or authentication.
