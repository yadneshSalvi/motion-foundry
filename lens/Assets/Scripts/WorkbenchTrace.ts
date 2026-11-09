import {LoopInput,LoopParameters,parseLoopInput} from './LoopDomain';
import {Vec2} from './MotionDomain';
import {OrderedTraceMatch} from './WorkbenchPresentation';
import {Point3} from './WorkbenchGeometry';

const TAU=2*Math.PI;
const distance=(a:Vec2,b:Vec2)=>Math.hypot(a.x-b.x,a.y-b.y);
const modulo=(n:number,d:number)=>((n%d)+d)%d;
// Exact canonical identity, rather than a collision-prone input hash or candidate id alone.
function canonical(value:unknown):string {
  if(Array.isArray(value))return '['+value.map(canonical).join(',')+']';
  if(value&&typeof value==='object')return '{'+Object.keys(value).sort().map(k=>JSON.stringify(k)+':'+canonical((value as Record<string,unknown>)[k])).join(',')+'}';
  return JSON.stringify(value);
}
export type TraceCell={index:number;path:Vec2[];inspected:boolean;matched:boolean;errorCm:number};
export type TraceTick={index:number;actual:Vec2;desired:Vec2;errorCm:number};
export type TraceState={revision:number;ready:boolean;inspected:number;matched:number;total:number;complete:boolean;cells:TraceCell[];failureTicks:TraceTick[]};
export type TraceAdvance={changed:number[];ink:Vec2[];breakInk:boolean;revision:number};

/**
 * Persistent, sampled evidence of the crank's actual traversal. Supply UNWRAPPED phases,
 * including negative phases on reverse motion. Never infer direction from modulo angles.
 * Each phase cell needs its two endpoints and midpoint actually crossed before it is
 * inspected. Only errors within the unchanged physical limit earn mint. This is display
 * evidence, not a replacement for the independent mechanism/clearance verifier.
 */
