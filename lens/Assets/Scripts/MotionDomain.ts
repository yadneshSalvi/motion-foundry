/** Pure deterministic geometry. Units: centimetres and radians. */
export type Vec2 = { x:number; y:number };
export type MechanismParameters = { groundCm:number; crankCm:number; couplerCm:number; rockerCm:number; branch:1|-1 };
export type Pose = { A:Vec2; B:Vec2; C:Vec2; D:Vec2; outputAngleRad:number };
export type DesignInput = {
 schemaVersion:'1.0'; designId:string; revision:number; searchSeed:number; inputHash?:string;
 targetPoses:{id:string;phaseRad:number;outputAngleRad:number;angleToleranceRad:number}[];
 fixedMounts:{groundCm:number}; lengthBounds:{crank:[number,number];coupler:[number,number];rocker:[number,number]};
 obstacles:{id:string;center:Vec2;radiusCm:number;layerZCm?:number;depthCm?:number}[];
 clearanceCm:number;linkRadiusCm:number;linkDepthCm?:number;linkLayers?:{crank:number;coupler:number;rocker:number;ground:number};
 tolerances:{closureCm:number;samples:number};objectivePriorities:{accuracy:number;compactness:number;clearance:number};
};
export type VerificationReport = {valid:boolean;failures:string[];targetResiduals:{id:string;errorRad:number;toleranceRad:number;passed:boolean}[];maxClosureErrorCm:number;minClearanceCm:number;minTransmissionSin:number;sampleCount:number;scope:'sampled';limitations:string[];inputHash:string;verifierVersion:string};
export type Candidate = {id:string;family:'four-bar';parameters:MechanismParameters;verification:VerificationReport;score:number;label:string};
export type SolveResult = {status:'succeeded'|'infeasible'|'no-result'|'rejected';candidates:Candidate[];inputHash:string;revision:number;reason:string;evaluations:number};
const TAU=Math.PI*2;
export const wrapAngle=(a:number):number=>Math.atan2(Math.sin(a),Math.cos(a));
const dist=(a:Vec2,b:Vec2)=>Math.hypot(a.x-b.x,a.y-b.y);
const positive=(v:unknown)=>typeof v==='number'&&Number.isFinite(v)&&v>0&&v<=10000;
const finite=(v:unknown)=>typeof v==='number'&&Number.isFinite(v)&&Math.abs(v)<=10000;
function keys(o:unknown, allowed:string[]): asserts o is Record<string,unknown> {if(!o||typeof o!=='object'||Array.isArray(o)||Object.keys(o).some(k=>!allowed.includes(k)))throw Error('Invalid object or unknown field');}
/** Canonical sorted serialization and portable FNV-1a, including all constraints, excluding only inputHash. Not a cryptographic signature. */
export function buildInputHash(input:DesignInput):string {
 const canonical=(v:unknown):string=>Array.isArray(v)?'['+v.map(canonical).join(',')+']':v&&typeof v==='object'?'{'+Object.keys(v).filter(k=>k!=='inputHash'&&(v as Record<string,unknown>)[k]!==undefined).sort().map(k=>JSON.stringify(k)+':'+canonical((v as Record<string,unknown>)[k])).join(',')+'}':JSON.stringify(v);
 let h=2166136261;const s=canonical(input);for(let i=0;i<s.length;i++){h^=s.charCodeAt(i);h=Math.imul(h,16777619);}return 'fnv1a-'+(h>>>0).toString(16).padStart(8,'0');
}
export function parseInput(value:unknown):DesignInput {
 keys(value,['schemaVersion','designId','revision','searchSeed','inputHash','targetPoses','fixedMounts','lengthBounds','obstacles','clearanceCm','linkRadiusCm','linkDepthCm','linkLayers','tolerances','objectivePriorities']);const x=value as unknown as DesignInput;
 if(x.schemaVersion!=='1.0'||typeof x.designId!=='string'||!x.designId.length||x.designId.length>100||!Number.isSafeInteger(x.revision)||x.revision<0||x.revision>1e9||!Number.isSafeInteger(x.searchSeed)||x.searchSeed<0||x.searchSeed>0xffffffff)throw Error('Invalid metadata');
 keys(x.fixedMounts,['groundCm']);keys(x.lengthBounds,['crank','coupler','rocker']);keys(x.tolerances,['closureCm','samples']);keys(x.objectivePriorities,['accuracy','compactness','clearance']);
 if(!positive(x.fixedMounts.groundCm)||!positive(x.linkRadiusCm)||!finite(x.clearanceCm)||x.clearanceCm<0||!positive(x.tolerances.closureCm)||x.tolerances.closureCm>.1||!Number.isInteger(x.tolerances.samples)||x.tolerances.samples<90||x.tolerances.samples>1440)throw Error('Invalid dimensions or sampling tolerance');
 for(const b of [x.lengthBounds.crank,x.lengthBounds.coupler,x.lengthBounds.rocker])if(!Array.isArray(b)||b.length!==2||!positive(b[0])||!positive(b[1])||b[0]>b[1])throw Error('Invalid length bounds');
 if([x.objectivePriorities.accuracy,x.objectivePriorities.compactness,x.objectivePriorities.clearance].some(v=>!finite(v)||v<0)||Object.values(x.objectivePriorities).reduce((a,b)=>a+b,0)<=0)throw Error('Invalid priorities');
 if(x.linkDepthCm!==undefined&&!positive(x.linkDepthCm))throw Error('Invalid link depth');
 if(x.linkLayers){keys(x.linkLayers,['crank','coupler','rocker','ground']);if(['crank','coupler','rocker','ground'].some(k=>!finite(x.linkLayers![k as keyof typeof x.linkLayers])))throw Error('Invalid layers');}
 if(!Array.isArray(x.targetPoses)||x.targetPoses.length<2||x.targetPoses.length>16||!Array.isArray(x.obstacles)||x.obstacles.length>24)throw Error('Invalid constraint counts');
 const ids=new Set<string>();for(const t of x.targetPoses){keys(t,['id','phaseRad','outputAngleRad','angleToleranceRad']);if(typeof t.id!=='string'||!t.id.length||t.id.length>100||ids.has(t.id)||!finite(t.phaseRad)||!finite(t.outputAngleRad)||!positive(t.angleToleranceRad)||t.angleToleranceRad>Math.PI)throw Error('Invalid target');ids.add(t.id);}
 ids.clear();for(const o of x.obstacles){keys(o,['id','center','radiusCm','layerZCm','depthCm']);keys(o.center,['x','y']);if(typeof o.id!=='string'||!o.id.length||o.id.length>100||ids.has(o.id)||!finite(o.center.x)||!finite(o.center.y)||!positive(o.radiusCm)||(o.layerZCm!==undefined&&!finite(o.layerZCm))||(o.depthCm!==undefined&&!positive(o.depthCm)))throw Error('Invalid obstacle');ids.add(o.id);}
 if(x.inputHash!==undefined&&x.inputHash!==buildInputHash(x))throw Error('Input hash mismatch');
 return JSON.parse(JSON.stringify(x)) as DesignInput;
}
export function evaluateMechanism(p:MechanismParameters,phaseRad:number):Pose|null {
 if(![p.groundCm,p.crankCm,p.couplerCm,p.rockerCm].every(positive)||!Number.isFinite(phaseRad)||(p.branch!==1&&p.branch!==-1))return null;
 const A={x:0,y:0},D={x:p.groundCm,y:0},B={x:p.crankCm*Math.cos(phaseRad),y:p.crankCm*Math.sin(phaseRad)};
 const dx=D.x-B.x,dy=-B.y,d=Math.hypot(dx,dy);if(d<1e-10||d>p.couplerCm+p.rockerCm||d<Math.abs(p.couplerCm-p.rockerCm))return null;
 const a=(p.couplerCm**2-p.rockerCm**2+d*d)/(2*d),h2=p.couplerCm**2-a*a;if(h2<=1e-14)return null;
 const h=Math.sqrt(h2)*p.branch,C={x:B.x+a*dx/d-h*dy/d,y:B.y+a*dy/d+h*dx/d};return {A,B,C,D,outputAngleRad:Math.atan2(C.y,C.x-D.x)};
}
/** Independent law-of-cosines path, distinct from circle intersection playback. */
function verifyPose(p:MechanismParameters,t:number):Pose|null {
 const A={x:0,y:0},D={x:p.groundCm,y:0},B={x:p.crankCm*Math.cos(t),y:p.crankCm*Math.sin(t)},d=dist(B,D);
 const q=(d*d+p.rockerCm*p.rockerCm-p.couplerCm*p.couplerCm)/(2*d*p.rockerCm);if(!Number.isFinite(q)||Math.abs(q)>=1)return null;
 const phi=Math.atan2(B.y,B.x-D.x)-p.branch*Math.acos(q),C={x:D.x+p.rockerCm*Math.cos(phi),y:p.rockerCm*Math.sin(phi)};return {A,B,C,D,outputAngleRad:phi};
}
function pointSegment(p:Vec2,a:Vec2,b:Vec2):number {const dx=b.x-a.x,dy=b.y-a.y,d=dx*dx+dy*dy,t=d?Math.max(0,Math.min(1,((p.x-a.x)*dx+(p.y-a.y)*dy)/d)):0;return Math.hypot(p.x-a.x-t*dx,p.y-a.y-t*dy);}
function segmentDistance(a:Vec2,b:Vec2,c:Vec2,d:Vec2):number {const cross=(p:Vec2,q:Vec2,r:Vec2)=>(q.x-p.x)*(r.y-p.y)-(q.y-p.y)*(r.x-p.x);if(cross(a,b,c)*cross(a,b,d)<0&&cross(c,d,a)*cross(c,d,b)<0)return 0;return Math.min(pointSegment(a,c,d),pointSegment(b,c,d),pointSegment(c,a,b),pointSegment(d,a,b));}
export function verifyCandidate(raw:DesignInput,p:MechanismParameters):VerificationReport {
 const x=parseInput(raw),failures:string[]=[],targetResiduals:VerificationReport['targetResiduals']=[];let maxClosureErrorCm=0,minClearanceCm=Infinity,minTransmissionSin=1;
 const fail=(s:string)=>{if(!failures.includes(s))failures.push(s);};
 if(p.groundCm!==x.fixedMounts.groundCm||![p.groundCm,p.crankCm,p.couplerCm,p.rockerCm].every(positive)||(p.branch!==1&&p.branch!==-1)||Object.keys(p).some(k=>!['groundCm','crankCm','couplerCm','rockerCm','branch'].includes(k)))return {valid:false,failures:['Invalid parameters or mounts'],targetResiduals:[],maxClosureErrorCm:10000,minClearanceCm:-10000,minTransmissionSin:0,sampleCount:0,scope:'sampled',limitations:['Invalid geometry was not sampled.'],inputHash:buildInputHash(x),verifierVersion:'four-bar-1.0'};
 if(p.crankCm>=p.groundCm)fail('Input crank must be shorter than ground for the supported crank-rocker family');
 for(const k of ['crank','coupler','rocker'] as const){const v=p[`${k}Cm`];if(v<x.lengthBounds[k][0]||v>x.lengthBounds[k][1])fail('Length bounds violated');}
 // Strict reachability for every input phase, analytic extrema of |D-B|.
 if(Math.abs(p.groundCm-p.crankCm)<=Math.abs(p.couplerCm-p.rockerCm)+1e-7||p.groundCm+p.crankCm>=p.couplerCm+p.rockerCm-1e-7)fail('Full rotation reaches a singularity or unreachable phase');
 const layers=x.linkLayers??{crank:0,coupler:.4,rocker:0,ground:-.4},depth=x.linkDepthCm??.2;
 const phases=Array.from({length:x.tolerances.samples},(_,i)=>TAU*i/x.tolerances.samples).concat(x.targetPoses.map(t=>t.phaseRad));
 for(const phase of phases){const pose=verifyPose(p,phase);if(!pose){fail('Unreachable or singular sampled pose');continue;}const {A,B,C,D}=pose;
 const closure=Math.max(Math.abs(dist(A,B)-p.crankCm),Math.abs(dist(B,C)-p.couplerCm),Math.abs(dist(C,D)-p.rockerCm));maxClosureErrorCm=Math.max(maxClosureErrorCm,closure);
 const sin=Math.abs(((C.x-B.x)*(C.y-D.y)-(C.y-B.y)*(C.x-D.x))/(p.couplerCm*p.rockerCm));minTransmissionSin=Math.min(minTransmissionSin,sin);if(sin<1e-4)fail('Near singular transmission');
 const links=[{a:A,b:B,z:layers.crank},{a:B,b:C,z:layers.coupler},{a:D,b:C,z:layers.rocker},{a:A,b:D,z:layers.ground}];
 for(const l of links)for(const o of x.obstacles){if(o.layerZCm!==undefined&&Math.abs(o.layerZCm-l.z)>=(depth+(o.depthCm??depth))/2+x.clearanceCm)continue;const margin=pointSegment(o.center,l.a,l.b)-o.radiusCm-x.linkRadiusCm-x.clearanceCm;minClearanceCm=Math.min(minClearanceCm,margin);if(margin<0)fail('Obstacle capsule collision');}
 // Adjacent pairs are checked outside a declared pivot neighborhood (3 radii + clearance).
 const trim=x.linkRadiusCm*3+x.clearanceCm;
 for(const [i,j,joint] of [[0,1,B],[1,2,C],[0,3,A],[2,3,D]] as const){const a=links[i]!,b=links[j]!;if(Math.abs(a.z-b.z)>=depth+x.clearanceCm)continue;const away=(l:typeof a)=>{const end=dist(l.a,joint)<1e-8?l.b:l.a,length=dist(joint,end);if(length<=trim)return null;return {a:{x:joint.x+(end.x-joint.x)*trim/length,y:joint.y+(end.y-joint.y)*trim/length},b:end};};const aa=away(a),bb=away(b);if(aa&&bb){const margin=segmentDistance(aa.a,aa.b,bb.a,bb.b)-2*x.linkRadiusCm-x.clearanceCm;minClearanceCm=Math.min(minClearanceCm,margin);if(margin<0)fail('Adjacent links overlap outside exempt pivot neighborhood');}}
 // Only nonadjacent pairs; adjacent pivot contacts are explicitly exempt.
 for(const [i,j] of [[0,2],[1,3]] as const){const a=links[i]!,b=links[j]!;if(Math.abs(a.z-b.z)>=depth+x.clearanceCm)continue;const margin=segmentDistance(a.a,a.b,b.a,b.b)-2*x.linkRadiusCm-x.clearanceCm;minClearanceCm=Math.min(minClearanceCm,margin);if(margin<0)fail('Nonadjacent link capsule collision');}
 }
 for(const t of x.targetPoses){const pose=verifyPose(p,t.phaseRad),errorRad=pose?Math.abs(wrapAngle(pose.outputAngleRad-t.outputAngleRad)):Math.PI;const passed=!!pose&&errorRad<=t.angleToleranceRad;targetResiduals.push({id:t.id,errorRad,toleranceRad:t.angleToleranceRad,passed});if(!passed)fail('Target tolerance exceeded');}
 if(maxClosureErrorCm>x.tolerances.closureCm)fail('Closure tolerance exceeded');
 return {valid:failures.length===0,failures,targetResiduals,maxClosureErrorCm,minClearanceCm:Number.isFinite(minClearanceCm)?minClearanceCm:10000,minTransmissionSin,sampleCount:phases.length,scope:'sampled',limitations:['Clearance checked only at reported phase samples; collisions between samples are not excluded.','Adjacent pivot neighborhoods (3 link radii plus clearance) are exempt. Capsule endpoints model joint radii; inter-layer axles are not modeled.','No load, bearing, fabrication or physical manufacturability validation.'],inputHash:buildInputHash(x),verifierVersion:'four-bar-1.0'};
}
function analyticSeed(x:DesignInput):number[]|null {
 const m=Array.from({length:3},()=>[0,0,0,0]);for(const t of x.targetPoses){const v=[Math.cos(t.outputAngleRad),-Math.cos(t.phaseRad),1],y=Math.cos(t.phaseRad-t.outputAngleRad);for(let i=0;i<3;i++){for(let j=0;j<3;j++)m[i]![j]!+=v[i]!*v[j]!;m[i]![3]!+=v[i]!*y;}}
 for(let i=0;i<3;i++){let pivot=i;for(let j=i+1;j<3;j++)if(Math.abs(m[j]![i]!)>Math.abs(m[pivot]![i]!))pivot=j;[m[i],m[pivot]]=[m[pivot]!,m[i]!];const d=m[i]![i]!;if(Math.abs(d)<1e-9)return null;for(let k=i;k<4;k++)m[i]![k]!/=d;for(let j=0;j<3;j++)if(j!==i){const f=m[j]![i]!;for(let k=i;k<4;k++)m[j]![k]!-=f*m[i]![k]!;}}
 const a=x.fixedMounts.groundCm/m[0]![3]!,r=x.fixedMounts.groundCm/m[1]![3]!,c2=x.fixedMounts.groundCm**2+a*a+r*r-2*a*r*m[2]![3]!;return c2>0?[a,Math.sqrt(c2),r]:null;
}
export function solveDesign(raw:DesignInput):SolveResult {
 let x:DesignInput;try{x=parseInput(raw);}catch(e){return {status:'rejected',candidates:[],inputHash:'',revision:0,reason:e instanceof Error?e.message:'Invalid input',evaluations:0};}
 const hash=buildInputHash(x),base={inputHash:hash,revision:x.revision};const bounds=[x.lengthBounds.crank,x.lengthBounds.coupler,x.lengthBounds.rocker];
 if(x.fixedMounts.groundCm+x.lengthBounds.crank[0]>=x.lengthBounds.coupler[1]+x.lengthBounds.rocker[1])return {...base,status:'infeasible',candidates:[],reason:'Even the shortest crank cannot rotate fully with the maximum coupler and rocker lengths.',evaluations:0};
 for(let i=0;i<x.targetPoses.length;i++)for(let j=i+1;j<x.targetPoses.length;j++){const a=x.targetPoses[i]!,b=x.targetPoses[j]!;if(Math.abs(wrapAngle(a.phaseRad-b.phaseRad))<1e-10&&Math.abs(wrapAngle(a.outputAngleRad-b.outputAngleRad))>a.angleToleranceRad+b.angleToleranceRad)return {...base,status:'infeasible',candidates:[],reason:'Targets at the same phase have disjoint angular tolerances.',evaluations:0};}
 let state=x.searchSeed>>>0;const rand=()=>{state=(Math.imul(state,1664525)+1013904223)>>>0;return state/4294967296;};let evaluations=0;
 const clamp=(v:number,i:number)=>Math.max(bounds[i]![0],Math.min(bounds[i]![1],v));
 const parameters=(v:number[],branch:1|-1):MechanismParameters=>({groundCm:x.fixedMounts.groundCm,crankCm:v[0]!,couplerCm:v[1]!,rockerCm:v[2]!,branch});
 const loss=(v:number[],branch:1|-1)=>{evaluations++;const p=parameters(v,branch);if(p.crankCm>=p.groundCm||Math.abs(p.groundCm-p.crankCm)<=Math.abs(p.couplerCm-p.rockerCm)+1e-5||p.groundCm+p.crankCm>=p.couplerCm+p.rockerCm-1e-5)return 1e8;let sum=0;for(const t of x.targetPoses){const pose=evaluateMechanism(p,t.phaseRad);if(!pose)return 1e8;sum+=Math.max(0,Math.abs(wrapAngle(pose.outputAngleRad-t.outputAngleRad)/t.angleToleranceRad)-.5)**2;}return sum/x.targetPoses.length;};
 const seeds:number[][]=[],a=analyticSeed(x);if(a&&a.every((v,i)=>v>=bounds[i]![0]&&v<=bounds[i]![1]))seeds.push(a);
 for(let i=0;i<150;i++)seeds.push(bounds.map(b=>b[0]+rand()*(b[1]-b[0])));
 const fitted:{v:number[];branch:1|-1;loss:number}[]=[];
 for(const seed of seeds)for(const branch of [1,-1] as const){let v=[...seed],best=loss(v,branch),steps=bounds.map(b=>(b[1]-b[0])*.12);for(let iteration=0;iteration<70;iteration++){let improved=false;for(let i=0;i<3;i++)for(const direction of [-1,1]){const next=[...v];next[i]=clamp(next[i]!+direction*steps[i]!,i);const e=loss(next,branch);if(e<best){v=next;best=e;improved=true;}}if(!improved)steps=steps.map(s=>s*.65);if(Math.max(...steps)<1e-6)break;}if(best<=1)fitted.push({v,branch,loss:best});}
 fitted.sort((a,b)=>a.loss-b.loss);const candidates:Candidate[]=[];
 for(const fit of fitted){if(candidates.some(c=>c.parameters.branch===fit.branch&&Math.hypot((c.parameters.crankCm-fit.v[0]!)/x.fixedMounts.groundCm,(c.parameters.couplerCm-fit.v[1]!)/x.fixedMounts.groundCm,(c.parameters.rockerCm-fit.v[2]!)/x.fixedMounts.groundCm)<.025))continue;const p=parameters(fit.v,fit.branch),verification=verifyCandidate(x,p);if(!verification.valid)continue;const size=(p.crankCm+p.couplerCm+p.rockerCm)/p.groundCm,accuracy=verification.targetResiduals.reduce((sum,t)=>sum+(t.errorRad/t.toleranceRad)**2,0)/verification.targetResiduals.length,score=x.objectivePriorities.accuracy*accuracy+x.objectivePriorities.compactness*size+x.objectivePriorities.clearance/(1+Math.max(0,verification.minClearanceCm));candidates.push({id:`${hash}-${candidates.length+1}`,family:'four-bar',parameters:p,verification,score,label:`Verified assembly ${candidates.length+1}`});if(candidates.length===3)break;}
 candidates.sort((a,b)=>a.score-b.score);return {...base,status:candidates.length?'succeeded':'no-result',candidates,reason:candidates.length?'Candidates pass individual targets and sampled geometric verification.':'No verified mechanism found within the fixed seeded search budget. This is not proof of infeasibility.',evaluations};
}
export const knownExampleParameters:MechanismParameters={groundCm:8,crankCm:2,couplerCm:7,rockerCm:5,branch:1};
export function makeDefaultInput():DesignInput {
 const p=knownExampleParameters;return {schemaVersion:'1.0',designId:'motion-foundry-example',revision:0,searchSeed:42,targetPoses:[0,.9,2.1,3.4,4.8].map((phaseRad,i)=>({id:`pose-${i+1}`,phaseRad,outputAngleRad:evaluateMechanism(p,phaseRad)!.outputAngleRad,angleToleranceRad:Math.PI/90})),fixedMounts:{groundCm:8},lengthBounds:{crank:[1,3.5],coupler:[5,9],rocker:[3,7]},obstacles:[],clearanceCm:.08,linkRadiusCm:.08,linkDepthCm:.2,linkLayers:{crank:0,coupler:.4,rocker:0,ground:-.4},tolerances:{closureCm:.001,samples:360},objectivePriorities:{accuracy:1,compactness:.1,clearance:.05}};
}
export const defaultInput=makeDefaultInput();
/** Same editable targets before/after relocating an obstacle. Angular tolerance 0.12 rad is explicit. */
export function makeObstacleInput(relocated=true):DesignInput {const x=makeDefaultInput();x.designId='obstacle-relocation';x.revision=relocated?1:0;x.targetPoses.forEach(t=>{t.angleToleranceRad=.12;});x.obstacles=[{id:'editable-obstacle',center:relocated?{x:1.9,y:0}:{x:-3,y:-3},radiusCm:.12,layerZCm:0,depthCm:.2}];return x;}
export function makeContradictoryInput():DesignInput {const x=makeDefaultInput();x.designId='contradictory-targets';x.targetPoses.push({...x.targetPoses[0]!,id:'conflicting-pose',outputAngleRad:x.targetPoses[0]!.outputAngleRad+1});return x;}
