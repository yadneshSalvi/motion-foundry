# The workbench Lens

Motion Foundry turns a drawn path into a linkage on the table. The maker draws with a visible nib, brings the ends together, asks for a machine and turns its crank. Bright ink comes from the moving linkage. A dashed line keeps the requested path visible underneath.

## Physical controls

The 30 × 24 cm board sits on a horizontal surface. Mount spacing starts at 16 cm. A physical dial sets allowed error from 1 to 5 mm; the starting value is 3 mm. The movable mount, crank and mug rim each have their own SIK handle and first-use gesture hint. A 4.2 cm visible grip matches its collider, and the movable mount has a 4.5 × 4.5 cm target.

The contextual dock offers at most three targets, including navigation and Undo. **More → Place** is available on the first More page; Tools contains only less frequent actions. Holding a handle closes the menu. A meaningful edit produces an on-object Undo chip. A grab and release without movement does not create another change.

Drawing closes only when a sufficiently complete stroke returns within 1.5 cm of its start. A larger gap remains open. Pending search uses abstract moving rings; it does not display an invented solved linkage. A returned mechanism appears only after the actual result passes independent checks.

## A mug that changes the machine

The Preview mug is a recognizable stand-in, with its bowl, handle and rim contained inside the checked circular volume. Its initial diameter is 9 cm and height 4 cm. Pinching the rim changes the actual input radius. Moving or sizing the mug preserves the drawing, mounts and error limit, invalidates the previous result and requires a new solve.

The same newly drawn curve survives the contact-and-repair workflow. Contact appears on the offending rod. A fresh solve changes the mechanism while preserving the blocked request. The [verification record](verification.md) gives exact native test values.

## Spatial hierarchy

The rods have distinct bright colours, depth separation, clamps and through-axles. Actual crank poses drive the pen and ink; ordered comparisons turn matching portions green. Near views add the largest fitting gap and a few legible rod lengths. Other rods can be inspected from another angle. Far views reduce the display to one status mark. Labels face the wearer in yaw while remaining attached to their objects.

Preview opens on the saved Sunlit Room table pose. Place starts a WorldQuery session, accepts a fresh upward-facing horizontal hit and fixes the owner pose once. Non-editor startup requires placement and hides the mug stand-in. The test instructions distinguish that source path from actual device validation.

## Saving and reproduction

Save opens a signed design on a side tag, leaving the linkage visible. The companion rechecks its signature and geometry and offers exact JSON and a dimensioned SVG. Paired-phone delivery is a future interface direction; the current handoff is the QR/link.

The [native reproduction guide](reproducibility.md) covers the project, scene pose, controls and intentional LEAF setup. [Technical reference](technical-reference.md) records thickness, layers, fitting and sharing. [Scope](../README.md#scope) contains mechanical and Preview limits. Petal remains in the companion, domain and retained source, while the native opening stays focused on Loop.
