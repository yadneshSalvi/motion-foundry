import {InteractionHintController,HandMode,HandAnimationsLibrary} from "3D Hints.lspkg/Scripts/InteractionHintController";
import WorldCameraFinderProvider from "SpectaclesInteractionKit.lspkg/Providers/CameraProvider/WorldCameraFinderProvider";

export type HintKind="crank"|"draw"|"fit"|"mount"|"obstacle"|"obstacleSize";

/** Official 3D Hints v2, attached to the actual object; never an input substitute. */
export class WorkbenchHints {
  private anchor:SceneObject;
  private hint:InteractionHintController;
  private player:AnimationPlayer;
  private clipName:string|null=null;
  private started=false;
  private kind:HintKind|null=null;
  private completed=new Set<HintKind>();
  private encounter:HintKind|null=null;
  private playedInEncounter=false;
  private encounteredAt=0;
  private plays:Partial<Record<HintKind,number>>={};
  private poseTimes:Partial<Record<HintKind,number>>={};
  private startAt=getTime()+1.8;
  private camera=WorldCameraFinderProvider.getInstance();
  constructor(owner:BaseScriptComponent,parent:SceneObject){
    this.anchor=global.scene.createSceneObject("Workbench first-use hand hint");this.anchor.setParent(parent);
    const prefab=requireAsset("3D Hints.lspkg/Specs3DHandHints__PLACE_IN_SCENE.prefab") as ObjectPrefab;
    const root=prefab.instantiate(this.anchor);
    const guide=this.find(root,"GUIDE_ReadAndDisable");if(guide)guide.enabled=false;
    this.hint=root.getComponent(InteractionHintController.getTypeName()) as InteractionHintController;
    if(!this.hint)throw Error("Official 3D Hints controller was not found");
    this.player=this.find(root,"HandHints")?.getComponent("AnimationPlayer") as AnimationPlayer;
    if(!this.player)throw Error("Official 3D Hints animation player was not found");
    this.hint.autoPlay=false;
    this.anchor.getTransform().setLocalScale(new vec3(.58,.58,.58));
    this.anchor.enabled=false;
    owner.createEvent("OnStartEvent").bind(()=>this.started=true);
  }
  public tick(kind:HintKind|null,point:vec3,rotation:quat){
    if(!this.started)return;
    const inView=!!kind&&this.camera.inFoV(point);
    // Animate once per continuous encounter, then keep the official pose
    // visible. Only actual success dismisses the gesture permanently.
    if(!inView||kind!==this.encounter){
      this.hide();this.encounter=inView?kind:null;this.playedInEncounter=false;this.encounteredAt=getTime();
    }
    if(!kind||!inView)return;
    const visiblePoint=point.add(this.camera.getWorldPosition().sub(point).normalize().uniformScale(2.5)).add(new vec3(0,1.5,0));
    if(this.kind){this.anchor.getTransform().setWorldPosition(visiblePoint);return;}
    if(this.completed.has(kind)||this.playedInEncounter||getTime()<this.startAt||getTime()-this.encounteredAt<.5)return;
    this.playedInEncounter=true;this.kind=kind;
    const t=this.anchor.getTransform();t.setWorldPosition(visiblePoint);t.setWorldRotation(rotation.multiply(quat.fromEulerAngles(-Math.PI/3,0,0)));
    this.anchor.enabled=true;
    const animation=kind==="crank"||kind==="fit"?HandAnimationsLibrary.Right.PinchRotateZ:HandAnimationsLibrary.Right.PinchMoveX;
    this.clipName=animation;
    const count=this.plays[kind]||0;
    if(count<3){this.hint.playHintAnimation(HandMode.Right,animation,1,1);this.plays[kind]=count+1;}
    else{
      // Initial animation plus at most two replays. Further encounters keep a
      // static official pose and text available until the actual action succeeds.
      const clip=this.player.getClip(animation),time=this.poseTimes[kind]??Math.max(clip.begin,clip.end-.05);
      this.player.setClipEnabled(animation,true);this.player.playClipAt(animation,time);this.player.forceUpdate(0);this.player.pauseClip(animation);
    }
    // The package's exposed end-event registration otherwise fades the mesh
    // before success. Use the public player API to retain a one-shot end pose;
    // package code, materials, animation assets and input remain untouched.
    this.player.getClip(this.clipName).playbackMode=PlaybackMode.Single;
    this.player.onEvent.remove(this.hint.animationPlayerClipEndEvent);
  }
  public complete(kind:HintKind){this.completed.add(kind);if(this.kind===kind)this.hide();}
  public needs(kind:HintKind){return!this.completed.has(kind);}
  public snapshot(){return{package:"3D Hints",version:"2.0.0",active:this.anchor.isEnabledInHierarchy?this.kind:null,encounter:this.encounter,playedInEncounter:this.playedInEncounter,animationPlays:{...this.plays},maxPlaysPerGesture:3,hoverDelaySeconds:.5,completed:Array.from(this.completed)};}
  private hide(){
    this.anchor.enabled=false;
    if(this.kind&&this.clipName)this.poseTimes[this.kind]=Math.max(this.poseTimes[this.kind]||0,this.player.getClipCurrentTime(this.clipName));
    this.kind=null;
    if(this.clipName){this.player.stopClip(this.clipName);this.player.setClipEnabled(this.clipName,false);this.clipName=null;}
  }
  private find(root:SceneObject,name:string):SceneObject|null{
    if(root.name===name)return root;
    for(let i=0;i<root.getChildrenCount();i++){const found=this.find(root.getChild(i),name);if(found)return found;}
    return null;
  }
}
