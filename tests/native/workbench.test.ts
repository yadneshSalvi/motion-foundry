import {describe,it,expect} from 'vitest';
import {capsuleMesh,intersectBoardRay,fitFromDialAngle,dialAngleFromFit} from '../../lens-src/WorkbenchGeometry';
import {WORKBENCH_PROFILE,makeWorkbenchReference,makeWorkbenchStudy,canonicalWorkbenchStroke,nearestPhase,kinematicInkSegment} from '../../lens-src/WorkbenchProfile';
import {solveLoop,verifyLoopCandidate,evaluateCouplerPoint,buildLoopInputHash} from '../../src/domain/loop';

const close=(a:number,b:number)=>expect(a).toBeCloseTo(b,10);

describe('native physical envelope',()=>{
  it('renders the declared capsule width and depth, including rounded endpoints',()=>{
    const length=8.3,r=.45,d=.7,mesh=capsuleMesh(length,r,d),positions=[];
    for(let i=0;i<mesh.vertices.length;i+=8){
      const [x,y,z,nx,ny,nz]=mesh.vertices.slice(i,i+6);positions.push({x,y,z});
      const centerX=Math.max(-length/2,Math.min(length/2,x));
      expect(Math.hypot(x-centerX,y)).toBeLessThanOrEqual(r+1e-12);
      expect(Math.abs(z)).toBeLessThanOrEqual(d/2+1e-12);
      close(Math.hypot(nx,ny,nz),1);
    }
    close(Math.max(...positions.map(p=>p.x)),length/2+r);
    close(Math.min(...positions.map(p=>p.x)),-length/2-r);
    close(Math.max(...positions.map(p=>p.y))-Math.min(...positions.map(p=>p.y)),2*r);
    close(Math.max(...positions.map(p=>p.z))-Math.min(...positions.map(p=>p.z)),d);
    expect(mesh.indices.every(i=>Number.isInteger(i)&&i>=0&&i<positions.length)).toBe(true);
  });
  it('uses outward triangles on all nondegenerate surfaces',()=>{
    const mesh=capsuleMesh(4,.45,.7);
    for(let i=0;i<mesh.indices.length;i+=3){
      const points=mesh.indices.slice(i,i+3).map(k=>mesh.vertices.slice(k*8,k*8+6));
      const [a,b,c]=points,u=b.slice(0,3).map((v,k)=>v-a[k]),v=c.slice(0,3).map((n,k)=>n-a[k]);
      const cross=[u[1]*v[2]-u[2]*v[1],u[2]*v[0]-u[0]*v[2],u[0]*v[1]-u[1]*v[0]];
      expect(cross.reduce((sum,n,k)=>sum+n*a[k+3],0)).toBeGreaterThanOrEqual(-1e-12);
    }
  });
  it('rejects invalid physical geometry instead of silently enlarging thin links',()=>{
    for(const args of [[-1,.45,.7],[4,0,.7],[4,.45,0],[NaN,.45,.7]])expect(()=>capsuleMesh(...args as [number,number,number])).toThrow();
  });
});

describe('board-space physical interaction',()=>{
  it('intersects the ray with the declared height and rejects parallel or backward rays',()=>{
    expect(intersectBoardRay({x:5,y:8,z:80},{x:.2,y:-.1,z:-1},0)).toEqual({x:21,y:0,z:0});
    expect(intersectBoardRay({x:0,y:0,z:80},{x:0,y:0,z:1},0)).toBeNull();
    expect(intersectBoardRay({x:0,y:0,z:1},{x:1,y:0,z:0},0)).toBeNull();
    expect(intersectBoardRay({x:0,y:0,z:NaN},{x:0,y:0,z:-1},0)).toBeNull();
  });
  it('unwraps a hand-driven crank across the seam and preserves reverse rotation',()=>{
    close(nearestPhase(-Math.PI+.04,Math.PI-.03),Math.PI+.04);
    close(nearestPhase(Math.PI-.04,-Math.PI+.03),-Math.PI-.04);
    close(nearestPhase(.2,4*Math.PI+.1),4*Math.PI+.2);
  });
  it('keeps the physical fit dial monotonic with exact end stops',()=>{
    close(fitFromDialAngle(-Math.PI),.05);close(fitFromDialAngle(Math.PI),1.2);
    for(const value of [.05,.3,.75,1.2])close(fitFromDialAngle(dialAngleFromFit(value)),value);
  });
  it('generates ink only from evaluated crank poses, including a reverse sweep',()=>{
    const {candidate}=makeWorkbenchReference(),p=candidate.parameters,from=1.2,to=.4,points=kinematicInkSegment(p,from,to);
    expect(points.length).toBeGreaterThan(20);
    points.forEach((point,i)=>{
      const exact=evaluateCouplerPoint(p,from+(to-from)*i/(points.length-1))!.point;
      close(point.x,exact.x);close(point.y,exact.y);
    });
  });
});

describe('deliberate thicker native input',()=>{
  it('verifies all declared dimensions without changing the web reference or solver',()=>{
    const {input,candidate}=makeWorkbenchReference();
    expect(input.fixedMounts.groundCm).toBe(16);expect(input.linkRadiusCm).toBe(.45);expect(input.linkDepthCm).toBe(.7);
    expect(input.linkLayers).toEqual({ground:.6,crank:1.8,rocker:3,coupler:4.2});
    expect(input.tolerances).toEqual({fitCm:.3,closureCm:.002,samples:720});
    const audit=verifyLoopCandidate(input,candidate.parameters);
    expect(audit.valid).toBe(true);expect(audit.inputHash).toBe(buildLoopInputHash(input));
    expect(audit.maxFitErrorCm).toBeLessThan(.02);
    expect(canonicalWorkbenchStroke(input.stroke)).toHaveLength(WORKBENCH_PROFILE.strokeSamples);
    expect(input.stroke.every(p=>Math.abs(p.x*1000-Math.round(p.x*1000))<1e-8&&Math.abs(p.y*1000-Math.round(p.y*1000))<1e-8)).toBe(true);
  });
  it('freshly repairs the 4.5 cm measured keep-out with the exact drawing, mount and fit limit',()=>{
    const {input,candidate}=makeWorkbenchStudy(),before=JSON.stringify(input),reference=verifyLoopCandidate(input,candidate.parameters);
    expect(reference.valid).toBe(false);expect(reference.collisionWitness?.geometry).toBe('crank');
    close(reference.collisionWitness!.marginCm,-.21);
    // This case physically overlaps the rod, rather than only violating its requested safety gap.
    const physicalGap=Math.abs(input.obstacles[0].center.x)-candidate.parameters.crankCm-input.linkRadiusCm-input.obstacles[0].radiusCm;
    close(physicalGap,-.05);
    expect(input.obstacles[0]).toMatchObject({id:'provided-container',radiusCm:4.5,depthCm:4,layerZCm:2});
    const result=solveLoop(input);
    expect(result.status).toBe('succeeded');expect(result.candidates.length).toBeGreaterThan(0);
    expect(JSON.stringify(input)).toBe(before);
    for(const found of result.candidates){
      const audit=verifyLoopCandidate(input,found.parameters);
      expect(audit.valid).toBe(true);expect(audit.maxFitErrorCm).toBeLessThanOrEqual(.3);
      expect(audit.minClearanceCm).toBeGreaterThan(0);expect(found.parameters.groundCm).toBe(16);
      expect(found.parameters.crankCm).toBeLessThan(candidate.parameters.crankCm);
      expect(audit.inputHash).toBe(buildLoopInputHash(input));
    }
  });
});
