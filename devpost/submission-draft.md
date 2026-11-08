# Motion Foundry

## Who it is for

Motion Foundry helps kinetic makers explore how a moving sculpture could work. Draw a loop on the workbench, make a linkage, and turn its crank to see the moving pen draw it back.

## Designed for glasses

- **Information on the thing:** a ring locates the largest fitting gap; the rod meeting the declared keep-out lights up at its contact phase.
- **Only when needed:** fit detail appears on approach or inspection, drawing tools replace result tools, and Keep's tag stays beside the machine.
- **A few big targets:** each state has at most three contextual tools. The crank, movable mount and fit dial are physical SIK targets.
- **Where you are looking:** the true-centimetre linkage rests on a table below eye level. Colored rods, separated layers, through-axles and growing ink explain it in place.

## How the Devpost Learn skill pack shaped the plan

The planning guidance helped us narrow the idea to a complete Preview action: express motion, see a mechanism, then inspect and revise it. We kept measurements explicit instead of depending on unimplemented recognition. The [design brief](design-brief.md) records that scope.

Reapplying the guidance exposed the first version's weakness: a capable solver above too many controls in an empty scene. The tabletop revision puts drawing and cranking on the workbench and attaches useful information to the geometry.

## How it works

A bounded numerical search chooses rod lengths and a rigid coupler attachment while preserving the drawing, mounts, fit limit and obstacle. Independent pose math checks every accepted result. The pen moves only from actual linkage kinematics, never an interpolated copy of the drawing.

In a separate study, the original crank meets a provided low container. A fresh solve must fit the same loop with different dimensions that pass the sampled rod-clearance checks. Failure keeps the previous machine.

CLAD guidance and Lens Studio MCP supported the native scene, materials, integration and inspection. Standard SIK drives the physical controls. LEAF scenarios exercise drawing, closure, live HTTPS synthesis, cranking, repair and exact Undo. Keep hands the same reverified design to a signed companion page with JSON and SVG.

## What we learned and what is next

Numerical correctness is not enough: thickness must match the checked envelope, a grip must look graspable, and an error needs a visible location. We learned to distinguish physical overlap from a requested safety gap, and scheduled sound from audible output.

Next comes real-Spectacles testing of placement, reach, legibility and audio, followed by a richer hardware model before fabrication.

## Honest scope

This is Preview in a simulated room with provided measurements and a manually aligned container. [Current tabletop acceptance](native-tabletop.md) remains separate from the earlier release. No physical glasses, recognition, tracking accuracy, comfort or user study is claimed.

Full-turn reachability is analytic; fit and rod clearance are sampled. Decorative hardware, forces, bearings and fabrication are excluded. Petal remains in the companion; native focuses on one drawing-to-machine journey.
