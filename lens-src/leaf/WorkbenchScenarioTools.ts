import {findSceneObjectByName,sleep} from "Leaf.lspkg/Utils/common/Utils";
import {findComponentsWithCollider} from "Leaf.lspkg/Interactors/InteractableUtils";
import {DefaultLeafInteractor} from "Leaf.lspkg/Interactors/interactor/DefaultLeafInteractor";
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
  if(state.mode!=="loop")throw Error("The native workbench is not active");
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
export async function action(interactor:DefaultLeafInteractor,id:string){await interactor.trigger(actionTarget(id));await sleep(180);}
export async function waitForResult(timeoutSeconds=32){
  const end=getTime()+timeoutSeconds;
  while(snapshot().solving&&getTime()<end)await sleep(150);
  if(snapshot().solving)throw Error("Synthesis did not finish within the test deadline");
  return snapshot();
}
/** Reset through the actual controls. Scenarios do not replace the controller state. */
export async function reference(interactor:DefaultLeafInteractor){
  for(let i=0;i<12;i++){
    const state=snapshot(),has=(id:string)=>state.actions.some(a=>a.id===id);
    if(has("reference")){await action(interactor,"reference");return;}
    if(state.drawMode==="capturing")throw Error("Finish the active user stroke before running LEAF");
    if(has("place:cancel")){await action(interactor,"place:cancel");continue;}
    if(has("cancel")){await action(interactor,"cancel");continue;}
    if(state.drawMode!=="none"){await action(interactor,"done");continue;}
    if(state.uiPage==="idle"){await interactor.trigger(namedTarget("Workbench crank knob"));continue;}
    if(has("about")){await action(interactor,"about");continue;}
    if(has("extras")){await action(interactor,"extras");continue;}
    if(has("tools")){await action(interactor,"tools");continue;}
    if(has("more")){await action(interactor,"more");continue;}
    if(has("back")){await action(interactor,"back");continue;}
    throw Error("Cannot reach Reference from "+state.uiPage);
  }
  throw Error("Reference navigation exceeded its bound");
}
export function boardPoint(x:number,y:number,z=.1){
  const assembly=findSceneObjectByName("Tabletop linkage",workbench().root);
  if(!assembly)throw Error("Tabletop linkage is missing");
  return assembly.getTransform().getWorldTransform().multiplyPoint(new vec3(x,y,z));
}
export function evidence(step:string,data:unknown){print("[MotionFoundry LEAF] "+JSON.stringify({step,data}));}
