# Motion Foundry — design brief

A maker draws the motion they want on a tabletop board. Motion Foundry finds a four-bar linkage and a fixed pen attachment that approximate that path. Turning the crank reveals exactly what the machine draws, including its changing pen speed.

## Why glasses

Sketch at true scale on the bench where you would build, turn the links by hand, and see where they meet your mug—without carrying a second screen. The drawing, machine and obstacle share one coordinate frame. Walking around reveals the rod layers; approaching reveals the lengths and fitting gap.

The native experience concentrates on this single Loop journey. Petal remains available in the companion for angular-motion studies.

## Applying plan-lens

We used the [plan-lens design framework from the Devpost Learn skill pack](https://github.com/challengepost/learn-specs/tree/main/skills/plan-lens) to develop this brief from the chosen concept. Its world-space design habits and Preview limits led to three concrete changes:

| Earlier design | Decision in this Lens |
| --- | --- |
| A floating mechanism with a persistent control rack | Put the board on a table; attach the crank, fit dial and mount control to the parts they change. |
| A technical error report away from the motion | Put the fitting gap at the pen's actual pose, and mark the particular rod meeting the obstacle. |
| A separate prepared obstacle study | Add and size a recognizable mug stand-in around the maker's current drawing; preserve that drawing and all constraints during repair. |

CLAD's interaction, UI, audio and LEAF guidance informed the native implementation. Lens Studio MCP handled scene integration and Preview inspection. Installed package types were checked before using their APIs.

## Four glasses habits

| Habit | Product decision |
| --- | --- |
| Put information on the thing | The fit dial shows its current millimetres; contact belongs to the rod; lengths sit beside the links. |
| Show detail when needed | Far view has one status mark; the working view has a small dock; the near view exposes fit and dimensions. |
| Keep choices few and graspable | At most three dock targets, including navigation. A 1.6 cm visible crank knob with a 4.2 cm invisible interaction target, a 4.5 cm mount target, visible rim handle and first-use hand hints make the object actions discoverable. |
| Stay where the person is looking | The board remains on its surface. Placement controls follow near the user, then return to the bench edge; saved-design tags stay beside the assembly. |

## The complete action

1. Place the board, or use Preview's saved tabletop position. The first-use hand demonstrates the crank.
2. Draw with a pinch on the board. A visible nib follows the input. Returning within 1.5 cm of the starting ring snaps a sufficiently long loop closed; an open stroke remains editable.
3. Turn the fit dial from 1 to 5 mm, and choose **Make it**. The previous machine and a clearly pending pulse remain while the real search runs. New rods appear only after a returned result passes independent checks.
4. Turn or flick the crank. Saturated ink grows from actual linkage poses over the thin dashed drawing. Matching portions accumulate in mint and remain after release; a complete earned traversal makes the match payoff legible.
5. Lean closer to inspect fitting gaps and actual rod lengths. Labels choose clear positions around the hardware.
6. Move and size the mug ring. If a rod meets it, contact is shown on that rod. A fresh search keeps the same drawing, mounts, fit limit and obstacle while finding different geometry.
7. Undo a direct edit, try another checked mechanism, or save the selected one. A failed or cancelled search keeps the previous geometry and prevents a stale export.

Menus are two levels deep at most. **Place** is on the first More page, each secondary page has Back, and a named Undo chip remains by the edited object until Undo or a new accepted solve. Recovery is also available in Tools.

## Geometry and state

The board is 30 × 24 cm. Native defaults are 16 cm mounts, moving links of 4/14/10 cm, a 3 mm fit limit, 0.45 cm rod radius and 0.70 cm depth. Ground, crank, rocker and coupler centres sit at 0.6, 1.8, 3.0 and 4.2 cm. The rendered rod envelopes match these inputs.

The pen is fixed to the coupler by two rods. Its pose always comes from linkage kinematics. The drawing supplies the fitting objective; it never supplies playback coordinates. Ordered cyclic correspondence preserves traversal through a crossing without pretending to reproduce the hand's speed.

A completed nonzero edit creates one history entry. A no-motion grab creates none. Undo restores input, selected mechanism, alternatives and receipt together. Bounded requests use separate solve/share generation guards, so cancelled, timed-out or older responses cannot install a result.

## Done criteria

- Real SIK drawing changes the input and produces a fresh checked mechanism or an honest no-result state.
- Cranking changes only physical phase, with ink from the computed pen.
- The fit dial, movable mount and obstacle rim respond directly and show their actual values.
- Repair preserves the freshly drawn loop and every constraint; the obstacle is not silently moved or replaced.
- The working, side, near and Center views keep controls, ink and useful labels readable.
- Save keeps the design locally; Send to phone creates a signed link that rechecks and preserves the exact drawing, selected mechanism and constraints.

[Verification](verification.md) records the measured outcomes. [Scope](../README.md#scope) defines the Preview, handoff and mechanical limits.