export class PersistentOrderedTrace {
  private identity='';
  private map:OrderedTraceMatch|null=null;
  private parameters:LoopParameters|null=null;
  private limit=0;
  private previous:number|null=null;
  private masks:number[]=[];
  private cells:TraceCell[]=[];
  private witnesses:(TraceTick|null)[]=[];
  private version=0;
  constructor(readonly segments=360){
    if(!Number.isInteger(segments)||segments<12||segments>1440)throw Error('Trace segments must be 12–1440');
  }
  /** Call on design/candidate changes, not in the per-frame render loop. Returns reset. */
  configure(input:LoopInput,parameters:LoopParameters,candidateId=''):boolean {
    let identity:string;
    try {identity=canonical({input,parameters,candidateId});}catch {identity='invalid';}
    if(identity===this.identity)return false;
    this.identity=identity;this.map=null;this.parameters=null;this.cells=[];
    try {
      const parsed=parseLoopInput(input),p=JSON.parse(JSON.stringify(parameters)) as LoopParameters;
      if(!Object.values(p).every(Number.isFinite)||(p.branch!==1&&p.branch!==-1)||
        (p.driveDirection!==1&&p.driveDirection!==-1)||!(p.groundCm>0&&p.crankCm>0&&p.couplerCm>0&&p.rockerCm>0))throw Error('Invalid trace parameters');
      const map=new OrderedTraceMatch(parsed,p),arc=[0];
      for(let i=0;i<parsed.stroke.length;i++)arc.push(arc[i]+distance(parsed.stroke[i],parsed.stroke[(i+1)%parsed.stroke.length]));
      const total=arc[arc.length-1];
      this.cells=Array.from({length:this.segments},(_,index)=>{
        const a=map.at(p.startingPhaseRad+p.driveDirection*TAU*index/this.segments)!;
        const b=map.at(p.startingPhaseRad+p.driveDirection*TAU*(index+1)/this.segments)!;
        if(!a||!b||![a.progress,b.progress,a.errorCm,b.errorCm].every(Number.isFinite))throw Error('Invalid ordered map');
        const from=a.progress*total,to=index===this.segments-1?total:b.progress*total;
        const path=[a.desired];
        for(let j=1;j<arc.length-1;j++)if(arc[j]>from+1e-9&&arc[j]<to-1e-9)path.push({...parsed.stroke[j]});
        path.push(b.desired);
        return {index,path,inspected:false,matched:false,errorCm:0};
      });
      this.parameters=p;this.map=map;this.limit=parsed.tolerances.fitCm;
    }catch {this.cells=[];}
    this.restart();return true;
  }
  /** Explicit restart is the only reset for unchanged inputs. No point earns credit here. */
  restart(phaseRad?:number):void {
    this.previous=Number.isFinite(phaseRad)?phaseRad!:null;
    this.masks=this.cells.map(()=>0);this.witnesses=this.cells.map(()=>null);
    for(const cell of this.cells){cell.inspected=false;cell.matched=false;cell.errorCm=0;}
    this.version++;
  }
  advance(phaseRad:number):TraceAdvance {
    const result:TraceAdvance={changed:[],ink:[],breakInk:false,revision:this.version};
    const p=this.parameters,map=this.map;
    if(!p||!map||!Number.isFinite(phaseRad)) {this.previous=null;result.breakInk=true;return result;}
    const previous=this.previous;this.previous=phaseRad;
    if(previous===null){result.breakInk=true;return result;}
    const delta=phaseRad-previous;
    if(Math.abs(delta)<1e-12)return result;
    // A discontinuity/seek cannot be treated as observed motion. Caller can restart explicitly.
    if(Math.abs(delta)>TAU+1e-9){result.breakInk=true;return result;}
    const n=this.segments*2;
    const a=(previous-p.startingPhaseRad)*p.driveDirection*n/TAU;
    const b=(phaseRad-p.startingPhaseRad)*p.driveDirection*n/TAU;
    // Avoid catastrophic loops/lost integer precision from corrupt phase input.
    if(Math.max(Math.abs(a),Math.abs(b))>1e12){result.breakInk=true;return result;}
    const changed:boolean[]=this.cells.map(()=>false);
    const visit=(index:number,bit:number,phase:number)=>{
      const cell=this.cells[index],match=map.at(phase);
      if(!match||!Number.isFinite(match.errorCm))return;
      if(this.masks[index]&bit)return;
      this.masks[index]|=bit;
      if(!this.witnesses[index]||match.errorCm>cell.errorCm){
        cell.errorCm=match.errorCm;
        this.witnesses[index]={index,actual:match.actual,desired:match.desired,errorCm:match.errorCm};
      }
      if(this.masks[index]===7){cell.inspected=true;cell.matched=cell.errorCm<=this.limit;changed[index]=true;}
    };
    const first=Math.ceil(Math.min(a,b)-1e-9),last=Math.floor(Math.max(a,b)+1e-9);
    const checkpoints:number[]=[];for(let k=first;k<=last;k++)checkpoints.push(k);
    if(b<a)checkpoints.reverse();
    const start=map.at(previous);if(start)result.ink.push(start.actual);
    for(const k of checkpoints){
      const phase=p.startingPhaseRad+p.driveDirection*TAU*k/n,slot=modulo(k,n),index=Math.floor(slot/2);
      if(slot%2===0){visit(index,1,phase);visit(modulo(index-1,this.segments),4,phase);}
      else visit(index,2,phase);
      const match=map.at(phase);if(match)result.ink.push(match.actual);
    }
    const end=map.at(phaseRad);if(end)result.ink.push(end.actual);
    for(let i=0;i<changed.length;i++)if(changed[i])result.changed.push(i);
    if(result.changed.length)this.version++;
    result.revision=this.version;return result;
  }
  /** Read after a revision change; paths are the original ordered target, never actual ink. */
  state():TraceState {
    let inspected=0,matched=0;const failureTicks:TraceTick[]=[];
    for(const cell of this.cells){if(cell.inspected)inspected++;if(cell.matched)matched++;
      if(cell.inspected&&!cell.matched&&this.witnesses[cell.index])failureTicks.push(this.witnesses[cell.index]!);}
    return {revision:this.version,ready:!!this.map,inspected,matched,total:this.cells.length,
      complete:this.cells.length>0&&matched===this.cells.length,cells:this.cells,failureTicks};
  }
}

