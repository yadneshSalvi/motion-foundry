import {readFileSync} from 'node:fs';
import {stripTypeScriptTypes} from 'node:module';
import {runInNewContext} from 'node:vm';
import {describe,expect,it} from 'vitest';
import * as layout from '../../lens-src/WorkbenchLayout';

class V3 {
  constructor(public x:number,public y:number,public z:number){}
  add(v:V3){return new V3(this.x+v.x,this.y+v.y,this.z+v.z);}
  sub(v:V3){return new V3(this.x-v.x,this.y-v.y,this.z-v.z);}
  uniformScale(n:number){return new V3(this.x*n,this.y*n,this.z*n);}
  get length(){return Math.hypot(this.x,this.y,this.z);}
  normalize(){return this.uniformScale(1/this.length);}
  dot(v:V3){return this.x*v.x+this.y*v.y+this.z*v.z;}
  distance(v:V3){return this.sub(v).length;}
}
const transformNative=stripTypeScriptTypes as unknown as (s:string,o:{mode:'transform'})=>string;
function prototype(name:string){
  const source=readFileSync(new URL(`../../lens-src/${name}.ts`,import.meta.url),'utf8');
  const code=transformNative(source.replace(/^import .*;$/gm,'').replace(`export class ${name}`,`class ${name}`),{mode:'transform'})+`\nexports.Native=${name};`;
  const exports:Record<string,any>={};
  runInNewContext(code,{exports,vec3:V3,...layout});
  return Object.create(exports.Native.prototype);
}

describe('actual tag and gesture annotation boundaries',()=>{
  it('reserves the complete rotated QR/backing and caption, and no space while hidden',()=>{
    const card=prototype('MotionExportCard');
    card.placement={extent:10};card.visible=true;
    card.object={enabled:true,getTransform:()=>({getWorldTransform:()=>({multiplyPoint:(p:V3)=>new V3(10-p.y,20+p.x,30+p.z)})})};
    const exclusions=card.exclusions();
    expect(exclusions.map((v:{id:string})=>v.id)).toEqual(['share-qr','share-caption']);
    const limits=(points:V3[],axis:'x'|'y'|'z')=>[Math.min(...points.map(p=>p[axis])),Math.max(...points.map(p=>p[axis]))];
    expect(exclusions.every((e:{points:V3[]})=>e.points.length===8)).toBe(true);
    expect(limits(exclusions[0].points,'x')).toEqual([4.6,15.4]);
    expect(limits(exclusions[0].points,'y')).toEqual([14.6,25.4]);
    expect(limits(exclusions[1].points,'x')[0]).toBeCloseTo(15.05,10);
    expect(limits(exclusions[1].points,'x')[1]).toBeCloseTo(18.15,10);
    expect(limits(exclusions[1].points,'z')[1]).toBeCloseTo(30.28,10);
    card.hide();expect(card.exclusions()).toEqual([]);expect(card.isVisible()).toBe(false);
  });
  it('moves a live plate from a hand-covered cached slot to a safe nearby slot without moving its target',()=>{
    const labels=prototype('WorkbenchLabels'),target=new V3(0,0,50),cached=new V3(7,0,48.5);
    Object.assign(labels,{camera:{getWorldPosition:()=>new V3(0,0,0),right:()=>new V3(1,0,0),up:()=>new V3(0,1,0),inFoV:()=>true},
      invalidateLayout:false,surfaceY:-Infinity,subjects:[],occupied:[],leaders:[],gestureOccluders:[],
      box:(p:V3,w:number,h:number)=>({left:.5+p.x/50-w/100,right:.5+p.x/50+w/100,top:.5-p.y/50-h/100,bottom:.5-p.y/50+h/100}),leaderLine:()=>null});
    expect(labels.nearPlacement(6,2,target,true,cached).point).toBe(cached);
    labels.gestureOccluders=[{id:'hand:right',box:{left:.52,right:.92,top:.25,bottom:.85}}];
    const result=labels.nearPlacement(6,2,target,true,cached);
    expect(result).not.toBeNull();expect(result.point.x).toBeLessThan(0);
    expect(result.point.distance(target)).toBeLessThanOrEqual(10);
    expect(layout.boxesOverlap(result.box,labels.gestureOccluders[0].box)).toBe(false);
    expect(target).toEqual(new V3(0,0,50));
  });
});
