import {LoopInput,LoopParameters,evaluateCouplerPoint} from "./LoopDomain";
import {Vec2} from "./MotionDomain";

const TAU=Math.PI*2;
const clamp=(value:number,min:number,max:number)=>Math.max(min,Math.min(max,value));
const distance=(a:Vec2,b:Vec2)=>Math.hypot(a.x-b.x,a.y-b.y);

/** Presentation policy only. It never changes a solver constraint or accepts a result. */
export const WORKBENCH_PRESENTATION={
  inkRadiusCm:.22,
  drawingRadiusCm:.08,
  dashCm:.55,
  dashGapCm:.34,
  closeDistanceCm:1.5,
  nearCm:55,
  farCm:120,
  hysteresisCm:10,
  fadeSeconds:.3,
  menuIdleSeconds:6,
  undoSeconds:5,
  autoSpeedRad:.42,
  maxFlickRad:3.6,
  frictionPerSecond:2.8,
} as const;

export type DistanceBand="near"|"middle"|"far";
export function distanceBand(distanceCm:number,previous?:DistanceBand):DistanceBand{
  if(!Number.isFinite(distanceCm))return previous||"middle";
  const {nearCm,farCm,hysteresisCm:h}=WORKBENCH_PRESENTATION;
  if(!previous)return distanceCm<nearCm?"near":distanceCm>farCm?"far":"middle";
  if(previous==="near")return distanceCm>farCm+h?"far":distanceCm>nearCm+h?"middle":"near";
  if(previous==="far")return distanceCm<nearCm-h?"near":distanceCm<farCm-h?"middle":"far";
  return distanceCm<nearCm-h?"near":distanceCm>farCm+h?"far":"middle";
}
export function fadeTowards(value:number,target:number,dt:number):number{
  const step=clamp(dt,0,.1)/WORKBENCH_PRESENTATION.fadeSeconds;
  return value<target?Math.min(target,value+step):Math.max(target,value-step);
}

/** Desktop fallback is intentionally distinct from a device's required placement flow. */
export function placementPolicy(isEditor:boolean,previewAskForSurface=false){
  return{isEditor,beginPlacement:!isEditor||previewAskForSurface,showStandIn:isEditor,
    startupLabel:isEditor?"Preview · simulated room":"",
    branch:isEditor?"preview-saved-spot":"device-surface-placement"};
}

/** Reject tiny scribbles and a premature pass near the start before snapping. */
export function canSnapStroke(points:readonly Vec2[]):boolean{
  if(points.length<12)return false;
  let length=0,excursion=0;
  for(let i=1;i<points.length;i++){
    length+=distance(points[i-1],points[i]);excursion=Math.max(excursion,distance(points[0],points[i]));
  }
  return length>=8&&excursion>=3&&distance(points[0],points[points.length-1])<=WORKBENCH_PRESENTATION.closeDistanceCm;
}

/** Finite, frame-rate-independent excess velocity settles into the ordinary slow crank. */
export function crankReleaseStep(velocity:number,direction:1|-1,dt:number){
  const t=clamp(dt,0,.1),base=WORKBENCH_PRESENTATION.autoSpeedRad*direction;
  const speed=clamp(Number.isFinite(velocity)?velocity:base,-WORKBENCH_PRESENTATION.maxFlickRad,WORKBENCH_PRESENTATION.maxFlickRad);
  const decay=Math.exp(-WORKBENCH_PRESENTATION.frictionPerSecond*t);
  return{velocity:base+(speed-base)*decay,advance:base*t+(speed-base)*(1-decay)/WORKBENCH_PRESENTATION.frictionPerSecond};
}

