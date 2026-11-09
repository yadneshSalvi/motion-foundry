import {readFileSync} from 'node:fs';
import {stripTypeScriptTypes} from 'node:module';
import {runInNewContext} from 'node:vm';
import {describe,expect,it} from 'vitest';

// Exercise the actual placement class against a small native-API boundary.
// This is branch/ray coverage, not a claim of WorldQuery or glasses testing.
class V3 {
  constructor(public x:number,public y:number,public z:number){}
  add(v:V3){return new V3(this.x+v.x,this.y+v.y,this.z+v.z);}
  sub(v:V3){return new V3(this.x-v.x,this.y-v.y,this.z-v.z);}
  uniformScale(n:number){return new V3(this.x*n,this.y*n,this.z*n);}
  normalize(){return this.uniformScale(1/Math.hypot(this.x,this.y,this.z));}
  distance(v:V3){const d=this.sub(v);return Math.hypot(d.x,d.y,d.z);}
  static one(){return new V3(1,1,1);}
}
const nativeSource=readFileSync(new URL('../../lens-src/WorkbenchPlacement.ts',import.meta.url),'utf8');
// The pinned Node 22 runtime supports transform mode for native parameter
// properties. Newer @types/node describes only strip mode.
const transformNative=stripTypeScriptTypes as unknown as (source:string,options:{mode:'transform'})=>string;
const code=transformNative(nativeSource.replace(/^import .*;$/gm,'')
  .replace('export class WorkbenchPlacement','class WorkbenchPlacement'),{mode:'transform'})
  +'\nexports.WorkbenchPlacement=WorkbenchPlacement;';

function fixture(pitch=40,yaw=0,isEditor=true){
  const rad=Math.PI/180,gaze=new V3(Math.sin(yaw*rad)*Math.cos(pitch*rad),-Math.sin(pitch*rad),-Math.cos(yaw*rad)*Math.cos(pitch*rad));
  const eye=new V3(-30,-101.1,-424.2),queries:{start:V3;end:V3;reply:(result:unknown)=>void}[]=[],positions:V3[]=[];
  let now=1,placed=0;
  const transform={setWorldPosition:(v:V3)=>positions.push(v),setWorldRotation:()=>{},setLocalScale:()=>{}};
  const cursor={enabled:false,createComponent:()=>({}),getTransform:()=>({setWorldPosition:()=>{}}),destroy:()=>{}};
  const session={start:()=>{},stop:()=>{},hitTest:(start:V3,end:V3,reply:(result:unknown)=>void)=>queries.push({start,end,reply})};
  const camera={getWorldPosition:()=>eye,getTransform:()=>({forward:gaze.uniformScale(-1)})};
  class Mesh {appendVerticesInterleaved(){}appendIndices(){}updateMesh(){}getMesh(){return{};}}
  const exports:Record<string,any>={};
  runInNewContext(code,{exports,require:(name:string)=>{
    if(name==='LensStudio:WorldQueryModule')return{createHitTestSession:()=>session};
    throw Error('Unexpected native import: '+name);
  },SIK:{InteractionManager:{getInteractorsByType:()=>[]}},InteractorInputType:{All:0},
  WorldCameraFinderProvider:{getInstance:()=>camera},vec3:V3,MeshBuilder:Mesh,MeshTopology:{Triangles:0},MeshIndexType:{UInt16:0},
  global:{scene:{createSceneObject:()=>cursor}},getTime:()=>now,print:()=>{},
  quat:{fromEulerAngles:()=>({})}});
  const placement=new exports.WorkbenchPlacement({createEvent:()=>({bind:()=>{}})},
    {getTransform:()=>transform},{},()=>{},()=>{placed++;},isEditor);
  return{placement,gaze,eye,queries,positions,cursor,setTime:(v:number)=>{now=v;},get placed(){return placed;}};
}

describe('actual-gaze surface placement',()=>{
  it('queries camera pitch and yaw, with nearby controls below the gaze',()=>{
    for(const pitch of [35,40,45])for(const yaw of [-60,0,70]){
      const f=fixture(pitch,yaw);f.placement.begin();f.placement.tick();
      expect(f.queries).toHaveLength(1);
      const ray=f.queries[0].end.sub(f.queries[0].start);
      expect(ray.distance(f.gaze.uniformScale(220))).toBeLessThan(1e-10);
      const offset=f.placement.controlsPoint().sub(f.eye),length=Math.hypot(offset.x,offset.y,offset.z);
      expect(length).toBeGreaterThan(60);expect(length).toBeLessThan(70);
      expect(-offset.y).toBeGreaterThan(35);expect(-offset.y).toBeLessThan(48);
      const cosine=(offset.x*f.gaze.x+offset.y*f.gaze.y+offset.z*f.gaze.z)/length;
      expect(Math.acos(cosine)*180/Math.PI).toBeLessThan(4);
      expect(offset.y).toBeLessThan(f.gaze.y*61);
    }
  });
  it('refuses absent, nonhorizontal, distant and stale hits on the device',()=>{
    for(const result of [null,{normal:new V3(0,.5,0),position:new V3(0,-140,-470)},
      {normal:new V3(0,1,0),position:new V3(0,-140,-800)}]){
      const f=fixture(40,0,false);f.placement.begin();f.placement.tick();f.queries[0].reply(result);
      expect(f.placement.commitHit()).toBe(false);expect(f.positions).toHaveLength(0);
      expect(f.cursor.enabled).toBe(false);f.placement.cancel();expect(f.placement.mode).toBe('placing');
    }
    const f=fixture(40,0,false);f.placement.begin();f.placement.tick();
    f.queries[0].reply({normal:new V3(0,1,0),position:f.eye.add(f.gaze.uniformScale(65))});
    f.setTime(2);expect(f.placement.hasHit()).toBe(false);expect(f.placement.commitHit()).toBe(false);
    expect(f.positions).toHaveLength(0);
  });
  it('ignores a prior query after restart and commits only a fresh actual result once',()=>{
    const f=fixture(40,25,false);f.placement.begin();f.placement.tick();const old=f.queries[0];
    f.placement.begin();f.setTime(1.3);f.placement.tick();
    const actual=f.eye.add(f.gaze.uniformScale(65)),hit={position:actual,normal:new V3(0,1,0)};
    old.reply(hit);expect(f.placement.hasHit()).toBe(false);expect(f.placement.commitHit()).toBe(false);
    f.queries[1].reply(hit);expect(f.placement.hasHit()).toBe(true);expect(f.placement.commitHit()).toBe(true);
    expect(f.positions[0].distance(actual.add(new V3(0,.5,0)))).toBeLessThan(1e-10);
    expect(f.placed).toBe(1);expect(f.placement.commitHit()).toBe(false);expect(f.positions).toHaveLength(1);
  });
});
