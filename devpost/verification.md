# Verification record

Recorded November 7, 2026. Results below describe the actual test environment and keep local, hosted, and device evidence distinct.

## Automated checks

`npm run typecheck` passed. `npm test` passed **17 tests across two files**. The final Next.js production build passed. `npm run lens:check` confirmed the portable domain and all six native source mirrors match.

The numerical suite checks full-cycle closure against an independent law-of-cosines path, continuous playback, individual angular tolerances and wraparound, layers and capsule thickness, singularity and unknown-parameter rejection, deterministic repeatability, and recovery of held-out known mechanisms on both assembly branches. It distinguishes provable contradictions from bounded search exhaustion.

The API/export suite checks exact-alternative export, signature tampering, wrong token purpose, unrelated candidate IDs, null and malformed inputs, unsupported fields/units, oversized bodies, production secret requirements, key rotation, bounded decompression, oversized Unicode share payloads, revalidation of locally supplied geometry, stale response handling, and drawings for large accepted dimensions.

Fresh fixture results:

| Input | Status | Alternatives | Search evaluations |
| --- | --- | ---: | ---: |
| Baseline | Succeeded | 3 | 69,470 |
| Obstacle before relocation | Succeeded | 3 | 68,612 |
| Obstacle after relocation | Succeeded | 1 | 68,612 |
| Conflicting same-phase targets | Infeasible | 0 | 0 |

The obstacle-after result changed the three moving link lengths to approximately 1.617, 6.898, and 4.019 cm. The old result failed the relocated obstacle. The new result passed 365 sampled poses with about 3.13° maximum target error under its declared 6.88° tolerance. These are genuine fresh numerical results, not labels attached to a preset animation.

## Browser review

The development application on port 3101 and the production build on port 3103 were inspected in a real browser. Desktop and 390 × 844 mobile layouts were checked. The final reviewed production build had no browser console errors.

The review exercised baseline synthesis, three alternatives, Reveal, Space edits, the clearance challenge, contradictory-input failure, Undo, fresh solving, and JSON downloads. A real OpenAI request produced five proposed target edits; acceptance followed by a fresh numerical solve succeeded. The model response was displayed as a proposal requiring verification.

