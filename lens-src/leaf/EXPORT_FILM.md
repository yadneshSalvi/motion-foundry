# Exact-design export capture

`motion-workbench-export-film` is a Preview-only test registered by `FilmCaptureIndex.ts`, imported by the existing `LeafIndex`. It does not need another scene component. It is isolated from the primary journey/reach tests and from product handlers.

Start a fresh Preview at revision 0. The test uses actual Reference, board Draw, explicit Done and Study controls to reach revision 3. It compares every input field with the accepted provided-container Study and requires input hash `fnv1a-3049b059`. It then requests a fresh HTTPS solve and asserts every accepted main-take mechanism parameter, the 0.24235331508098867 cm maximum error and +0.023257869229840494 cm sampled margin. Expected values are read-only test assertions; no cached candidate or state is installed.

After those checks, the test emits `export-ready`, observes three seconds of genuine ongoing motion, triggers **Keep** through SIK, waits for the actual share response and checks that its QR is visible. It holds that unchanged design and URL for eight more seconds while the mechanism continues moving. A failed exact match, timed-out request, missing QR, stale state or stopped playback fails the run.

The `[MotionFoundry export film]` event records contain wall-clock milliseconds, runtime seconds, actual SIK trigger callbacks, the exact public share URL and a curated input/parameter/verification snapshot. They expose only the presence of a private solve receipt, not its raw value or server credentials. Audio counts prove scheduling only.

The registered runner uses WARN logging, a 100-second deadline and fail-fast diagnostics. An old active test overlay causes a failure instead of being hidden. Root owns source sync, Preview, camera and recording. An actual source decode and companion JSON comparison must establish that the captured tag resolves to the same input and mechanism; authoring this scenario is not that acceptance.
