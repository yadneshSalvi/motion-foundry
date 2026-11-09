import {readFileSync} from 'node:fs';
import {stripTypeScriptTypes} from 'node:module';
import {runInNewContext} from 'node:vm';
import {describe,expect,it} from 'vitest';
import {makeWorkbenchReference,WORKBENCH_KEEP_OUT} from '../../lens-src/WorkbenchProfile';
import {buildLoopInputHash,verifyLoopCandidate} from '../../lens-src/LoopDomain';
import {withWorkbenchObstacle,WORKBENCH_PRESENTATION} from '../../lens-src/WorkbenchPresentation';

// Executes the real controller methods behind a minimal native boundary. Native
// SIK/WorldQuery execution remains a separate LEAF acceptance gate.
const transformNative=stripTypeScriptTypes as unknown as (s:string,o:{mode:'transform'})=>string;
const source=readFileSync(new URL('../../lens-src/LoopController.ts',import.meta.url),'utf8');
const code=transformNative(source.replace(/^import .*;$/gm,'').replace('export class LoopController','class LoopController'),{mode:'transform'})+'\nexports.Controller=LoopController;';
function fixture(playing=true){
  let hashes=0,now=10;
  const exports:Record<string,any>={};
  runInNewContext(code,{exports,getTime:()=>now,WORKBENCH_PRESENTATION,WORKBENCH_KEEP_OUT,withWorkbenchObstacle,verifyLoopCandidate,buildLoopInputHash:(input:Parameters<typeof buildLoopInputHash>[0])=>{hashes++;return buildLoopInputHash(input);}});
  const reference=makeWorkbenchReference(),c=Object.create(exports.Controller.prototype);
  const placement={mode:'manual',begin(){this.mode='placing';},cancel(){this.mode='manual';},canCancel:()=>true,hasHit:()=>false};
  Object.assign(c,{playing,page:'result',firstUse:true,drawMode:'none',cranking:false,editSession:null,sharing:false,solving:false,
    generation:0,shareGeneration:0,beforePlacement:null,history:[],input:reference.input,candidate:reference.candidate,audit:reference.candidate.verification,
    inputVersion:0,hashVersion:-1,cachedInputHash:'',placement,exportCard:{hide(){},isVisible:()=>false},refresh(){},persistDesign(){},
    handles:{},hints:{complete(){}},audio:{play(){}},candidates:[reference.candidate],undoContext:null,
    assembly:{configure(){},resetInk(){},worldPoint:(point:{x:number;y:number},height:number)=>({...point,z:height}),fitCenter:{x:21,y:-6.5}}});
  return{c,get hashes(){return hashes;},setTime:(v:number)=>{now=v;},controls:()=>{
    let state:any;c.ui={setState:(value:unknown)=>{state=value;}};c.refresh=exports.Controller.prototype.refresh.bind(c);c.refresh();return state;
  }};
}
describe('native controller recovery and cache',()=>{
  it('restores the exact previous play state silently when Place is cancelled',()=>{
    for(const playing of [true,false]){
      const {c}=fixture(playing);c.action('more');c.action('place');
      expect(c.playing).toBe(false);expect(c.placement.mode).toBe('placing');expect(c.firstUse).toBe(true);
      c.action('place:cancel');expect(c.playing).toBe(playing);expect(c.page).toBe('result');
      expect(c.message).toBe('');expect(c.firstUse).toBe(true);
    }
  });
  it('keeps the crank hint through menus, Save and cancelled placement',()=>{
    const {c}=fixture();
    for(const action of ['more','tools','back','back','export','back','more','place','place:cancel']){
      c.action(action);expect(c.firstUse).toBe(true);
    }
    expect(c.page).toBe('result');
  });
  it('shows the draw lesson when armed, then removes competing hints throughout the actual stroke',()=>{
    const {c}=fixture();c.labels={getBand:()=>"middle"};c.hover="crank";
    expect(c.requestedHint(false)).toBe('crank');
    c.drawMode='armed';expect(c.requestedHint(false)).toBe('draw');
    for(const mode of ['capturing','open']){c.drawMode=mode;expect(c.requestedHint(false)).toBeNull();}
    expect(c.firstUse).toBe(true);c.drawMode='none';expect(c.requestedHint(false)).toBe('crank');
    c.cranking=true;expect(c.requestedHint(false)).toBeNull();
  });
  it('keeps Send available before a tag or on failure, but removes the redundant action beside a ready QR',()=>{
    const f=fixture();f.c.page='share';
    expect(f.controls().actions.map((a:{id:string})=>a.id)).toEqual(['send','back']);
    f.c.exportCard.isVisible=()=>true;
    expect(f.controls().actions.map((a:{id:string})=>a.id)).toEqual(['back']);
    f.c.exportCard.isVisible=()=>false;
    expect(f.controls().actions.map((a:{id:string})=>a.id)).toEqual(['send','back']);
  });
  it('does not expose a cancel that can bypass first device placement',()=>{
    const {c}=fixture();c.placement.canCancel=()=>false;c.action('place');
    c.action('place:cancel');expect(c.placement.mode).toBe('placing');expect(c.playing).toBe(false);
  });
  it('computes a hash once per actual input change rather than on each playback frame',()=>{
    const f=fixture();for(let i=0;i<100;i++)expect(f.c.isFresh()).toBe(true);expect(f.hashes).toBe(1);
    f.c.input.tolerances.fitCm=.25;f.c.touchInput();
    expect(f.c.isFresh()).toBe(false);expect(f.hashes).toBe(2);
    for(let i=0;i<100;i++)f.c.isFresh();expect(f.hashes).toBe(2);
  });
  it('keeps Undo attached to the latest edited part after time and menu changes, then restores the exact input',()=>{
    const f=fixture(),c=f.c,before={input:structuredClone(c.input),candidate:c.candidate,candidates:c.candidates,source:'Bundled reference',receipt:''};
    c.history.push(before);c.input.fixedMounts.groundCm=17;c.input.revision++;c.touchInput();
    c.editSession={kind:'mount',changed:true,before};c.endEdit(false);
    f.setTime(3600);
    const state=f.controls();
    expect(state.undo).toEqual({anchor:{x:17,y:0,z:.7},label:'Undo\nmount'});
    expect(state.actions.length+1).toBeLessThanOrEqual(3);
    c.action('more');c.action('tools');expect(f.controls().actions.map((a:{id:string})=>a.id)).toContain('undo');
    c.action('back');c.action('back');expect(f.controls().undo).toEqual(state.undo);
    c.action('more');c.action('place');c.action('place:cancel');expect(f.controls().undo).toEqual(state.undo);
    c.action('undo');expect(c.input).toEqual(before.input);expect(c.undoContext).toBeNull();expect(c.isFresh()).toBe(true);
  });
  it('commits a six-hundredths-centimetre mug placement through the actual edit lifecycle without changing protected inputs',()=>{
    const {c}=fixture(),before=structuredClone(c.input),parameters=structuredClone(c.candidate.parameters);
    const start={x:-8.9,y:0,z:2};c.startEdit('obstacle',start);
    expect(c.input.obstacles[0].center).toEqual({x:-8.9,y:0});
    for(let i=1;i<=60;i++)c.moveEdit({x:start.x+i*.001,y:0,z:2});
    c.endEdit(false);
    expect(c.input.obstacles[0].center).toEqual({x:-8.84,y:0});
    expect(c.input).toEqual({...before,revision:before.revision+1,obstacles:[{...WORKBENCH_KEEP_OUT,center:{x:-8.84,y:0}}]});
    expect(c.candidate.parameters).toEqual(parameters);expect(c.history).toHaveLength(1);
    expect(c.undoContext.label).toBe('Undo\nmug');
  });
});
