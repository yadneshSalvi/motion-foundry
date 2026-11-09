import {describe,it,expect} from 'vitest';
import {IncrementalTraceTube,PersistentOrderedTrace,TraceMeshBuilder} from '../../lens-src/WorkbenchTrace';
import {evaluateCouplerPoint,knownLoopParameters,makeDefaultLoopInput} from '../../lens-src/LoopDomain';
const TAU=2*Math.PI;
const p={...knownLoopParameters};
function setup(segments=120){const input=makeDefaultLoopInput(),trace=new PersistentOrderedTrace(segments);trace.configure(input,p,'first');return {input,trace};}
function turn(trace:PersistentOrderedTrace,direction=1,start=p.startingPhaseRad){
  trace.advance(start);for(let i=1;i<=240;i++)trace.advance(start+direction*TAU*i/240);
}

describe('persistent ordered physical trace',()=>{
  it('earns no coverage from configuration, initial pose or paused updates',()=>{
    const {trace}=setup();expect(trace.state()).toMatchObject({ready:true,inspected:0,matched:0,complete:false});
    for(let i=0;i<100;i++)expect(trace.advance(p.startingPhaseRad).ink).toHaveLength(0);
    expect(trace.state().inspected).toBe(0);
  });
  it('preserves mint and actual ink independently after a genuine full turn',()=>{
    const {trace}=setup();trace.advance(p.startingPhaseRad);
    const delta=trace.advance(p.startingPhaseRad+TAU/4);
    expect(trace.state().matched).toBeGreaterThan(20);expect(trace.state().complete).toBe(false);
    expect(delta.ink[delta.ink.length-1]).toEqual(evaluateCouplerPoint(p,p.startingPhaseRad+TAU/4)!.point);
    const earned=trace.state().matched;
    trace.advance(p.startingPhaseRad+TAU/8);expect(trace.state().matched).toBeGreaterThanOrEqual(earned);
    for(let i=1;i<=240;i++)trace.advance(p.startingPhaseRad+TAU/8+TAU*i/240);
    expect(trace.state()).toMatchObject({inspected:120,matched:120,complete:true});
    trace.advance(p.startingPhaseRad+TAU/8+TAU);expect(trace.state().matched).toBe(120);
  });
  it('handles a reverse physical pass and ordered seams without changing correspondence',()=>{
    const {trace}=setup();turn(trace,-1);
    expect(trace.state()).toMatchObject({inspected:120,matched:120,complete:true});
    const other=setup().trace;turn(other,1,p.startingPhaseRad+TAU*.93);
    expect(other.state()).toMatchObject({inspected:120,matched:120,complete:true});
    const reversed={...p,driveDirection:-1 as const},input=makeDefaultLoopInput();
    input.stroke=[input.stroke[0],...input.stroke.slice(1).reverse()];
    const correct=new PersistentOrderedTrace(120);correct.configure(input,reversed);turn(correct,-1);
    expect(correct.state().complete).toBe(true);
  });
  it('does not confuse retraced coverage with a complete revolution',()=>{
    const {trace}=setup();trace.advance(p.startingPhaseRad);
    for(let repeat=0;repeat<10;repeat++){
      trace.advance(p.startingPhaseRad+TAU*.2);trace.advance(p.startingPhaseRad);
    }
    expect(trace.state().inspected).toBeLessThan(30);expect(trace.state().complete).toBe(false);
  });
  it('leaves imperfect target segments unfilled with failure witnesses after complete inspection',()=>{
    const {input,trace}=setup();input.stroke=input.stroke.map((point,i)=>({x:point.x+(i>50&&i<100?1:0),y:point.y}));
    trace.configure(input,p);turn(trace);
    const state=trace.state();expect(state.inspected).toBe(120);expect(state.complete).toBe(false);
    expect(state.matched).toBeLessThan(120);expect(state.failureTicks.length).toBeGreaterThan(0);
    for(const witness of state.failureTicks){
      expect(witness.errorCm).toBeGreaterThan(input.tolerances.fitCm);
      expect(state.cells[witness.index].matched).toBe(false);
    }
    // Actual ink remains an exact pose even when desired geometry is far away.
    trace.restart(p.startingPhaseRad);const result=trace.advance(p.startingPhaseRad+1);
    expect(result.ink[result.ink.length-1]).toEqual(evaluateCouplerPoint(p,p.startingPhaseRad+1)!.point);
  });
  it('never treats reversed ordered drawing as a valid match',()=>{
    const {input,trace}=setup();trace.configure(input,{...p,driveDirection:-1});turn(trace,-1);
    expect(trace.state().inspected).toBe(120);expect(trace.state().complete).toBe(false);
    expect(trace.state().failureTicks.length).toBeGreaterThan(30);
  });
  it('resets on exact input/parameter/candidate changes, including in-place changes',()=>{
    const {input,trace}=setup();turn(trace);expect(trace.configure(input,{...p},'first')).toBe(false);
    expect(trace.state().complete).toBe(true);
    input.stroke[0].x+=1e-10;expect(trace.configure(input,p,'first')).toBe(true);expect(trace.state().inspected).toBe(0);
    turn(trace);expect(trace.configure(input,p,'second')).toBe(true);expect(trace.state().matched).toBe(0);
    turn(trace);trace.configure(input,{...p,attachmentAcrossCm:p.attachmentAcrossCm+1e-10},'second');
    expect(trace.state().matched).toBe(0);turn(trace);trace.restart();expect(trace.state().inspected).toBe(0);
  });
  it('rejects invalid branches, invalid input and unreachable geometry without success',()=>{
    const {input,trace}=setup();turn(trace);
    trace.configure(input,{...p,branch:0 as 1});expect(trace.state()).toMatchObject({ready:false,complete:false,matched:0,total:0});
    trace.configure({...input,stroke:[]},p);expect(trace.state().ready).toBe(false);
    trace.configure(input,{...p,couplerCm:.01});expect(trace.state().ready).toBe(false);
    trace.configure(input,{...p,startingPhaseRad:NaN});expect(trace.state().complete).toBe(false);
  });
  it('reanchors nonfinite phases and large discontinuities without inventing a swept path',()=>{
    const {trace}=setup();trace.advance(p.startingPhaseRad);
    expect(trace.advance(p.startingPhaseRad+TAU*3)).toMatchObject({breakInk:true,ink:[],changed:[]});
    expect(trace.state().inspected).toBe(0);trace.advance(NaN);
    expect(trace.advance(p.startingPhaseRad).ink).toHaveLength(0);expect(trace.state().complete).toBe(false);
    // A known, continuous one-turn advance can be sampled from exact kinematics.
    trace.advance(p.startingPhaseRad+TAU);expect(trace.state().complete).toBe(true);
  });
});

