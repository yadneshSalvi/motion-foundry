import {readFileSync} from 'node:fs';
import {stripTypeScriptTypes} from 'node:module';
import {runInNewContext} from 'node:vm';
import {describe,expect,it} from 'vitest';

// Execute the actual native class against a mocked SDK boundary. This checks
// lifecycle policy; rendered final poses still need native Preview inspection.
class V3 {
  constructor(public x:number,public y:number,public z:number){}
  add(v:V3){return new V3(this.x+v.x,this.y+v.y,this.z+v.z);}
  sub(v:V3){return new V3(this.x-v.x,this.y-v.y,this.z-v.z);}
  uniformScale(n:number){return new V3(this.x*n,this.y*n,this.z*n);}
  normalize(){return this.uniformScale(1/Math.hypot(this.x,this.y,this.z));}
}
const source=readFileSync(new URL('../../lens-src/WorkbenchHints.ts',import.meta.url),'utf8');
const transformNative=stripTypeScriptTypes as unknown as (source:string,options:{mode:'transform'})=>string;
const code=transformNative(source.replace(/^import .*;$/gm,'')
  .replace('export class WorkbenchHints','class WorkbenchHints'),{mode:'transform'})
  +'\nexports.WorkbenchHints=WorkbenchHints;';

function fixture(){
  let now=0,inView=true,playing=false,start=()=>{};
  const calls:unknown[][]=[],removed:unknown[]=[],disabled:string[]=[];
  const clips:Record<string,{playbackMode:number}>={};
  const player={getClip:(name:string)=>clips[name]??=( {playbackMode:1}),
    getClipIsPlaying:()=>playing,stopClip:()=>{playing=false;},
    setClipEnabled:(name:string,enabled:boolean)=>{if(!enabled)disabled.push(name);},
    onEvent:{remove:(registration:unknown)=>removed.push(registration)}};
  const transform={setLocalScale:()=>{},setWorldPosition:()=>{},setWorldRotation:()=>{}};
  const anchor={enabled:false,setParent:()=>{},getTransform:()=>transform,
    get isEnabledInHierarchy(){return this.enabled;}};
  const controller={autoPlay:true,animationPlayerClipEndEvent:'official-fade-handler',
    playHintAnimation:(...args:unknown[])=>{playing=true;calls.push(args);}};
  const guide={name:'GUIDE_ReadAndDisable',enabled:true,getChildrenCount:()=>0};
  const hand={name:'HandHints',getChildrenCount:()=>0,getComponent:()=>player};
  const root={name:'Official hints',getChildrenCount:()=>2,getChild:(i:number)=>i?hand:guide,getComponent:()=>controller};
  const camera={getWorldPosition:()=>new V3(0,10,20),inFoV:()=>inView};
  const exports:Record<string,any>={};
  runInNewContext(code,{exports,global:{scene:{createSceneObject:()=>anchor}},
    requireAsset:()=>({instantiate:()=>root}),InteractionHintController:{getTypeName:()=> 'HintController'},
    HandMode:{Right:'right'},HandAnimationsLibrary:{Right:{PinchRotateZ:'rotate',PinchMoveX:'move'}},PlaybackMode:{Single:0},
    WorldCameraFinderProvider:{getInstance:()=>camera},getTime:()=>now,vec3:V3,
    quat:{fromEulerAngles:()=>({})}});
  const hints=new exports.WorkbenchHints({createEvent:()=>({bind:(callback:()=>void)=>{start=callback;}})},{});
  return{hints,calls,anchor,clips,removed,disabled,start:()=>start(),setTime:(value:number)=>{now=value;},
    finishAnimation:()=>{playing=false;},setVisible:(value:boolean)=>{inView=value;},
    tick:(kind:string|null)=>hints.tick(kind,new V3(0,0,0),{multiply:()=>({})})};
}

describe('official hint encounter policy',()=>{
  it('does not consume a hint before startup, its delay or actual visibility',()=>{
    const f=fixture();f.tick('crank');expect(f.calls).toHaveLength(0);
    f.start();f.setTime(1);f.tick('crank');expect(f.calls).toHaveLength(0);
    f.setTime(2);f.setVisible(false);f.tick('crank');expect(f.calls).toHaveLength(0);
    f.setVisible(true);f.tick('crank');expect(f.calls).toHaveLength(1);
    expect(f.hints.needs('crank')).toBe(true);expect(f.anchor.enabled).toBe(true);
  });
  it('holds the one-shot pose without a timed disappearance or animation loop',()=>{
    const f=fixture();f.start();f.setTime(2);f.tick('fit');
    expect(f.clips.rotate.playbackMode).toBe(0);expect(f.removed).toEqual(['official-fade-handler']);
    f.finishAnimation();f.setTime(100);f.tick('fit');
    expect(f.anchor.enabled).toBe(true);expect(f.hints.snapshot().holding).toBe(true);
    expect(f.calls).toHaveLength(1);expect(f.hints.needs('fit')).toBe(true);
    f.tick(null);expect(f.anchor.enabled).toBe(false);expect(f.disabled).toEqual(['rotate']);
    f.tick('fit');expect(f.calls).toHaveLength(2);
  });
  it('hides offscreen or on a changed target and re-offers an unfinished gesture',()=>{
    const f=fixture();f.start();f.setTime(2);f.tick('draw');expect(f.calls).toHaveLength(1);
    f.setVisible(false);f.tick('draw');expect(f.anchor.enabled).toBe(false);
    f.setVisible(true);f.tick('draw');expect(f.calls).toHaveLength(2);
    f.tick('mount');f.tick('draw');expect(f.calls).toHaveLength(4);
    f.tick('draw');expect(f.calls).toHaveLength(4);
  });
  it('permanently dismisses only a completed gesture, for every supported verb',()=>{
    for(const kind of ['crank','draw','fit','mount','obstacle','obstacleSize']){
      const f=fixture();f.start();f.setTime(2);f.tick(kind);expect(f.calls).toHaveLength(1);
      f.hints.complete(kind);expect(f.anchor.enabled).toBe(false);expect(f.hints.needs(kind)).toBe(false);
      f.tick(null);f.setTime(100);f.tick(kind);f.setVisible(false);f.tick(kind);f.setVisible(true);f.tick(kind);
      expect(f.calls).toHaveLength(1);expect(f.hints.snapshot().completed).toContain(kind);
    }
  });
});
