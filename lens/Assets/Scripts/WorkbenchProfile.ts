import {Vec2} from "./MotionDomain";
import {LoopCandidate, LoopInput, LoopParameters, evaluateCouplerPoint, knownLoopParameters, makeDefaultLoopInput, resampleClosedStroke, verifyLoopCandidate} from "./LoopDomain";

/** Native fabrication-like display dimensions, in real centimetres. Engines are unchanged. */
export const WORKBENCH_PROFILE = {
  groundCm: 16,
  linkRadiusCm: .45,
  linkDepthCm: .7,
  clearanceCm: .16,
  linkLayers: {ground: .6, crank: 1.8, rocker: 3, coupler: 4.2},
  fitCm: .3,
  samples: 720,
  strokeSamples: 64,
  captureGridCm: .001,
  closeDistanceCm: 1.5,
  bounds: {minX: -7, maxX: 23, minY: -7, maxY: 17},
} as const;

/** A provided low container; the editor owner aligns the declared envelope in Preview. */
export const WORKBENCH_KEEP_OUT = {
  id: "provided-container",
  center: {x: -8.90, y: 0},
  radiusCm: 4.5,
  layerZCm: 2,
  depthCm: 4,
};

export function canonicalWorkbenchStroke(points: readonly Vec2[]): Vec2[] {
  return resampleClosedStroke(points, WORKBENCH_PROFILE.strokeSamples).map(p => ({
    x: Math.round(p.x * 1000) / 1000,
    y: Math.round(p.y * 1000) / 1000,
  }));
}

export function makeWorkbenchReference(): {input: LoopInput; candidate: LoopCandidate} {
  const input = makeDefaultLoopInput();
  input.designId = "tabletop-coupler-workbench";
  input.stroke = canonicalWorkbenchStroke(input.stroke.map(p => ({x: p.x * 2, y: p.y * 2})));
  input.fixedMounts.groundCm = WORKBENCH_PROFILE.groundCm;
  for (const key of ["crank", "coupler", "rocker"] as const) {
    input.lengthBounds[key] = [input.lengthBounds[key][0] * 2, input.lengthBounds[key][1] * 2];
  }
  for (const key of ["alongCm", "acrossCm"] as const) {
    input.attachmentBounds[key] = [input.attachmentBounds[key][0] * 2, input.attachmentBounds[key][1] * 2];
  }
  input.linkRadiusCm = WORKBENCH_PROFILE.linkRadiusCm;
  input.linkDepthCm = WORKBENCH_PROFILE.linkDepthCm;
  input.clearanceCm = WORKBENCH_PROFILE.clearanceCm;
  input.linkLayers = {...WORKBENCH_PROFILE.linkLayers};
  input.tolerances = {fitCm: WORKBENCH_PROFILE.fitCm, closureCm: .002, samples: WORKBENCH_PROFILE.samples};
  const parameters: LoopParameters = {...knownLoopParameters, groundCm: 16, crankCm: 4,
    couplerCm: 14, rockerCm: 10, attachmentAlongCm: 7.6, attachmentAcrossCm: 4.2};
  return {input, candidate: {id: "native-tabletop-reference", family: "four-bar-coupler", label: "Reference mechanism",
    parameters, verification: verifyLoopCandidate(input, parameters), score: 0}};
}

export function makeWorkbenchStudy(): {input: LoopInput; candidate: LoopCandidate} {
  const result = makeWorkbenchReference();
  result.input.designId = "provided-container-study";
  result.input.obstacles = [{...WORKBENCH_KEEP_OUT, center: {...WORKBENCH_KEEP_OUT.center}}];
  result.candidate.verification = verifyLoopCandidate(result.input, result.candidate.parameters);
  return result;
}

export function nearestPhase(angle: number, previous: number): number {
  return previous + Math.atan2(Math.sin(angle - previous), Math.cos(angle - previous));
}

/** Every point is evaluated from actual linkage kinematics, never the requested stroke. */
export function kinematicInkSegment(parameters: LoopParameters, from: number, to: number): Vec2[] {
  const steps = Math.max(1, Math.min(360, Math.ceil(Math.abs(to - from) / (Math.PI / 90))));
  const points: Vec2[] = [];
  for (let i = 0; i <= steps; i++) {
    const pose = evaluateCouplerPoint(parameters, from + (to - from) * i / steps);
    if (pose) points.push(pose.point);
  }
  return points;
}