class Builder implements TraceMeshBuilder {
  vertices:number[]=[];indices:number[]=[];updates=0;erases=0;appends:number[]=[];
  appendVerticesInterleaved(v:number[]){this.vertices.push(...v);this.appends.push(v.length);}
  appendIndices(i:number[]){this.indices.push(...i);}
  getVerticesCount(){return this.vertices.length/8;}getIndicesCount(){return this.indices.length;}
  eraseVertices(from:number,to:number){this.vertices.splice(from*8,(to-from)*8);this.erases++;}
  eraseIndices(from:number,to:number){this.indices.splice(from,to-from);this.erases++;}
  updateMesh(){this.updates++;}
}
describe('bounded incremental native ink mesh',()=>{
  it('appends new segments without rebuilding old geometry or updating while paused',()=>{
    const builder=new Builder(),tube=new IncrementalTraceTube(builder,.2,6,12);
    expect(tube.append([{x:0,y:0,z:0},{x:1,y:0,z:0}])).toBe(1);
    const first=builder.vertices.slice();tube.append([{x:1,y:0,z:0},{x:2,y:0,z:0}]);
    expect(builder.vertices.slice(0,first.length)).toEqual(first);expect(builder.appends).toEqual([96,96]);
    expect(builder.erases).toBe(0);expect(builder.updates).toBe(2);
    tube.append([{x:2,y:0,z:0}]);expect(builder.updates).toBe(2);
    expect(builder.indices.every(i=>i>=0&&i<builder.getVerticesCount())).toBe(true);
  });
  it('bounds memory, avoids gap bridges and clears only on explicit reset',()=>{
    const builder=new Builder(),tube=new IncrementalTraceTube(builder,.2,6,2);
    tube.append([{x:0,y:0,z:0},{x:1,y:0,z:0}]);tube.breakStroke();
    tube.append([{x:100,y:0,z:0}]);expect(tube.segmentCount).toBe(1);
    tube.append([{x:101,y:0,z:0},{x:102,y:0,z:0}]);expect(tube.full).toBe(true);
    expect(builder.getVerticesCount()).toBe(24);expect(builder.erases).toBe(0);
    tube.reset();expect(builder.getVerticesCount()).toBe(0);expect(builder.getIndicesCount()).toBe(0);
    expect(tube.segmentCount).toBe(0);tube.append([{x:0,y:0,z:0}]);expect(tube.segmentCount).toBe(0);
  });
  it('never erases an empty native range or uploads an empty native mesh on reset',()=>{
    class StrictBuilder extends Builder {
      eraseVertices(from:number,to:number){expect(to).toBeGreaterThan(from);super.eraseVertices(from,to);}
      eraseIndices(from:number,to:number){expect(to).toBeGreaterThan(from);super.eraseIndices(from,to);}
      updateMesh(){expect(this.getVerticesCount()).toBeGreaterThan(0);expect(this.getIndicesCount()).toBeGreaterThan(0);super.updateMesh();}
    }
    const empty=new StrictBuilder(),emptyTube=new IncrementalTraceTube(empty);
    emptyTube.reset();emptyTube.reset();expect(empty.updates).toBe(0);expect(empty.erases).toBe(0);
    const native=new StrictBuilder();
    native.appendVerticesInterleaved(Array.from({length:3},()=>[0,0,0,0,0,1,0,0]).flat());native.appendIndices([0,1,2]);
    const tube=new IncrementalTraceTube(native,.2,6,2),seed=native.vertices.slice();
    tube.reset();expect(native.erases).toBe(0);expect(native.updates).toBe(0);
    tube.append([{x:0,y:0,z:0},{x:1,y:0,z:0}]);expect(tube.segmentCount).toBe(1);
    expect(native.indices.slice(3).every(i=>i>=3)).toBe(true);
    tube.reset();expect(native.vertices).toEqual(seed);expect(native.indices).toEqual([0,1,2]);
    expect(native.updates).toBe(2);expect(native.erases).toBe(2);
    tube.reset();expect(native.updates).toBe(2);expect(native.erases).toBe(2);
  });
});
