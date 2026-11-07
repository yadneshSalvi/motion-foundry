import { evaluateMechanism, verifyCandidate, type Candidate, type DesignInput } from "@/domain";

export function createDesignPackage(input: DesignInput, candidate: Candidate, provenance: string) {
  const verification = verifyCandidate(input, candidate.parameters);
  if (!verification.valid) throw new Error("This candidate does not pass the current revision.");
  return {
    format: "motion-foundry/design@1.0", units: { length: "centimetres", angle: "radians" }, exportedAt: new Date().toISOString(), provenance,
    coordinateFrame: { origin: [0, 0, 0], x: [1, 0, 0], y: [0, 1, 0], normal: [0, 0, 1], handedness: "right" },
    input, selectedCandidateId: candidate.id, mechanism: candidate.parameters, verification, solverVersion: "four-bar-1.0",
    samples: Array.from({ length: 361 }, (_, index) => { const phaseRad = index * Math.PI / 180; return { phaseRad, ...evaluateMechanism(candidate.parameters, phaseRad) }; }),
    assumptions: ["One planar four-bar mechanism with a rigid decorative petal attached to its output rocker.", "Fixed pivots are A=(0,0) and D=(groundCm,0). Input phase is never optimized or shifted.", "The ornamental petal and display base are excluded from the link capsule collision model.", ...verification.limitations],
  };
}
const escapeXml = (value: string) => value.replace(/[<>&\"']/g, char => ({ "<": "&lt;", ">": "&gt;", "&": "&amp;", '"': "&quot;", "'": "&apos;" }[char]!));

export function createAssemblySvg(input: DesignInput, candidate: Candidate): string {
  const report = verifyCandidate(input, candidate.parameters);
  if (!report.valid) throw new Error("This candidate does not pass the current revision.");
  const p=candidate.parameters,pose=evaluateMechanism(p,Math.PI/3)!;
  const points=Array.from({length:181},(_,i)=>evaluateMechanism(p,i*Math.PI/90)!.C);
  const minX=Math.min(-p.crankCm,...points.map(q=>q.x)),maxX=Math.max(p.groundCm,p.crankCm,...points.map(q=>q.x));
  const minY=Math.min(-p.crankCm,...points.map(q=>q.y)),maxY=Math.max(p.crankCm,...points.map(q=>q.y));
  const scale=Math.min(470/(maxX-minX),180/(maxY-minY)),ox=65+(470-(maxX-minX)*scale)/2-minX*scale,oy=165+(180-(maxY-minY)*scale)/2+maxY*scale;
  const point = (v: { x: number; y: number }) => `${ox + v.x * scale},${oy - v.y * scale}`;
  const links = [[pose.A, pose.B, p.crankCm, "Input crank"], [pose.B, pose.C, p.couplerCm, "Coupler"], [pose.D, pose.C, p.rockerCm, "Output rocker"]] as const;
  return `<svg xmlns="http://www.w3.org/2000/svg" width="1000" height="680" viewBox="0 0 1000 680">
<rect width="1000" height="680" fill="#f6f3ec"/><style>text{font-family:Arial,sans-serif;fill:#252a27}.mono{font-family:monospace}.muted{fill:#71776f}</style>
<text x="55" y="58" font-size="16" letter-spacing="4">MOTION FOUNDRY</text><text x="55" y="102" font-size="32">Petal study · assembly record</text>
<text x="55" y="130" font-size="13" class="muted">Revision ${input.revision} · ${escapeXml(candidate.id)} · Units: centimetres / radians</text>
<line x1="${ox - 30}" y1="${oy + 13}" x2="${ox + p.groundCm * scale + 30}" y2="${oy + 13}" stroke="#acb3a8" stroke-width="3"/>
${links.map(([a,b]) => `<line x1="${ox+a.x*scale}" y1="${oy-a.y*scale}" x2="${ox+b.x*scale}" y2="${oy-b.y*scale}" stroke="#b99c60" stroke-width="10" stroke-linecap="round"/>`).join("")}
${(["A", "B", "C", "D"] as const).map(key => { const q=pose[key]; return `<circle cx="${ox+q.x*scale}" cy="${oy-q.y*scale}" r="7" fill="#f6f3ec" stroke="#303c34" stroke-width="2"/><text x="${ox+q.x*scale+12}" y="${oy-q.y*scale-10}" font-size="14">${key}</text>`; }).join("")}
<polyline points="${Array.from({length:181},(_,i)=>point(evaluateMechanism(p,i*Math.PI/90)!.C)).join(" ")}" fill="none" stroke="#4f9276" stroke-width="1.5"/>
<text x="55" y="365" font-size="13" class="muted">Shown at 60° input phase. Green curve: output joint trajectory.</text>
<text x="625" y="192" font-size="12" letter-spacing="2">LINK DIMENSIONS</text>
${[...links.map(([, , length, label]) => [label,length]), ["Ground / mount spacing",p.groundCm]].map(([label,length],i)=>`<text x="625" y="${230+i*35}" font-size="14">${label}</text><text x="920" y="${230+i*35}" text-anchor="end" font-size="14" class="mono">${Number(length).toFixed(4)} cm</text>`).join("")}
<line x1="55" y1="405" x2="945" y2="405" stroke="#d5d9cf"/><text x="55" y="442" font-size="18">Verification record</text>
<text x="55" y="475" font-size="14">${report.valid ? "Passed" : "Failed"} · ${report.sampleCount} sampled poses · branch ${p.branch} · closure ${report.maxClosureErrorCm.toExponential(2)} cm</text>
<text x="55" y="503" font-size="14">Largest angular error ${(Math.max(...report.targetResiduals.map(t=>t.errorRad))*180/Math.PI).toFixed(4)}° · input ${report.inputHash}</text>
<text x="55" y="555" font-size="13" class="muted">Clearance is sampled; collisions between samples are not excluded. Adjacent joint contacts are exempt.</text>
<text x="55" y="580" font-size="13" class="muted">Ornamental geometry is excluded. This is a kinematic study, not fabrication or load certification.</text>
<text x="55" y="635" font-size="12" class="muted">The companion JSON contains complete inputs, seed, dimensions and recomputed verification.</text></svg>`;
}
