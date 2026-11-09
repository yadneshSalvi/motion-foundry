import {rotationData} from "../WorkbenchLayout";
import {LeafSingleHandInteractor} from "Leaf.lspkg/Interactors/interactor/handInput/LeafHandInteractor";
import {nextFrame,sleep} from "Leaf.lspkg/Utils/common/Utils";
import {Interactable} from "SpectaclesInteractionKit.lspkg/Components/Interaction/Interactable/Interactable";
import {VERTICAL_HAND_ROTATION} from "Leaf.lspkg/Interactors/interactor/handInput/Gestures";
import WorldCameraFinderProvider from "SpectaclesInteractionKit.lspkg/Providers/CameraProvider/WorldCameraFinderProvider";
import {boardPoint,crankContactPoint,snapshot} from "./WorkbenchScenarioTools";
import {visibleClosedPath} from "./WorkbenchDrawPath";

/** Installed BaseLeafInteractor's protected test-input channel; never product state. */
interface PathChannel {
  overrideInteractable?:Interactable; overrideDragVector?:vec3;
  startPoint:vec3; endPoint:vec3; resetStartEndPoint():void;
}
/**
 * The installed SDK explicitly permits directly constructed domain subclasses.
 * Own one wrapper per scenario: its shared singleton survives SDK cleanup even
 * though that cleanup has destroyed the singleton's tracked-hand wrapper.
 */