/** Dashes retain the exact input polyline, including its traversal through crossings. */
export function dashedStroke(points:readonly Vec2[],closed:boolean,dash:number=WORKBENCH_PRESENTATION.dashCm,gap:number=WORKBENCH_PRESENTATION.dashGapCm):Vec2[][]{
  if(points.length<2||!(dash>0&&gap>0))return[];
  const paths:Vec2[][]=[];let cursor=0,current:Vec2[]=[];
  const count=closed?points.length:points.length-1;
  for(let i=0;i<count;i++){
    const a=points[i],b=points[(i+1)%points.length],length=distance(a,b);if(length<1e-10)continue;
    let used=0;
    while(used<length-1e-9){
      const period=dash+gap,offset=((cursor%period)+period)%period,on=offset<dash-1e-9;
      const remaining=(on?dash:period)-offset,step=Math.min(length-used,Math.max(remaining,1e-8));
      const at=(n:number)=>({x:a.x+(b.x-a.x)*n/length,y:a.y+(b.y-a.y)*n/length});
      if(on){if(!current.length)current.push(at(used));current.push(at(used+step));}
      else if(current.length){paths.push(current);current=[];}
      used+=step;cursor+=step;
      if(on&&Math.abs(offset+step-dash)<1e-7&&current.length){paths.push(current);current=[];}
    }
  }
  if(current.length)paths.push(current);return paths;
}

export type OrderedMatch={actual:Vec2;desired:Vec2;errorCm:number;progress:number;phaseRad:number};
/**
 * Map physical crank phase to the SAME ordered arc-length convention as the verifier.
 * No nearest-point fit, reordering, target-driven pose or per-frame search. Actual points
 * always come from evaluateCouplerPoint; this cached map is only a display annotation.
 */
export class OrderedTraceMatch {
  private arc:number[]=[0];
  private targetArc:number[]=[0];
  private points:Vec2[]=[];
  private count:number;
  constructor(private input:LoopInput,private parameters:LoopParameters){
    this.count=input.tolerances.samples;
    for(let i=0;i<this.count;i++){
      const pose=evaluateCouplerPoint(parameters,parameters.startingPhaseRad+parameters.driveDirection*TAU*i/this.count);
      if(!pose)throw Error("Cannot display an unreachable trace");this.points.push(pose.point);
    }
    for(let i=0;i<this.points.length;i++)this.arc.push(this.arc[i]+distance(this.points[i],this.points[(i+1)%this.points.length]));
    for(let i=0;i<input.stroke.length;i++)this.targetArc.push(this.targetArc[i]+distance(input.stroke[i],input.stroke[(i+1)%input.stroke.length]));
  }
  at(phaseRad:number):OrderedMatch|null{
    const pose=evaluateCouplerPoint(this.parameters,phaseRad);if(!pose)return null;
    const turns=(phaseRad-this.parameters.startingPhaseRad)*this.parameters.driveDirection/TAU;
    const cycle=((turns%1)+1)%1,index=cycle*this.count,segment=Math.min(this.count-1,Math.floor(index));
    const along=this.arc[segment]+(this.arc[segment+1]-this.arc[segment])*(index-segment);
    const progress=along/this.arc[this.count],targetLength=progress*this.targetArc[this.input.stroke.length];
    let low=0,high=this.input.stroke.length-1;
    while(low<high){const mid=Math.ceil((low+high)/2);if(this.targetArc[mid]<=targetLength)low=mid;else high=mid-1;}
    const a=this.input.stroke[low],b=this.input.stroke[(low+1)%this.input.stroke.length],span=this.targetArc[low+1]-this.targetArc[low];
    const t=span?(targetLength-this.targetArc[low])/span:0;
    const desired={x:a.x+(b.x-a.x)*t,y:a.y+(b.y-a.y)*t};
    return{actual:pose.point,desired,errorCm:distance(pose.point,desired),progress,phaseRad};
  }
}

/** Add only the manually sized obstacle. The maker's stroke/scale/limit remain byte-for-byte. */
export function withWorkbenchObstacle(input:LoopInput,obstacle:LoopInput["obstacles"][number]):LoopInput{
  const next:LoopInput=JSON.parse(JSON.stringify(input));
  delete next.inputHash;
  next.obstacles=[JSON.parse(JSON.stringify(obstacle)),...next.obstacles.filter(o=>o.id!==obstacle.id)];
  return next;
}
