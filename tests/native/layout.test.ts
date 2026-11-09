import {describe,it,expect} from 'vitest';
import {bounds,boxesOverlap,cameraChanged,insideViewport,labelCandidateAllowed,linesCross,projectedOcclusion,segmentHitsBox,vector3Data,rotationData} from '../../lens-src/WorkbenchLayout';

const subject={id:'moving rod',line:{a:{x:.2,y:.35},b:{x:.8,y:.65},radius:.01},depthNear:50};
describe('native projected subject exclusion',()=>{
  it('serializes actual native coordinate fields even when the host properties are not enumerable',()=>{
    const native=Object.defineProperties({},{x:{value:1},y:{value:-2},z:{value:3},w:{value:.5}}) as {x:number;y:number;z:number;w:number};
    expect(JSON.stringify(native)).toBe('{}');
    expect(JSON.parse(JSON.stringify(vector3Data(native)))).toEqual({x:1,y:-2,z:3});
    expect(JSON.parse(JSON.stringify(rotationData(native)))).toEqual({x:1,y:-2,z:3,w:.5});
  });
  it('uses capsule/rectangle intersections without blocking all of a diagonal rod’s bounding box',()=>{
    expect(segmentHitsBox(subject.line,{left:.45,right:.55,top:.46,bottom:.54})).toBe(true);
    expect(segmentHitsBox(subject.line,{left:.2,right:.3,top:.6,bottom:.7})).toBe(false);
    expect(segmentHitsBox({a:{x:.2,y:.4},b:{x:.8,y:.4},radius:.02},{left:.45,right:.55,top:.41,bottom:.5})).toBe(true);
  });
  it('rejects fixed plates and optional plates by the same viewport, subject, occupied and leader policy',()=>{
    const obstructing={left:.45,right:.55,top:.46,bottom:.54},safe={left:.25,right:.35,top:.65,bottom:.75};
    expect(labelCandidateAllowed(obstructing,[subject],[],[])).toBe(false);
    expect(labelCandidateAllowed(safe,[subject],[],[])).toBe(true);
    expect(labelCandidateAllowed(safe,[subject],[safe],[])).toBe(false);
    expect(labelCandidateAllowed(safe,[subject],[],[{a:{x:.3,y:.5},b:{x:.3,y:.9}}])).toBe(false);
    expect(insideViewport({left:-.1,right:.1,top:.3,bottom:.4})).toBe(false);
  });
  it('rejects crossed leaders and counts depth-aware drawing coverage separately from physical clearance',()=>{
    expect(linesCross({a:{x:.2,y:.2},b:{x:.8,y:.8}},{a:{x:.8,y:.2},b:{x:.2,y:.8}})).toBe(true);
    expect(linesCross({a:{x:.2,y:.2},b:{x:.8,y:.2}},{a:{x:.2,y:.3},b:{x:.8,y:.3}})).toBe(false);
    const samples=[{x:.5,y:.5,depth:60},{x:.5,y:.5,depth:40},{x:.1,y:.1,depth:60}];
    expect(projectedOcclusion(samples,[subject])).toBeCloseTo(1/3,12);
    expect(projectedOcclusion(samples,[{...subject,depthNear:70}])).toBe(0);
  });
  it('does not repeatedly relayout below the two-centimetre or two-degree camera thresholds',()=>{
    const a={position:{x:0,y:0,z:0},rotation:{x:0,y:0,z:0,w:1}};
    expect(cameraChanged(null,a)).toBe(true);
    expect(cameraChanged(a,{...a,position:{x:1.9,y:0,z:0}})).toBe(false);
    expect(cameraChanged(a,{...a,position:{x:2.01,y:0,z:0}})).toBe(true);
    const q=(degrees:number)=>({x:0,y:Math.sin(degrees*Math.PI/360),z:0,w:Math.cos(degrees*Math.PI/360)});
    expect(cameraChanged(a,{...a,rotation:q(1.9)})).toBe(false);
    expect(cameraChanged(a,{...a,rotation:q(2.1)})).toBe(true);
  });
  it('keeps negative screen coordinates visible to the checker instead of clipping a box into a false pass',()=>{
    const box=bounds([{x:-.2,y:.2},{x:.3,y:.7}],.01);
    expect(box.left).toBeCloseTo(-.21);expect(insideViewport(box)).toBe(false);
    expect(boxesOverlap(box,{left:.25,right:.4,top:.3,bottom:.4})).toBe(true);
  });
});