class WorkbenchScenarioHand extends LeafSingleHandInteractor {
  private released=false;
  constructor(){super("right");}
  protected destroy(){if(this.released)return;this.released=true;super.destroy();}
  public dispose(){this.destroy();}
  public get disposed(){return this.released;}
}
/** Visible SIK hand, oriented from lower right, anchored at its actual pinch midpoint. */
export class WorkbenchPathInteractor {
  readonly shared=new WorkbenchScenarioHand();
  private direction=new vec3(0,1,0);
  private activeTarget:Interactable|undefined;
  private readonly camera=WorldCameraFinderProvider.getInstance();
  constructor(_name?:string){}
  private get channel(){return this.shared as unknown as PathChannel;}
  private offset(){
    const hand=this.shared.hand;
    return hand.wrist.position.sub(hand.indexTip.position.add(hand.thumbTip.position).uniformScale(.5));
  }
  private async move(point:vec3,durationMs=0){
    this.channel.startPoint=point;this.channel.endPoint=point.add(this.direction.uniformScale(.1));
    await this.shared.hand.setPosition(point.add(this.offset()),durationMs);
  }
  private async pose(point:vec3,pinch:boolean,alive:()=>void,target?:Interactable){
    if(pinch&&target?.getSceneObject().name==="Workbench crank knob"){
      await this.crankPose(target,alive);return;
    }
    if(pinch&&target?.getSceneObject().name==="Workbench drawing surface"){
      await this.drawingPose(point,alive);return;
    }
    if(pinch&&target?.getSceneObject().name==="Workbench movable mount"){
      await this.mountPose(point,alive);return;
    }
    const hand=this.shared.hand,q0=VERTICAL_HAND_ROTATION.right;
    // Camera basis gives an approach from the viewer's lower right at any board pose.
    const away=point.sub(this.camera.getWorldPosition()).normalize();
    this.direction=this.camera.right().uniformScale(-.18).add(this.camera.up().uniformScale(.95)).add(away.uniformScale(.25)).normalize();
    await hand.makeGesture("relaxed",undefined,120);alive();
    await hand.setRotation(q0,150);alive();
    const d0=hand.middleKnuckle.position.sub(hand.wrist.position).normalize();
    const aim=quat.rotationFromTo(d0,this.direction).multiply(q0);
    await hand.setRotation(aim,150);alive();
    // Keep the accepted approach direction, but expose the thumb/index side
    // instead of the broad back of the hand. Use the measured palm's radial axis
    // and the actual camera; an arbitrary world-axis roll is viewpoint dependent.
    const perpendicular=(v:vec3)=>v.sub(this.direction.uniformScale(v.dot(this.direction)));
    const radial=perpendicular(hand.indexKnuckle.position.sub(hand.pinkyKnuckle.position));
    const towardCamera=perpendicular(this.camera.getWorldPosition().sub(point));
    if(radial.length<1e-4||towardCamera.length<1e-4)throw Error("Cannot establish a readable hand side pose");
    const a=radial.normalize(),b=towardCamera.normalize();
    const roll=Math.atan2(this.direction.dot(a.cross(b)),a.dot(b));
    await hand.setRotation(quat.angleAxis(roll,this.direction).multiply(aim),150);alive();
    print("[Motion hand pose] "+JSON.stringify({rollRad:roll,approach:{x:this.direction.x,y:this.direction.y,z:this.direction.z},view:"thumb-index-side"}));
    await this.move(point,150);alive();
    if(pinch){await hand.makeGesture("pinch",undefined,120);alive();await this.move(point);}
  }
  /** Keep the exact ordered outline, but begin at its visible low point. A
   * right-side writing hand then leaves the first earned stroke exposed to its
   * left, rather than beginning above a trail concealed under the fingers. */
  visibleClosedDrawing(points:vec3[]){
    const chosen=visibleClosedPath(points,p=>{const s=this.camera.worldSpaceToScreenSpace(p.x,p.y,p.z);return{x:s.x,y:s.y};});
    print("[Motion drawing path] "+JSON.stringify({startIndex:chosen.startIndex,uniquePoints:points.length-1,
      scope:"Cyclic start only; same coordinates, scale, ordered edges and explicit closure"}));
    return chosen.points;
  }
  /** Separate writing pose: calibrate the actual closed pinch and keep the wrist
   * to screen right. The actual fingertip midpoint still follows the board path;
   * no drawing, phase, or product handler is assigned by this driver. */
  private async drawingPose(point:vec3,alive:()=>void){
    const hand=this.shared.hand,q0=VERTICAL_HAND_ROTATION.right;
    const away=point.sub(this.camera.getWorldPosition()).normalize();
    this.direction=this.camera.right().uniformScale(-.9).add(this.camera.up().uniformScale(.35)).add(away.uniformScale(.1)).normalize();
    // All calibration begins at the SDK's hidden/rest position. The visible
    // approach ends in the useful close gesture on the real drawing plane.
    await hand.makeGesture("pinch",undefined,120);alive();
    await hand.setRotation(q0,150);await nextFrame();alive();
    const midpoint=()=>hand.indexTip.position.add(hand.thumbTip.position).uniformScale(.5);
    const axis=()=>midpoint().sub(hand.wrist.position).normalize();
    const aim=quat.rotationFromTo(axis(),this.direction).multiply(q0);
    await hand.setRotation(aim,150);await nextFrame();alive();
    const perpendicular=(v:vec3)=>v.sub(this.direction.uniformScale(v.dot(this.direction)));
    const radial=perpendicular(hand.indexKnuckle.position.sub(hand.pinkyKnuckle.position));
    const view=perpendicular(this.camera.getWorldPosition().sub(point));
    if(radial.length<1e-4||view.length<1e-4)throw Error("Cannot establish a writing pinch pose");
    const a=radial.normalize(),b=view.normalize(),roll=Math.atan2(this.direction.dot(a.cross(b)),a.dot(b));
    let orientation=quat.angleAxis(roll,this.direction).multiply(aim);
    await hand.setRotation(orientation,150);await nextFrame();alive();
    await hand.makeGesture("relaxed",undefined,120);alive();await this.move(point,150);alive();
    let closing=true;const close=hand.makeGesture("pinch",undefined,180).finally(()=>{closing=false;});
    while(closing){alive();await this.move(point);await nextFrame();}
    await close;await nextFrame();await this.move(point);await nextFrame();
    for(let attempt=0;attempt<2;attempt++){
      const measured=axis();if(measured.dot(this.direction)>=.999)break;
      orientation=quat.rotationFromTo(measured,this.direction).multiply(orientation);
      let rotating=true;const correction=hand.setRotation(orientation,100).finally(()=>{rotating=false;});
      while(rotating){alive();await this.move(point);await nextFrame();}
      await correction;await nextFrame();await this.move(point);await nextFrame();
    }
    const error=midpoint().distance(point),alignment=axis().dot(this.direction),right=hand.wrist.position.sub(midpoint()).dot(this.camera.right());
    const result={pinchAnchorErrorCm:error,axisAlignment:alignment,wristRightCm:right,
      scope:"Actual closed-pinch calibration; native captured trail visibility is a separate acceptance gate"};
    print("[Motion drawing pose measured] "+JSON.stringify(result));
    if(error>.005||alignment<.999||right<6)throw Error("Writing hand must remain anchored and to the right: "+JSON.stringify(result));
  }
  /** Mount-only test pose. A measured closed pinch comes from lower right, with
   * the spare fingers rolled below the live readout. The recorded013 joint
   * envelope and actual label policy were replayed to select this pose; native
   * captured pixels and the unchanged held-value assertion remain mandatory. */
  private async mountPose(point:vec3,alive:()=>void){
    const hand=this.shared.hand,q0=VERTICAL_HAND_ROTATION.right;
    const away=point.sub(this.camera.getWorldPosition()).normalize();
    this.direction=this.camera.right().uniformScale(-.9).add(this.camera.up().uniformScale(.35)).add(away.uniformScale(.1)).normalize();
    await hand.makeGesture("pinch",undefined,120);alive();
    await hand.setRotation(q0,150);await nextFrame();alive();
    const midpoint=()=>hand.indexTip.position.add(hand.thumbTip.position).uniformScale(.5);
    const axis=()=>midpoint().sub(hand.wrist.position).normalize();
    const aim=quat.rotationFromTo(axis(),this.direction).multiply(q0);
    await hand.setRotation(aim,150);await nextFrame();alive();
    const perpendicular=(v:vec3)=>v.sub(this.direction.uniformScale(v.dot(this.direction)));
    const radial=perpendicular(hand.indexKnuckle.position.sub(hand.pinkyKnuckle.position));
    const view=perpendicular(this.camera.getWorldPosition().sub(point));
    if(radial.length<1e-4||view.length<1e-4)throw Error("Cannot establish a mount pinch pose");
    const a=radial.normalize(),b=view.normalize();
    const roll=Math.atan2(this.direction.dot(a.cross(b)),a.dot(b))+3*Math.PI/4;
    let orientation=quat.angleAxis(roll,this.direction).multiply(aim);
    await hand.setRotation(orientation,150);await nextFrame();alive();
    await hand.makeGesture("relaxed",undefined,120);alive();await this.move(point,150);alive();
    let closing=true;const close=hand.makeGesture("pinch",undefined,180).finally(()=>{closing=false;});
    while(closing){alive();await this.move(point);await nextFrame();}
    await close;await nextFrame();await this.move(point);await nextFrame();
    for(let attempt=0;attempt<2;attempt++){
      const measured=axis();if(measured.dot(this.direction)>=.999)break;
      orientation=quat.rotationFromTo(measured,this.direction).multiply(orientation);
      let rotating=true;const correction=hand.setRotation(orientation,100).finally(()=>{rotating=false;});
      while(rotating){alive();await this.move(point);await nextFrame();}
      await correction;await nextFrame();await this.move(point);await nextFrame();
    }
    const error=midpoint().distance(point),alignment=axis().dot(this.direction),right=hand.wrist.position.sub(midpoint()).dot(this.camera.right());
    const wrist=this.camera.worldSpaceToScreenSpace(hand.wrist.position.x,hand.wrist.position.y,hand.wrist.position.z);
    const target=this.camera.worldSpaceToScreenSpace(point.x,point.y,point.z);
    const result={pinchAnchorErrorCm:error,axisAlignment:alignment,wristRightCm:right,rollOffsetDegrees:135,
      wristScreen:{x:wrist.x,y:wrist.y},targetScreen:{x:target.x,y:target.y},
      scope:"Only the movable-mount test hand changes. Captured pinch, live value and unchanged product exclusions must pass separately."};
    print("[Motion mount pose measured] "+JSON.stringify(result));
    if(error>.005||alignment<.999||right<6||wrist.y<=target.y)
      throw Error("Mount hand must stay anchored below-right of the actual part: "+JSON.stringify(result));
  }
  /** Aim the actual closed pinch, not the relaxed knuckle axis. The wrist stays
   * outboard of the drawing while the measured thumb/index midpoint remains on
   * the visible knob. This changes only the test hand, never the mechanism. */
  private async crankPose(target:Interactable,alive:()=>void){
    const hand=this.shared.hand,q0=VERTICAL_HAND_ROTATION.right;
    const current=()=>{const p=target.getTransform().getLocalPosition();return crankContactPoint(p.x,p.y,p.z);};
    let point=current();
    const stroke=snapshot().input.stroke;
    const project=(p:vec3)=>{const s=this.camera.worldSpaceToScreenSpace(p.x,p.y,p.z);return{x:s.x,y:s.y};};
    const drawing=stroke.map(p=>project(boardPoint(p.x,p.y)));
    const drawingCenter={x:drawing.reduce((sum,p)=>sum+p.x,0)/drawing.length,
      y:drawing.reduce((sum,p)=>sum+p.y,0)/drawing.length};
    // The grip moves around the pivot during both approach and the real turn.
    // Choose one screen-outboard side from the fixed pivot, never from an old
    // grip phase. Otherwise the wrist can switch to the drawing's side before
    // selection and remain there for the whole arc even with an exact pinch.
    const pivot=project(boardPoint(0,0,target.getTransform().getLocalPosition().z));
    const side=drawingCenter.x>=pivot.x?1:-1;
    const away=point.sub(this.camera.getWorldPosition()).normalize();
    this.direction=this.camera.right().uniformScale(.65*side)
      .add(this.camera.up().uniformScale(.75)).add(away.uniformScale(.15)).normalize();
    await hand.makeGesture("pinch",undefined,120);alive();
    await hand.setRotation(q0,150);alive();
    const pinchAxis=hand.indexTip.position.add(hand.thumbTip.position).uniformScale(.5).sub(hand.wrist.position).normalize();
    const aim=quat.rotationFromTo(pinchAxis,this.direction).multiply(q0);
    await hand.setRotation(aim,150);await nextFrame();alive();
    const perpendicular=(v:vec3)=>v.sub(this.direction.uniformScale(v.dot(this.direction)));
    const radial=perpendicular(hand.indexKnuckle.position.sub(hand.pinkyKnuckle.position));
    const view=perpendicular(this.camera.getWorldPosition().sub(point));
    if(radial.length<1e-4||view.length<1e-4)throw Error("Cannot establish an outboard pinch pose");
    const a=radial.normalize(),b=view.normalize();
    const roll=Math.atan2(this.direction.dot(a.cross(b)),a.dot(b));
    let orientation=quat.angleAxis(roll,this.direction).multiply(aim);
    await hand.setRotation(orientation,150);await nextFrame();alive();
    // Show the useful close gesture at the target, anchoring its real midpoint
    // throughout the finger animation rather than shifting the target afterward.
    await hand.makeGesture("relaxed",undefined,120);alive();await this.move(point=current(),150);alive();
    let closing=true;
    const close=hand.makeGesture("pinch",undefined,180).finally(()=>{closing=false;});
    while(closing){alive();await this.move(point=current());await nextFrame();}
    await close;await nextFrame();await this.move(point=current());await nextFrame();alive();
    // The final pinch changes the skeleton's wrist-to-midpoint axis. Correct the
    // measured closed pose, while continuously following the real moving knob.
    // No mechanism phase/playing property is changed to make this approach work.
    for(let attempt=0;attempt<2;attempt++){
      const measured=hand.indexTip.position.add(hand.thumbTip.position).uniformScale(.5).sub(hand.wrist.position).normalize();
      if(measured.dot(this.direction)>=.999)break;
      orientation=quat.rotationFromTo(measured,this.direction).multiply(orientation);
      let rotating=true;
      const correction=hand.setRotation(orientation,100).finally(()=>{rotating=false;});
      while(rotating){alive();await this.move(point=current());await nextFrame();}
      await correction;await nextFrame();await this.move(point=current());await nextFrame();
    }
    const actual=hand.indexTip.position.add(hand.thumbTip.position).uniformScale(.5);
    const axis=actual.sub(hand.wrist.position).normalize();
    const error=actual.distance(point),outboard=hand.wrist.position.sub(actual).dot(this.camera.right())*side;
    const diagnostic={pinchAnchorErrorCm:error,axisAlignment:axis.dot(this.direction),wristOutboardCm:-outboard,
      desiredAxis:{x:this.direction.x,y:this.direction.y,z:this.direction.z},actualAxis:{x:axis.x,y:axis.y,z:axis.z},
      pinch:{x:actual.x,y:actual.y,z:actual.z},target:{x:point.x,y:point.y,z:point.z},visibleKnobDistanceCm:actual.distance(target.getTransform().getWorldPosition()),
      screenSideBasis:{pivot,drawingCenter,side:side>0?"wrist-left":"wrist-right",scope:"Fixed pivot side for the entire turn; captured mesh visibility remains a separate gate"}};
    print("[Motion crank pose measured] "+JSON.stringify(diagnostic));
    if(error>.005||axis.dot(this.direction)<.999||outboard>=0)throw Error("Crank hand must retain its exact outboard pinch anchor: "+JSON.stringify(diagnostic));
    print("[Motion hand pose] "+JSON.stringify({kind:"crank-outboard-pinch",rollRad:roll,
      approach:{x:this.direction.x,y:this.direction.y,z:this.direction.z},outboardSide:side>0?"left":"right",
      pinchAnchorErrorCm:error,wristOutboardCm:-outboard,scope:"Native visual acceptance still required"}));
  }
  private async until(test:()=>boolean,label:string,alive:()=>void){
    const deadline=getTime()+2;
    while(!test()){alive();if(getTime()>deadline)throw Error("SIK hand input timeout: "+label);await nextFrame();}
  }
  async trigger(target:Interactable){
    let started=false,ended=false;
    const off=[target.onTriggerStart.add(()=>{started=true;}),target.onTriggerEnd.add(()=>{ended=true;})];
    try{
      await this.pose(target.getTransform().getWorldPosition(),true,()=>{},target);
      this.channel.overrideInteractable=target;await nextFrame();await nextFrame();
      this.activeTarget=target;this.shared.startSelecting();await this.until(()=>started,"trigger start",()=>{});
      this.projectionReceipt("trigger",target);
      await sleep(120);this.projectionReceipt("hold",target);this.shared.stopSelecting();await this.until(()=>ended,"trigger end",()=>{});this.projectionReceipt("release",target);
    }finally{off.forEach(f=>f());await this.retreat();}
  }
  async hover(target:Interactable,durationMs=300){
    if(durationMs<0||durationMs>5000)throw Error("Bounded hover duration required");
    try{
      await this.pose(target.getTransform().getWorldPosition(),false,()=>{},target);
      this.channel.overrideInteractable=target;await sleep(durationMs);
    }finally{await this.retreat();}
  }
  async drag(target:Interactable,delta:vec3,durationMs:number){
    const start=target.getTransform().getWorldPosition();
    await this.followTimedPath(target,[start,start.add(delta)],durationMs,()=>{});
  }
  async followPath(target:Interactable,points:vec3[]){await this.followTimedPath(target,points,6000,()=>{});}
  async followTimedPath(target:Interactable,path:vec3[]|(()=>vec3[]),durationMs:number,alive:()=>void,atEndpoint?:()=>Promise<void>){
    const resolve=()=>typeof path==="function"?path():path;
    let points=resolve();
    if(points.length<2||durationMs<250||durationMs>30000)throw Error("A hand path needs points and a bounded real duration");
    const crank=target.getSceneObject().name==="Workbench crank knob";
    if(crank&&typeof path!=="function")throw Error("A moving crank path must be resolved at the actual grab");
    let started=false;const off=target.onTriggerStart.add(()=>{started=true;});
    try{
      await this.pose(points[0],true,alive,target);
      this.channel.overrideInteractable=target;
      for(let i=0;i<2;i++){
        if(crank){const p=target.getTransform().getLocalPosition();await this.move(crankContactPoint(p.x,p.y,p.z));}
        await nextFrame();alive();
      }
      if(crank){
        const p=target.getTransform().getLocalPosition();await this.move(crankContactPoint(p.x,p.y,p.z));
        const midpoint=this.shared.hand.indexTip.position.add(this.shared.hand.thumbTip.position).uniformScale(.5);
        const distance=midpoint.distance(target.getTransform().getWorldPosition());
        if(distance>.8)throw Error("Actual pinch must touch the visible0.8cm-radius knob: "+distance);
        print("[Motion live crank grab] "+JSON.stringify({distanceCm:distance,phase:snapshot().phase,wallEpochMs:Date.now()}));
      }
      this.activeTarget=target;this.shared.startSelecting();await this.until(()=>started,"path trigger start",alive);
      // Selection stops ordinary crank playback through the real product input.
      // Resolve from that current phase, never from the pre-approach snapshot.
      points=resolve();await this.move(points[0]);
      const lengths=[0];for(let i=1;i<points.length;i++)lengths.push(lengths[i-1]+points[i].distance(points[i-1]));
      const length=lengths[lengths.length-1];if(!(length>0))throw Error("Empty hand path");
      this.projectionReceipt("trigger",target);
      const start=getTime();let segment=1,previous=points[0],recordedHold=false;
      while(true){
        alive();const fraction=Math.min(1,(getTime()-start)/(durationMs/1000)),distance=fraction*length;
        while(segment<points.length-1&&lengths[segment]<distance)segment++;
        const span=lengths[segment]-lengths[segment-1],t=span?(distance-lengths[segment-1])/span:1;
        const point=points[segment-1].add(points[segment].sub(points[segment-1]).uniformScale(t));
        this.channel.overrideDragVector=point.sub(previous);await this.move(point);previous=point;await nextFrame();
        if(!recordedHold&&fraction>=.5){this.projectionReceipt("hold",target);recordedHold=true;}
        if(fraction>=1)break;
      }
      if(atEndpoint)await atEndpoint();
    }finally{off();await this.retreat();}
  }
  private projectionReceipt(stage:string,target:Interactable){
    const xyz=(v:vec3)=>({x:v.x,y:v.y,z:v.z});
    const project=(p:vec3)=>{const v=this.camera.worldSpaceToScreenSpace(p.x,p.y,p.z);return{x:v.x,y:v.y};};
    const keypoints:{name:string;world:{x:number;y:number;z:number};screen:{x:number;y:number}}[]=[];
    this.shared.hand.allKeypoints.forEach((joint,name)=>keypoints.push({name,world:xyz(joint.position),screen:project(joint.position)}));
    const midpoint=this.shared.hand.indexTip.position.add(this.shared.hand.thumbTip.position).uniformScale(.5);
    const targetPoint=target.getTransform().getWorldPosition();
    const xs=keypoints.map(p=>p.screen.x),ys=keypoints.map(p=>p.screen.y);
    print("[Motion hand projection] "+JSON.stringify({stage,runtimeSeconds:getTime(),target:target.getSceneObject().name,
      camera:{position:xyz(this.camera.getWorldPosition()),rotation:rotationData(this.camera.getTransform().getWorldRotation()),right:xyz(this.camera.right()),up:xyz(this.camera.up())},
      targetWorld:xyz(targetPoint),targetScreen:project(targetPoint),pinchMidpointWorld:xyz(midpoint),pinchMidpointScreen:project(midpoint),
      wristScreen:project(this.shared.hand.wrist.position),keypoints,
      projectedKeypointEnvelope:{left:Math.min(...xs),right:Math.max(...xs),top:Math.min(...ys),bottom:Math.max(...ys)},
      scope:"Measured joint envelope is a silhouette proxy, not mesh occlusion acceptance. Inspect captured native frames."}));
  }
  private async retreat(){
    if(this.activeTarget)this.projectionReceipt("release",this.activeTarget);
    this.activeTarget=undefined;this.shared.stopSelecting();await nextFrame();await nextFrame();
    this.channel.overrideDragVector=undefined;this.channel.overrideInteractable=undefined;this.channel.resetStartEndPoint();
    const wrist=this.shared.hand.wrist.position;
    await this.shared.hand.setPosition(wrist.add(this.camera.right().uniformScale(12)).sub(this.camera.up().uniformScale(12)).add(this.direction.uniformScale(-8)),350);
    await this.shared.hand.hide(1);
    await this.shared.hand.makeGesture("relaxed",undefined,120);
  }
  async teardown(){
    if(this.shared.disposed)return;
    try{await this.retreat();}finally{
      this.shared.dispose();
      // TrackedHandWrapper's supported restoration restarts tracking after 500 ms.
      // Let it finish before another scenario constructs its own hand wrapper.
      await sleep(650);
    }
  }
}
