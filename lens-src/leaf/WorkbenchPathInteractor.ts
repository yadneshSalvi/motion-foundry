import {LeafSingleHandInteractor} from "Leaf.lspkg/Interactors/interactor/handInput/LeafHandInteractor";
import {nextFrame,sleep} from "Leaf.lspkg/Utils/common/Utils";
import {Interactable} from "SpectaclesInteractionKit.lspkg/Components/Interaction/Interactable/Interactable";
import {VERTICAL_HAND_ROTATION} from "Leaf.lspkg/Interactors/interactor/handInput/Gestures";
import WorldCameraFinderProvider from "SpectaclesInteractionKit.lspkg/Providers/CameraProvider/WorldCameraFinderProvider";

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
  private readonly direction=new vec3(-.55,-.10,-.83).normalize();
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
  private async pose(point:vec3,pinch:boolean,alive:()=>void){
    const hand=this.shared.hand,q0=VERTICAL_HAND_ROTATION.right;
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
  private async until(test:()=>boolean,label:string,alive:()=>void){
    const deadline=getTime()+2;
    while(!test()){alive();if(getTime()>deadline)throw Error("SIK hand input timeout: "+label);await nextFrame();}
  }
  async trigger(target:Interactable){
    let started=false,ended=false;
    const off=[target.onTriggerStart.add(()=>{started=true;}),target.onTriggerEnd.add(()=>{ended=true;})];
    try{
      await this.pose(target.getTransform().getWorldPosition(),true,()=>{});
      this.channel.overrideInteractable=target;await nextFrame();await nextFrame();
      this.shared.startSelecting();await this.until(()=>started,"trigger start",()=>{});
      await sleep(120);this.shared.stopSelecting();await this.until(()=>ended,"trigger end",()=>{});
    }finally{off.forEach(f=>f());await this.retreat();}
  }
  async hover(target:Interactable,durationMs=300){
    if(durationMs<0||durationMs>5000)throw Error("Bounded hover duration required");
    try{
      await this.pose(target.getTransform().getWorldPosition(),false,()=>{});
      this.channel.overrideInteractable=target;await sleep(durationMs);
    }finally{await this.retreat();}
  }
  async drag(target:Interactable,delta:vec3,durationMs:number){
    const start=target.getTransform().getWorldPosition();
    await this.followTimedPath(target,[start,start.add(delta)],durationMs,()=>{});
  }
  async followPath(target:Interactable,points:vec3[]){await this.followTimedPath(target,points,6000,()=>{});}
  async followTimedPath(target:Interactable,points:vec3[],durationMs:number,alive:()=>void,atEndpoint?:()=>Promise<void>){
    if(points.length<2||durationMs<250||durationMs>30000)throw Error("A hand path needs points and a bounded real duration");
    const lengths=[0];for(let i=1;i<points.length;i++)lengths.push(lengths[i-1]+points[i].distance(points[i-1]));
    const length=lengths[lengths.length-1];if(!(length>0))throw Error("Empty hand path");
    let started=false;const off=target.onTriggerStart.add(()=>{started=true;});
    try{
      await this.pose(points[0],true,alive);
      this.channel.overrideInteractable=target;await nextFrame();await nextFrame();alive();
      this.shared.startSelecting();await this.until(()=>started,"path trigger start",alive);
      const start=getTime();let segment=1,previous=points[0];
      while(true){
        alive();const fraction=Math.min(1,(getTime()-start)/(durationMs/1000)),distance=fraction*length;
        while(segment<points.length-1&&lengths[segment]<distance)segment++;
        const span=lengths[segment]-lengths[segment-1],t=span?(distance-lengths[segment-1])/span:1;
        const point=points[segment-1].add(points[segment].sub(points[segment-1]).uniformScale(t));
        this.channel.overrideDragVector=point.sub(previous);await this.move(point);previous=point;await nextFrame();
        if(fraction>=1)break;
      }
      if(atEndpoint)await atEndpoint();
    }finally{off();await this.retreat();}
  }
  private async retreat(){
    this.shared.stopSelecting();await nextFrame();await nextFrame();
    this.channel.overrideDragVector=undefined;this.channel.overrideInteractable=undefined;this.channel.resetStartEndPoint();
    const wrist=this.shared.hand.wrist.position;
    await this.shared.hand.setPosition(wrist.add(new vec3(12,-8,8)),350);
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
