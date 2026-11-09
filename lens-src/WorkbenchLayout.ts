/** Pure screen-space geometry shared by native placement, annotations and diagnostics. */
export type ScreenPoint={x:number;y:number};
export type ScreenBox={left:number;right:number;top:number;bottom:number};
export type ScreenLine={a:ScreenPoint;b:ScreenPoint;radius?:number};
export type ProjectedSubject={id:string;box?:ScreenBox;line?:ScreenLine;depthNear:number};
/** Native vectors/quaternions expose non-enumerable fields; JSON.stringify alone loses them. */
export function vector3Data(value:{x:number;y:number;z:number}){return{x:value.x,y:value.y,z:value.z};}
export function rotationData(value:{x:number;y:number;z:number;w:number}){return{x:value.x,y:value.y,z:value.z,w:value.w};}

export function boxesOverlap(a:ScreenBox,b:ScreenBox):boolean {
  return a.left<b.right&&a.right>b.left&&a.top<b.bottom&&a.bottom>b.top;
}
export function insideViewport(b:ScreenBox,margin=.025):boolean {
  return [b.left,b.right,b.top,b.bottom].every(Number.isFinite)&&b.left>=margin&&b.right<=1-margin&&b.top>=margin&&b.bottom<=1-margin;
}
export function bounds(points:readonly ScreenPoint[],padding=0):ScreenBox {
  return {left:Math.min(...points.map(p=>p.x))-padding,right:Math.max(...points.map(p=>p.x))+padding,
    top:Math.min(...points.map(p=>p.y))-padding,bottom:Math.max(...points.map(p=>p.y))+padding};
}
export function segmentHitsBox(line:ScreenLine,box:ScreenBox):boolean {
  let lo=0,hi=1;const dx=line.b.x-line.a.x,dy=line.b.y-line.a.y,r=line.radius||0;
  for(const [p,q] of [[-dx,line.a.x-box.left+r],[dx,box.right+r-line.a.x],[-dy,line.a.y-box.top+r],[dy,box.bottom+r-line.a.y]]){
    if(Math.abs(p)<1e-12){if(q<0)return false;continue;}
    const t=q/p;if(p<0)lo=Math.max(lo,t);else hi=Math.min(hi,t);if(lo>hi)return false;
  }
  return true;
}
export function pointSegmentDistance(p:ScreenPoint,line:ScreenLine):number {
  const dx=line.b.x-line.a.x,dy=line.b.y-line.a.y,n=dx*dx+dy*dy;
  const t=n?Math.max(0,Math.min(1,((p.x-line.a.x)*dx+(p.y-line.a.y)*dy)/n)):0;
  return Math.hypot(p.x-line.a.x-t*dx,p.y-line.a.y-t*dy);
}
export function linesCross(a:ScreenLine,b:ScreenLine):boolean {
  const cross=(u:ScreenPoint,v:ScreenPoint,w:ScreenPoint)=>(v.x-u.x)*(w.y-u.y)-(v.y-u.y)*(w.x-u.x);
  const ab1=cross(a.a,a.b,b.a),ab2=cross(a.a,a.b,b.b),ba1=cross(b.a,b.b,a.a),ba2=cross(b.a,b.b,a.b);
  if(ab1*ab2<0&&ba1*ba2<0)return true;
  const tolerance=(a.radius||0)+(b.radius||0)+.001;
  return Math.min(pointSegmentDistance(a.a,b),pointSegmentDistance(a.b,b),pointSegmentDistance(b.a,a),pointSegmentDistance(b.b,a))<tolerance;
}
export function subjectHitsBox(subject:ProjectedSubject,box:ScreenBox):boolean {
  return !!(subject.box&&boxesOverlap(subject.box,box)||subject.line&&segmentHitsBox(subject.line,box));
}
export function pointCovered(p:ScreenPoint,subject:ProjectedSubject):boolean {
  return !!(subject.box&&p.x>=subject.box.left&&p.x<=subject.box.right&&p.y>=subject.box.top&&p.y<=subject.box.bottom||
    subject.line&&pointSegmentDistance(p,subject.line)<=(subject.line.radius||0));
}
/** Diagnostic projected coverage, not a physical collision or pixel-visibility verdict. */
export function projectedOcclusion(samples:readonly (ScreenPoint&{depth:number})[],subjects:readonly ProjectedSubject[]):number {
  if(!samples.length)return 0;
  return samples.filter(p=>subjects.some(s=>s.depthNear<p.depth-.01&&pointCovered(p,s))).length/samples.length;
}
export function labelCandidateAllowed(box:ScreenBox,subjects:readonly ProjectedSubject[],occupied:readonly ScreenBox[],leaders:readonly ScreenLine[]):boolean {
  return insideViewport(box)&&!subjects.some(s=>subjectHitsBox(s,box))&&!occupied.some(p=>boxesOverlap(p,box))&&!leaders.some(l=>segmentHitsBox(l,box));
}
/** Stable camera gate: state/geometry changes may additionally invalidate cached placement. */
export function cameraChanged(a:{position:{x:number;y:number;z:number};rotation:{x:number;y:number;z:number;w:number}}|null,b:{position:{x:number;y:number;z:number};rotation:{x:number;y:number;z:number;w:number}}):boolean {
  if(!a)return true;
  if(Math.hypot(a.position.x-b.position.x,a.position.y-b.position.y,a.position.z-b.position.z)>2)return true;
  const q=a.rotation,r=b.rotation,dot=Math.min(1,Math.abs(q.x*r.x+q.y*r.y+q.z*r.z+q.w*r.w));
  return 2*Math.acos(dot)>2*Math.PI/180;
}
