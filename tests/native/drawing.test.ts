import {describe,expect,it} from 'vitest';
import {visibleClosedPath} from '../../lens-src/tests/WorkbenchDrawPath';

describe('visible ordered drawing start',()=>{
  const a={x:1,y:0},b={x:2,y:1},c={x:1,y:2},d={x:0,y:1};
  const closed=[a,b,c,d,a];
  it('changes only the cyclic start, retaining every coordinate, directed edge and closure',()=>{
    const before=structuredClone(closed),result=visibleClosedPath(closed,p=>p);
    expect(result.startIndex).toBe(2);expect(result.points).toEqual([c,d,a,b,c]);
    expect(result.points[0]).toBe(result.points.at(-1));
    expect(closed).toEqual(before);
    const edges=(path:{x:number;y:number}[])=>path.slice(0,-1).map((p,i)=>JSON.stringify([p,path[i+1]])).sort();
    expect(edges(result.points)).toEqual(edges(closed));
    expect(result.points.slice(0,-1).every(p=>closed.includes(p))).toBe(true);
  });
  it('uses the current camera projection without reversing the ordered drawing',()=>{
    const result=visibleClosedPath(closed,p=>({x:p.y,y:-p.x}));
    expect(result.points).toEqual([d,a,b,c,d]);
  });
  it('refuses an open stroke or an invalid projection instead of silently bridging it',()=>{
    expect(()=>visibleClosedPath([a,b,c,d],p=>p)).toThrow('Explicitly close');
    expect(()=>visibleClosedPath(closed,p=>({x:p.x,y:NaN}))).toThrow('finite');
  });
});
