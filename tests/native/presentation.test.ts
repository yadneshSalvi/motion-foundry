import {describe,it,expect} from 'vitest';
import {mugStandInMeshes} from '../../lens-src/WorkbenchGeometry';
import {makeWorkbenchReference,WORKBENCH_KEEP_OUT} from '../../lens-src/WorkbenchProfile';
import {OrderedTraceMatch,canSnapStroke,crankReleaseStep,dashedStroke,distanceBand,fadeTowards,placementPolicy,withWorkbenchObstacle} from '../../lens-src/WorkbenchPresentation';
import {evaluateCouplerPoint,verifyLoopCandidate} from '../../src/domain/loop';

describe('truthful native trace feedback',()=>{
  it('matches the verifier’s ordered witness without moving the actual coupler point',()=>{
    const {input,candidate}=makeWorkbenchReference(),map=new OrderedTraceMatch(input,candidate.parameters);
    const witness=verifyLoopCandidate(input,candidate.parameters).fitWitness!;
    const actual=map.at(witness.phaseRad)!;
    expect(actual.actual).toEqual(evaluateCouplerPoint(candidate.parameters,witness.phaseRad)!.point);
    expect(actual.desired.x).toBeCloseTo(witness.desired.x,9);
    expect(actual.desired.y).toBeCloseTo(witness.desired.y,9);
    expect(actual.errorCm).toBeCloseTo(witness.errorCm,9);
  });
  it('does not make reversed ordered traversal green just because it uses the same point set',()=>{
    const {input,candidate}=makeWorkbenchReference();
    const reversed={...candidate.parameters,driveDirection:-1 as const};
    const wrong=new OrderedTraceMatch(input,reversed);
    const errors=Array.from({length:120},(_,i)=>wrong.at(reversed.startingPhaseRad-i*Math.PI/60)!.errorCm);
    expect(Math.max(...errors)).toBeGreaterThan(input.tolerances.fitCm*5);
    const correctInput={...input,stroke:[input.stroke[0],...input.stroke.slice(1).reverse()]};
    const correct=new OrderedTraceMatch(correctInput,reversed);
    const good=Array.from({length:120},(_,i)=>correct.at(reversed.startingPhaseRad-i*Math.PI/60)!.errorCm);
    expect(Math.max(...good)).toBeLessThan(input.tolerances.fitCm);
  });
  it('retains ordered seams and returns the same match after complete crank turns',()=>{
    const {input,candidate}=makeWorkbenchReference(),map=new OrderedTraceMatch(input,candidate.parameters);
    for(const phase of [.2,1,4.7,6.4]){
      const a=map.at(phase)!,b=map.at(phase+4*Math.PI)!;
      expect(a.errorCm).toBeCloseTo(b.errorCm,10);expect(a.progress).toBeCloseTo(b.progress,10);
    }
  });
  it('dashes actual input edges without bridging across a corner or skipping stroke order',()=>{
    const path=[{x:0,y:0},{x:2,y:0},{x:2,y:2},{x:0,y:2}],dashes=dashedStroke(path,true,.6,.4);
    expect(dashes.length).toBe(8);
    for(const dash of dashes)for(const point of dash)expect(point.x===0||point.x===2||point.y===0||point.y===2).toBe(true);
    expect(dashes[0][0]).toEqual(path[0]);
  });
});

describe('direct-control presentation policy',()=>{
  it('snaps a real returning loop and rejects open or tiny early strokes',()=>{
    const loop=Array.from({length:65},(_,i)=>({x:5*Math.cos(i*Math.PI/32),y:5*Math.sin(i*Math.PI/32)}));
    expect(canSnapStroke(loop)).toBe(true);expect(canSnapStroke(loop.slice(0,50))).toBe(false);
    expect(canSnapStroke(Array.from({length:30},(_,i)=>({x:i*.01,y:0})))).toBe(false);
    expect(canSnapStroke(loop.slice(0,10))).toBe(false);
  });
  it('uses stable distance bands and a 300 ms fade',()=>{
    expect(distanceBand(54)).toBe('near');expect(distanceBand(75)).toBe('middle');expect(distanceBand(121)).toBe('far');
    expect(distanceBand(60,'near')).toBe('near');expect(distanceBand(66,'near')).toBe('middle');
    expect(distanceBand(116,'far')).toBe('far');expect(distanceBand(109,'far')).toBe('middle');
    expect(distanceBand(50,'middle')).toBe('middle');expect(distanceBand(44,'middle')).toBe('near');
    let opacity=0;for(let i=0;i<18;i++)opacity=fadeTowards(opacity,1,1/60);expect(opacity).toBeCloseTo(1,10);
  });
  it('decays a release flick independently of frame rate and preserves reverse input',()=>{
    const integrate=(dt:number)=>{let velocity=3,phase=0;for(let i=0;i<Math.round(1/dt);i++){const step=crankReleaseStep(velocity,1,dt);velocity=step.velocity;phase+=step.advance;}return{velocity,phase};};
    const a=integrate(1/60),b=integrate(1/30);expect(a.phase).toBeCloseTo(b.phase,10);expect(a.velocity).toBeCloseTo(b.velocity,10);
    expect(a.velocity).toBeLessThan(1);expect(a.velocity).toBeGreaterThan(.42);
    expect(crankReleaseStep(-3,-1,.016).advance).toBeLessThan(0);
    expect(Number.isFinite(crankReleaseStep(NaN,1,2).advance)).toBe(true);
  });
  it('requires placement on the device while explicitly retaining the Preview saved spot',()=>{
    expect(placementPolicy(false)).toMatchObject({beginPlacement:true,showStandIn:false,startupLabel:'',branch:'device-surface-placement'});
    expect(placementPolicy(true)).toMatchObject({beginPlacement:false,showStandIn:true,branch:'preview-saved-spot'});
    expect(placementPolicy(true,true).beginPlacement).toBe(true);
  });
});

describe('manual mug stand-in',()=>{
  it('keeps the complete body, handle and rim inside the actually checked cylinder',()=>{
    for(const radius of [2.5,4.5,6])for(const depth of [3,4,6]){
      const pieces=mugStandInMeshes(radius,depth);
      for(const mesh of Object.values(pieces))for(let i=0;i<mesh.vertices.length;i+=8){
        const [x,y,z]=mesh.vertices.slice(i,i+3);
        expect(Math.hypot(x,y)).toBeLessThanOrEqual(radius+1e-9);
        expect(Math.abs(z)).toBeLessThanOrEqual(depth/2+1e-9);
      }
      expect(Math.max(...pieces.handle.vertices.filter((_,i)=>i%8===0))).toBeGreaterThan(radius-.05);
    }
  });
  it('adds an obstacle without replacing a fresh sketch, mounts, scale, fit or any other field',()=>{
    const {input}=makeWorkbenchReference();input.revision=12;
    input.stroke=input.stroke.map((p,i)=>({x:p.x+.07,y:p.y+Math.sin(i)*.01}));
    input.fixedMounts.groundCm=15.6;input.tolerances.fitCm=.28;
    const before=JSON.stringify(input),next=withWorkbenchObstacle(input,WORKBENCH_KEEP_OUT);
    expect(JSON.stringify(input)).toBe(before);
    expect({...next,obstacles:[]}).toEqual(input);expect(next.obstacles[0]).toEqual(WORKBENCH_KEEP_OUT);
    next.stroke[0].x+=1;expect(JSON.stringify(input)).toBe(before);
  });
});
