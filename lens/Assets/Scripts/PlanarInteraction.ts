import {Interactable} from "SpectaclesInteractionKit.lspkg/Components/Interaction/Interactable/Interactable";
import {InteractableAudioFeedback} from "SpectaclesInteractionKit.lspkg/Components/Helpers/InteractableAudioFeedback";
import {Interactor,TargetingMode} from "SpectaclesInteractionKit.lspkg/Core/Interactor/Interactor";
import {InteractorEvent} from "SpectaclesInteractionKit.lspkg/Core/Interactor/InteractorEvent";
import Event from "SpectaclesInteractionKit.lspkg/Utils/Event";
import {intersectBoardRay} from "./WorkbenchGeometry";

/** Standard SIK pinch/drag, projected onto the real workbench plane for near and far input. */
@component
export class PlanarInteraction extends BaseScriptComponent {
  public readonly onStart=new Event<vec3>();
  public readonly onMove=new Event<vec3>();
  public readonly onEnd=new Event<boolean>();
  public readonly onHover=new Event<boolean>();
  public plane:SceneObject;
  public planeHeight=0;
  public allowed=true;
  private interactable:Interactable;
  private current:Interactor|null=null;
  private dragging=false;

  onAwake(){
    this.interactable=this.sceneObject.createComponent(Interactable.getTypeName()) as Interactable;
    this.interactable.targetingMode=3;
    this.interactable.enableInstantDrag=true;
    this.interactable.allowMultipleInteractors=false;
    const audio=this.sceneObject.createComponent(InteractableAudioFeedback.getTypeName()) as InteractableAudioFeedback;
    audio.playAudioOnHover=false;
    audio.playAudioOnTriggerStart=true;
    audio.playAudioOnTriggerEnd=true;
    this.createEvent("OnStartEvent").bind(()=>{
      this.interactable.onHoverEnter.add(()=>this.onHover.invoke(true));
      this.interactable.onHoverExit.add(()=>this.onHover.invoke(false));
      this.interactable.onTriggerStart.add(e=>this.start(e));
      this.interactable.onTriggerUpdate.add(e=>this.move(e));
      // Trigger end handles even a click too short to become a drag. One SIK path only.
      this.interactable.onTriggerEnd.add(()=>this.finish(false));
      this.interactable.onTriggerEndOutside.add(()=>this.finish(false));
      this.interactable.onTriggerCanceled.add(()=>this.finish(true));
      this.interactable.enabled=this.allowed;
    });
  }
  public setAllowed(value:boolean){
    this.allowed=value;
    if(!value&&this.dragging)this.finish(true);
    // Runtime-created script components can receive configuration before onAwake.
    if(this.interactable&&this.interactable.enabled!==value)this.interactable.enabled=value;
  }
  private point(interactor:Interactor):vec3|null {
    if(!this.plane)return null;
    const inverse=this.plane.getTransform().getInvertedWorldTransform();
    const start=interactor.startPoint;
    if(!start)return null;
    const a=inverse.multiplyPoint(start);
    // Direct input follows the real pinch position; indirect input intersects its ray.
    if(interactor.activeTargetingMode===TargetingMode.Direct)return new vec3(a.x,a.y,this.planeHeight);
    const direction=interactor.direction;
    if(!direction)return null;
    const b=inverse.multiplyPoint(start.add(direction));
    const q=intersectBoardRay(a,b.sub(a),this.planeHeight);
    return q?new vec3(q.x,q.y,q.z):null;
  }
  private start(event:InteractorEvent){
    if(!this.allowed||this.dragging)return;
    const point=this.point(event.interactor);
    if(!point)return;
    event.stopPropagation();
    this.current=event.interactor;this.dragging=true;this.onStart.invoke(point);
  }
  private move(event:InteractorEvent){
    if(!this.dragging||event.interactor!==this.current)return;
    event.stopPropagation();
    const point=this.point(event.interactor);
    if(point)this.onMove.invoke(point);
  }
  private finish(cancelled:boolean){
    if(!this.dragging)return;
    this.dragging=false;this.current=null;this.onEnd.invoke(cancelled);
  }
}
