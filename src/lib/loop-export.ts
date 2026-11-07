import { evaluateCouplerPoint, verifyLoopCandidate, type LoopCandidate, type LoopInput } from "@/domain/loop";

export function createLoopPackage(input: LoopInput, candidate: LoopCandidate, provenance: string) {
  const verification = verifyLoopCandidate(input, candidate.parameters);
  if (!verification.valid) throw Error("This mechanism does not pass the current drawing.");
  const p = candidate.parameters;
  return { format: "motion-foundry/loop-design@1.0", units: { length: "centimetres", angle: "radians" }, exportedAt: new Date().toISOString(), provenance,
    coordinateFrame: { origin: [0, 0, 0], x: [1, 0, 0], y: [0, 1, 0], normal: [0, 0, 1], handedness: "right" },
    input, selectedCandidateId: candidate.id, mechanism: p, verification, solverVersion: "coupler-loop-1.0",
    samples: Array.from({ length: 361 }, (_, i) => { const cycle = i / 360, phaseRad = p.startingPhaseRad + p.driveDirection * cycle * 2 * Math.PI; return { cycle, phaseRad, ...evaluateCouplerPoint(p, phaseRad) }; }),
    assumptions: ["Fixed pivots A=(0,0) and D=(groundCm,0). The drawing and dimensions are never rescaled during synthesis.", "The tracing point is rigidly attached to the coupler through rods B→P and C→P. The rendered point halo is an indicator, not verified hardware.", "Drawing order uses closed arc-length correspondence. Playback advances the physical crank uniformly and evaluates linkage geometry; it never interpolates the target stroke.", ...verification.limitations] };
}
const escape = (s: string) => s.replace(/[<>&"']/g, c => ({ "<": "&lt;", ">": "&gt;", "&": "&amp;", '"': "&quot;", "'": "&apos;" }[c]!));
export function createLoopSvg(input: LoopInput, candidate: LoopCandidate): string {
  const report = verifyLoopCandidate(input, candidate.parameters); if (!report.valid) throw Error("This mechanism does not pass the current drawing.");
  const p = candidate.parameters, pose = evaluateCouplerPoint(p, p.startingPhaseRad)!;
  const trace = Array.from({ length: 361 }, (_, i) => evaluateCouplerPoint(p, p.startingPhaseRad + p.driveDirection * i * Math.PI / 180)!.point);
  const bounds = [...trace, ...input.stroke, pose.A, pose.B, pose.C, pose.D, ...input.obstacles.flatMap(o => [{ x: o.center.x - o.radiusCm, y: o.center.y - o.radiusCm }, { x: o.center.x + o.radiusCm, y: o.center.y + o.radiusCm }])];
  const minX = Math.min(...bounds.map(v => v.x)), maxX = Math.max(...bounds.map(v => v.x)), minY = Math.min(...bounds.map(v => v.y)), maxY = Math.max(...bounds.map(v => v.y));
  const scale = Math.min(490 / (maxX - minX), 280 / (maxY - minY)), ox = 55 + (490 - (maxX - minX) * scale) / 2 - minX * scale, oy = 155 + (280 - (maxY - minY) * scale) / 2 + maxY * scale;
  const xy = (v: { x: number; y: number }) => `${ox + v.x * scale},${oy - v.y * scale}`;
  const line = (a: typeof pose.A, b: typeof pose.A, color = "#ad8a4c", width = 5) => `<line x1="${ox + a.x * scale}" y1="${oy - a.y * scale}" x2="${ox + b.x * scale}" y2="${oy - b.y * scale}" stroke="${color}" stroke-width="${width}" stroke-linecap="round"/>`;
  return `<svg xmlns="http://www.w3.org/2000/svg" width="1000" height="740" viewBox="0 0 1000 740"><title>Loop mechanism, revision ${input.revision}</title><rect width="1000" height="740" fill="#f6f5ed"/><style>text{font-family:Arial,sans-serif;fill:#304331}.muted{fill:#68785f}.mono{font-family:monospace}</style>
<text x="55" y="53" font-size="14" letter-spacing="3">MOTION FOUNDRY</text><text x="55" y="98" font-size="32">Loop mechanism</text><text x="55" y="125" font-size="12" class="muted">Revision ${input.revision} · ${escape(candidate.id)} · centimetres / radians</text>
${input.obstacles.map(o => `<circle cx="${ox + o.center.x * scale}" cy="${oy - o.center.y * scale}" r="${o.radiusCm * scale}" fill="#ce795f" fill-opacity=".4" stroke="#b4674e" stroke-width="1.5"><title>${escape(o.id)} · radius ${o.radiusCm} cm · layer ${o.layerZCm === undefined ? "all" : o.layerZCm + " cm"} · depth ${o.depthCm ?? input.linkDepthCm ?? .2} cm</title></circle>`).join("")}
<polyline points="${[...input.stroke, input.stroke[0]].map(xy).join(" ")}" fill="none" stroke="#85a8b7" stroke-width="3" stroke-dasharray="4 4"/><polyline points="${trace.map(xy).join(" ")}" fill="none" stroke="#347b5a" stroke-width="2"/>
${line(pose.A, pose.D, "#aab49e", 2)}${line(pose.A, pose.B)}${line(pose.B, pose.C)}${line(pose.D, pose.C)}${line(pose.B, pose.point, "#83956c", 3)}${line(pose.C, pose.point, "#83956c", 3)}
${([['A', pose.A], ['B', pose.B], ['C', pose.C], ['D', pose.D], ['P', pose.point]] as const).map(([name, q]) => `<circle cx="${ox + q.x * scale}" cy="${oy - q.y * scale}" r="5" fill="#f6f5ed" stroke="#344f36" stroke-width="2"/><text x="${ox + q.x * scale + 9}" y="${oy - q.y * scale - 9}" font-size="12">${name}</text>`).join("")}
<text x="610" y="175" font-size="12" letter-spacing="2">DIMENSIONS</text>
${([['Ground', p.groundCm], ['Crank', p.crankCm], ['Coupler', p.couplerCm], ['Rocker', p.rockerCm], ['Attachment along', p.attachmentAlongCm], ['Attachment across', p.attachmentAcrossCm]] as const).map(([label, value], i) => `<text x="610" y="${210 + i * 32}" font-size="14">${label}</text><text x="940" y="${210 + i * 32}" text-anchor="end" font-size="14" class="mono">${value.toFixed(4)} cm</text>`).join("")}
<text x="55" y="475" font-size="12" class="muted">Blue: drawing. Green: actual trace. Coral: obstacles (${input.obstacles.length}). P: tracing point.</text><line x1="55" y1="500" x2="945" y2="500" stroke="#d6ddcc"/>
<text x="55" y="535" font-size="18">Verification</text><text x="55" y="566" font-size="14">Maximum ordered error ${report.maxFitErrorCm.toFixed(4)} cm / tolerance ${input.tolerances.fitCm.toFixed(4)} cm · ${report.sampleCount} sampled poses</text><text x="55" y="594" font-size="14">Sampled clearance margin ${report.minClearanceCm.toFixed(4)} cm after ${input.clearanceCm.toFixed(4)} cm required clearance</text><text x="55" y="620" font-size="13">Branch ${p.branch} · ${p.driveDirection === 1 ? "counterclockwise" : "clockwise"} crank · closure ${report.maxClosureErrorCm.toExponential(2)} cm</text><text x="55" y="655" font-size="12" class="muted">Fit and clearance are sampled. Inter-layer axles, pen hardware and rigid triangle contacts are excluded.</text><text x="55" y="680" font-size="12" class="muted">Kinematic study only; no load or manufacturing validation. JSON contains exact inputs and complete checks.</text><text x="55" y="705" font-size="12" class="muted">${report.inputHash}</text></svg>`;
}