Provider evidence: `gpt-6.1-sol` completed a real OpenAI generation. The Gemini identifier was initially selected from the live [Vercel AI Gateway model catalog](https://ai-gateway.vercel.sh/v1/models), then independently tested through the configured **direct Google SDK** and actual Gemini key. `gemini-4-argon` returned a successful structured proposal in 5.37 seconds, using 659 input and 108 output tokens. The app's `intentSchema` accepted all five target angles, null mount change, and explicit numerical-solve uncertainty. The test used the same 23-second deadline, 2,200-output-token cap, and zero retries as the application. The [sanitized result](evidence/gemini-structured-proposal.json) is retained. Forced OpenAI-to-Gemini failover in production has not been exercised; the two successful provider calls do not establish that separate path.

The final signed-link flow was opened in a fresh tab. The page revalidated signature and geometry, displayed the generated dimensioned assembly drawing, and downloaded the matching JSON. QR generation and the corresponding link were present in the export modal.

The production service is deployed at **https://motion-foundry-nine.vercel.app**. Its unauthenticated health check returned HTTP 200 with AI and signing configured. The connected native solve and both production sharing paths were subsequently verified as described below.

![The actual deployed web workshop](media/web-workshop.jpg)

## Actual Lens Studio Preview

Environment: Lens Studio 5.23.2, SPECS 27, Interactive Preview, Plane/Front view. Tests injected real Preview gestures routed through SIK MouseInteractor, UIKit, and the authored drag component. Runtime state and visible results were checked after interaction. Final compilation succeeded and fresh runtime diagnostics contained no errors.

| Interaction | Observed result |
| --- | --- |
| Play/pause | Phase advances; captures at different times show different geometry and slider positions. |
| Reveal | Petal hides and 72 trajectory dots appear; toggling restores the petal. |
| Crank slider | Actual drag changed phase from about 3.8973 to 2.4647 rad and paused playback. |
| Contextual navigation | Browse, Design, Checks, Back, and Done respond to actual input. |
| Local Solve | Revision 0 returned three independently verified alternatives. |
| Mount edit and Undo | Spacing changed from 16 to about 18.5958 cm; stale state appeared; Undo restored the verified input. |
| Pose handle drag | Target changed from about 1.77215 to 1.85540 rad, creating one revision and pausing playback. |
| Solve after pose drag | Fresh dimensions were approximately 16 / 4.16598 / 14.03814 / 11.13838 cm. |
| Obstacle edit | Space created an obstacle and edited revision; Undo restored the earlier state. |
| Contradiction and recovery | Solve reported disjoint same-phase tolerances, retained previous geometry, and Undo recovered. |
| Next and local Save | Selected an alternative and persisted its native parameters; the UI explicitly said sharing requires the companion. |

A supplemental direct-method regression solved two revisions, restored the earlier one, and selected Next. It confirmed the original alternative IDs and valid input hash were restored. This supplemental check is not presented as a gesture test.

The native QR renderer was also tested with a direct-method fixture containing the text “Motion Foundry Preview QA.” OpenCV decoded that exact text from an actual Preview screenshot. A real UI action then dismissed the card. This validates the renderer, not a production link request.

![Actual Lens Studio Preview after the production integration pass](media/native-preview.png)

## Native production solve and sharing

The native project was saved with `https://motion-foundry-nine.vercel.app` as its backend. Actual Preview gestures through SIK moved a pose target, creating revision 1 with input hash `fnv1a-da84cad4`. Pressing Solve sent that revision to the HTTPS service. The result carried a solve receipt and was independently rechecked inside the Lens before the UI reported **HTTPS solve**.

| Solved native result | Observed value |
| --- | --- |
| Selected candidate | `fnv1a-da84cad4-1` |
| Ground / crank / coupler / rocker | 16 / 4.1617773253 / 14.0369160592 / 11.1079327177 cm |
| Assembly branch | 1 |
| Local verification | Valid; no failures; all five targets passed |
| Verification poses | 365 |
| Maximum target error | 0.026631663964 rad, approximately 1.526°, within the 2° tolerance |
| Maximum closure residual | 8.881784197001252e-15 cm |

Actual Checks → Save exercised two distinct production paths. A freshly reset bundled example, revision 0 / `fnv1a-4799adc5`, had no receipt and sent its raw input/candidate for server re-verification. The edited HTTPS result, revision 1 / `fnv1a-da84cad4`, sent its receipt and selected candidate ID. Both returned signed URLs and displayed native QR cards. Each exact runtime URL opened an HTTP 200 design page; the JSON and SVG download links from both pages also returned HTTP 200.

The revision-1 JSON exactly matched the native revision, input hash, candidate ID, and mechanism dimensions. Native and downloaded verification both passed 365 poses with no failures and identical maximum closure residuals. Their largest target-residual difference was 4.440892098500626e-16 radians. The JSON additionally contains 361 trajectory samples, which are distinct from the verification sample count.

### Rendered QR evidence

**ZXing automatically decoded both full, unmodified 1392 × 1910 Preview screenshots.** No crop or manual corner input was used. The bundled card yielded a 1,068-character URL and the solved card a 1,134-character URL; both exactly matched their runtime export URL. These were actual rendered production cards, with no regenerated QR or backend module reconstruction.

An independent OpenCV 4.13.0 check also recovered both URLs from unchanged screenshot crops. Its bundled-card detector succeeded after cropping; the dense solved card needed four corners measured from the rendered ink bounds. Automatic detection was unreliable with that OpenCV method, including during a temporary runtime enlargement that was reverted. The stronger ZXing result establishes automatic decoding from these full Preview captures. No physical phone-camera or hardware scanning was tested.

![Actual native Preview with the production revision-1 share card](media/native-production-solved-share.png)

The [sanitized production evidence](evidence/native-production.json) retains parameters, verifier results, download hashes/statuses, screenshot and URL hashes, and both decoding methods without private workspace paths or credentials. Final native compilation succeeded. After debugger cleanup, a fresh runtime reset reported no errors; the project was saved and left in the bundled browse/play state with the production endpoint configured.

## Scope of the result

The verifier checks analytic full-rotation reachability and sampled geometric clearance. It does not prove collision freedom between samples. Adjacent pivot neighborhoods are exempt; decorative surfaces, inter-layer axles, forces, bearings, fabrication, and physical manufacturability are excluded.

No physical glasses, hand tracking, reach comfort, device performance, or LEAF test results are claimed. A public demo video and Devpost submission remain separate publication steps.