/** Minimal public MeshBuilder subset, injectable for numerical tests without Lens globals. */
export type TraceMeshBuilder={appendVerticesInterleaved(v:number[]):void;appendIndices(i:number[]):void;
  getVerticesCount():number;getIndicesCount():number;eraseVertices(from:number,to:number):void;
  eraseIndices(from:number,to:number):void;updateMesh():void};
/**
 * Append-only tube segments, with a bounded UInt16 vertex budget. Never rebuilds old
 * points on an update; stops adding when full. Keep the same builder/RenderMesh, call
 * reset only on trace restart/input change, breakStroke on a seek/discontinuity.
 * Lens updateMesh may upload the mesh internally; this avoids JS full-path rebuilding.
 */
export class IncrementalTraceTube {
  private previous:Point3|null=null;
  private count=0;
  private readonly seedVertices:number;
  private readonly seedIndices:number;
  constructor(private builder:TraceMeshBuilder,readonly radius=.22,readonly sides=6,readonly maxSegments=4096){
    // A native builder may begin with an invisible seed triangle. Keep that valid
    // backing mesh on reset: Lens rejects zero-length erases and empty uploads.
    this.seedVertices=builder.getVerticesCount();this.seedIndices=builder.getIndicesCount();
    if(!(radius>0)||!Number.isFinite(radius)||!Number.isInteger(sides)||sides<3||
      !Number.isInteger(maxSegments)||maxSegments<1||this.seedVertices+2*sides*maxSegments>65535)throw Error('Invalid bounded trace mesh');
  }
  get segmentCount():number{return this.count;}
  get full():boolean{return this.count>=this.maxSegments;}
  breakStroke():void {this.previous=null;}
  reset():void {
    const indices=this.builder.getIndicesCount(),vertices=this.builder.getVerticesCount();
    const changed=indices>this.seedIndices||vertices>this.seedVertices;
    if(indices>this.seedIndices)this.builder.eraseIndices(this.seedIndices,indices);
    if(vertices>this.seedVertices)this.builder.eraseVertices(this.seedVertices,vertices);
    this.previous=null;this.count=0;
    if(changed&&this.seedIndices>0&&this.seedVertices>0)this.builder.updateMesh();
  }
  append(points:readonly Point3[]):number {
    const vertices:number[]=[],indices:number[]=[];let added=0;
    const offset=this.builder.getVerticesCount();
    for(const point of points){
      if(![point.x,point.y,point.z].every(Number.isFinite)){this.breakStroke();continue;}
      const previous=this.previous;this.previous={...point};
      if(!previous||this.full)continue;
      const dx=point.x-previous.x,dy=point.y-previous.y,dz=point.z-previous.z,length=Math.hypot(dx,dy,dz);
      if(length<1e-8)continue;
      const tx=dx/length,ty=dy/length,tz=dz/length;
      const norm=Math.abs(tz)>.8?Math.hypot(ty,tz):Math.hypot(tx,ty);
      const ux=Math.abs(tz)>.8?0:-ty/norm,uy=Math.abs(tz)>.8?-tz/norm:tx/norm,uz=Math.abs(tz)>.8?ty/norm:0;
      const vx=ty*uz-tz*uy,vy=tz*ux-tx*uz,vz=tx*uy-ty*ux;
      const base=offset+vertices.length/8;
      for(const center of [previous,point])for(let j=0;j<this.sides;j++){
        const angle=TAU*j/this.sides,c=Math.cos(angle),s=Math.sin(angle),nx=ux*c+vx*s,ny=uy*c+vy*s,nz=uz*c+vz*s;
        vertices.push(center.x+this.radius*nx,center.y+this.radius*ny,center.z+this.radius*nz,nx,ny,nz,j/this.sides,0);
      }
      for(let j=0;j<this.sides;j++){const next=(j+1)%this.sides;
        indices.push(base+j,base+next,base+this.sides+j,base+next,base+this.sides+next,base+this.sides+j);}
      this.count++;added++;
    }
    if(added){this.builder.appendVerticesInterleaved(vertices);this.builder.appendIndices(indices);this.builder.updateMesh();}
    return added;
  }
}
