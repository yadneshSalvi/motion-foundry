import {findSceneObjectByName,sleep} from "Leaf.lspkg/Utils/common/Utils";
import {findComponentsWithCollider} from "Leaf.lspkg/Interactors/InteractableUtils";
import {Interactable} from "SpectaclesInteractionKit.lspkg/Components/Interaction/Interactable/Interactable";
import {Button} from "SpectaclesUIKit.lspkg/Scripts/Components/Button/Button";
import {MotionFoundry} from "../MotionFoundry";
import {LoopController} from "../LoopController";
export type WorkbenchSnapshot=ReturnType<LoopController["getStateSnapshot"]>;

export function workbench(){
  const root=findSceneObjectByName("Motion Foundry workbench");
  if(!root)throw Error("Motion Foundry workbench is missing");
  const host=root.getParent()?.getComponent(MotionFoundry.getTypeName()) as MotionFoundry;
  if(!host)throw Error("MotionFoundry host is missing");
  return{root,host};
}
export function snapshot():WorkbenchSnapshot{
  const state=workbench().host.getStateSnapshot();
  if(!("mode" in state)||state.mode!=="loop")throw Error("The native workbench is not active");
  return state as WorkbenchSnapshot;
}
export function namedTarget(name:string){
  const object=findSceneObjectByName(name,workbench().root);
  const target=object?.getComponent(Interactable.getTypeName()) as Interactable;
  if(!object||!target||!target.enabled||!object.isEnabledInHierarchy)throw Error("Active target not found: "+name);
  return target;
}
export function actionTarget(id:string){
  const state=snapshot(),index=state.actions.findIndex(action=>action.id===id);
  if(index<0)throw Error("Action unavailable: "+id+" in "+state.uiPage);
  const slot=state.actions.length===1?"middle":["left","middle","right"][index];
  const root=findSceneObjectByName("Workbench action "+slot,workbench().root);
  if(!root)throw Error("Workbench action slot is missing");
  const button=findComponentsWithCollider<Button>(root,Button.getTypeName())[0];
  if(!button)throw Error("Active UIKit button is missing in "+slot);
  return button.interactable;
}
export async function action(interactor:{trigger(target:Interactable):Promise<void>},id:string){await interactor.trigger(actionTarget(id));await sleep(180);}
export async function waitForResult(timeoutSeconds=32,alive=()=>{}){
  const end=getTime()+timeoutSeconds;
  while(snapshot().solving&&getTime()<end){alive();await sleep(150);}
  alive();
  if(snapshot().solving)throw Error("Synthesis did not finish within the test deadline");
  return snapshot();
}
/** Fresh Preview is an explicit precondition: never replace a user's sketch to reset QA. */
export async function reference(_interactor:{trigger(target:Interactable):Promise<void>}){
  const state=snapshot();
  if(state.revision!==0||state.drawMode!=="none"||state.solving||state.sharing||state.historyLength!==0||state.uiPage!=="idle")
    throw Error("Start a fresh Preview before this scenario; it preserves user work and never installs a fixture");
}
/** Undo remains available via the actual depth-two controls after its chip expires. */
export async function undo(interactor:{trigger(target:Interactable):Promise<void>}){
  if(snapshot().uiPage!=="tools"){
    if(snapshot().uiPage!=="more")await action(interactor,"more");
    await action(interactor,"tools");
  }
  await action(interactor,"undo");
}
export function boardPoint(x:number,y:number,z=.1){
  const assembly=findSceneObjectByName("Tabletop linkage",workbench().root);
  if(!assembly)throw Error("Tabletop linkage is missing");
  return assembly.getTransform().getWorldTransform().multiplyPoint(new vec3(x,y,z));
}
export function evidence(step:string,data:unknown){print("[MotionFoundry LEAF] "+JSON.stringify({step,data}));}

/** Read-only scheduling receipt for video-only capture; never plays or changes audio. */
export function observeProductAudio(owner:BaseScriptComponent,stamp:(event:string,detail:unknown)=>void){
  const read=()=>workbench().host.getAudioSchedulingSnapshot();
  let previous=read(),active=true;
  const update=owner.createEvent("UpdateEvent"),destroy=owner.createEvent("OnDestroyEvent");
  const stop=()=>{
    if(!active)return;
    active=false;owner.removeEvent(update);owner.removeEvent(destroy);
  };
  update.bind(()=>{
    if(!active)return;
    const current=read();
    const deltas={tick:current.tick-previous.tick,contact:current.contact-previous.contact,clear:current.clear-previous.clear};
    previous=current;
    if(deltas.tick>0||deltas.contact>0||deltas.clear>0){
      stamp("product-audio-cue",{deltas,counters:{tick:current.tick,contact:current.contact,clear:current.clear},wallEpochMs:Date.now(),runtimeSeconds:getTime(),scope:"Observed product scheduling counters; not a microphone recording"});
    }
  });
  destroy.bind(stop);
  return stop;
}

/** Pinch a radial side of the 1.6 cm knob away from the actual drawing.
 * Both choices have the knob's exact crank angle, preserving the real angular drag. */
export function crankContactPoint(x:number,y:number,z:number){
  const stroke=snapshot().input.stroke,length=Math.hypot(x,y);
  if(length<.8)throw Error("Crank contact needs a nondegenerate radius");
  const ux=x/length,uy=y/length;
  const clearance=(sign:number)=>{
    const cx=x+sign*.65*ux,cy=y+sign*.65*uy;let best=Infinity;
    for(const p of stroke)best=Math.min(best,Math.hypot(cx-p.x,cy-p.y));
    return best;
  };
  const sign=clearance(1)>=clearance(-1)?1:-1;
  return boardPoint(x+sign*.65*ux,y+sign*.65*uy,z);
}
