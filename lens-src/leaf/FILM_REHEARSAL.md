# Preview rehearsal contract

`motion-workbench-film-rehearsal` is a separate automated rehearsal, not the primary functional test or a human-performed take. It uses the existing `WorkbenchPathInteractor`/LEAF SIK route, the real HTTPS service and the product's independent local verifier. It does not call product action handlers, install state, substitute responses, change the camera or render a replacement product UI.

Root owns source sync, editor registration, camera and capture. The scenario is registered in `LeafIndex.ts`; run it from a **fresh Preview** with its registered defaults. The 16 product files and eight LEAF files are mirrored by the sync script. The captured rehearsal now has an independently accepted 82.1-second continuous source interval, including both complete physical cycles; see the [capture measurements](../../devpost/evidence/native-tabletop-captures.json). That does not claim the final edited film is accepted.

## Meaningful timing

The target is approximately 65–80 seconds from `take-start-reference` to `take-complete`. Reset/navigation to the reference happens before that clock through actual controls. Runtime and backend conditions determine the real length; an out-of-range duration is reported, never corrected with fake waits, time scaling or a shortened cycle.

| Beat | Action and observation |
| --- | --- |
| Lead-in | 3.5 seconds of the moving reference, for orientation. |
| Draw | Select Draw; a scripted 10-second open stroke uses 59 ordered reference points translated +0.06 cm in x. This is not a human freehand drawing claim. |
| Close | Observe the real endpoint gap, select Done, and briefly inspect the explicit closing segment. |
| Make | Select Make it, wait for the actual HTTPS response and a valid same-input local check. Inspect the newly computed moving linkage. |
| Crank and ink | Turn the physical crank by about 2.6 radians over 4 seconds, then observe at least one further full physical 2π cycle. |
| Second case | Visibly select More → Study. **This loads a different provided reference drawing.** It is not an obstacle added to the preceding drawn input. |
| Contact and repair | Inspect the actual crank/container overlap, select Make it again and await a fresh result with every field of that blocked Study input unchanged. |
| Clear cycle | Observe one full actual 2π cycle and a short moving ending. The result's clearance remains sampled, not a continuous fabrication guarantee. |

Full cycles are measured from the product's unwrapped phase and drive direction. Their candidate, input identity, freshness and ongoing playback must remain unchanged. The recorder is not controlled by this scenario, and no source-speed assertion is inferred from merely passing it.

## Parameters and overlays

Registered runner defaults:

```json
{
  "__leaf__log_level": "WARN",
  "__leaf__timeout_secs": "150",
  "__leaf__diagnostic_policy": "fail-fast",
  "__leaf__diagnostic_report_duration_ms": "0",
  "lead_in_ms": "3500",
  "contact_inspect_ms": "3500",
  "ending_motion_ms": "3500"
}
```

Only meaningful observation windows are parameterized: moving lead-in 1–5 seconds, contact inspection 2–5 seconds, moving ending 2–6 seconds. Drawing, deliberate crank motion and complete physical cycles retain their own real timing.

The installed LEAF logger normally creates an in-world strip for INFO-level RUNS/PASSED messages. Its supported WARN level prevents that strip on a fresh Preview. It does not remove a panel from an earlier run, so the rehearsal rejects an active `LeafDebugUICamera` or `LeafDiagnosticReportCamera` instead of hiding it. Failures/warnings remain available; a failed take is not made visually clean by suppressing its outcome.

## Hands and reach disclosure

The existing driver creates `DefaultSikInteractor`, whose input type is `CustomController`. It dispatches through genuine SIK interaction events, but does **not** create a hand mesh. This rehearsal is automated Preview input, not rendered-hand performance, physical tracking, occlusion validation or reach evidence.

The separate `motion-workbench-direct-reach-and-undo` test uses the real LEAF IK path with fail-fast diagnostics and rejects indirect routing. Its shared-hand part uses SIK hand visuals. Those distinct tests must not be conflated with this scripted ray-input rehearsal.

## Edit receipts

Each `[MotionFoundry rehearsal]` JSON line includes run identity, ordered event number, wall epoch milliseconds, run/take elapsed time and runtime clock. It records:

- Actual SIK trigger and drag start/end events, plus separately labeled action intentions and observed outcomes.
- Exact input, selected mechanism and verification reports at reference, closure, both live results and the second-case contact.
- Quarter-turn observations and actual measured full-cycle completion.
- The final tick/contact/clear counters, voice configuration and scheduling-failure flag.

`serverReceiptPresent` records whether the real solve receipt exists; the private raw receipt is not exposed by a new test hook. These are timestamped observation receipts, not invented server messages. Cue counters prove scheduling only. Match the actual captured frames and clocks before editing; the scenario's success does not replace picture, audio or full-file acceptance.

## Scene names confirmed from source

| Name | Confirmed role |
| --- | --- |
| `Motion Foundry workbench` | Product root and public snapshot host relationship. |
| `Tabletop linkage` | Local-centimetre board frame used by `boardPoint`. |
| `Workbench drawing surface` | Real SIK drawing target. |
| `Workbench crank knob` | Real SIK physical phase control. |
| `Workbench action left/middle/right` | Persistent UIKit slots resolved from current available actions. |
| `LeafDebugUICamera` | Installed LEAF Logger's optional in-world strip camera. |
| `LeafDiagnosticReportCamera` | Installed LEAF diagnostic report's optional camera. |
