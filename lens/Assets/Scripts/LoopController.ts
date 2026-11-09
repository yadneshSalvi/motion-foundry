import {vector3Data,rotationData} from "./WorkbenchLayout";
import {LoopAssembly} from "./LoopAssembly";
import {LoopWorkshopUI,WorkbenchAction} from "./LoopWorkshopUI";
import {WorkbenchLabels} from "./WorkbenchLabels";
import {WorkbenchPlacement} from "./WorkbenchPlacement";
import {WorkbenchAudio,WorkbenchSounds} from "./WorkbenchAudio";
import {HintKind,WorkbenchHints} from "./WorkbenchHints";
import {PlanarInteraction} from "./PlanarInteraction";
import {MotionExportCard} from "./MotionExportCard";
import {Vec2} from "./MotionDomain";
import {LoopInput,LoopCandidate,LoopSolveResult,LoopVerification,buildLoopInputHash,verifyLoopCandidate} from "./LoopDomain";
import {canonicalWorkbenchStroke,makeWorkbenchReference,nearestPhase,WORKBENCH_PROFILE,WORKBENCH_KEEP_OUT} from "./WorkbenchProfile";
import {fitFromDialAngle,dialAngleFromFit} from "./WorkbenchGeometry";
import {canSnapStroke,crankReleaseStep,placementPolicy,withWorkbenchObstacle,WORKBENCH_PRESENTATION} from "./WorkbenchPresentation";

const copy=<T>(v:T):T=>JSON.parse(JSON.stringify(v));
const TAU=Math.PI*2,wrap=(v:number)=>(v%TAU+TAU)%TAU;
type Snapshot={input:LoopInput;candidate:LoopCandidate;candidates:LoopCandidate[];receipt:string;source:string};
type EditKind="mount"|"obstacle"|"obstacleSize"|"fit";
type EditSession={kind:EditKind;before:Snapshot;start:vec3;changed:boolean;startAngle:number;lastAngle:number};
export type WorkbenchOptions={sounds?:WorkbenchSounds;placeOnStart?:boolean};

/** Physical native workbench. Network synthesis is bounded; playback is deterministic and local. */
export class LoopController {
  readonly root:SceneObject;
  private rack:SceneObject;
  private assembly:LoopAssembly;
  private ui:LoopWorkshopUI;
  private labels:WorkbenchLabels;
  private placement:WorkbenchPlacement;
  private audio:WorkbenchAudio;
  private hints:WorkbenchHints;
  private exportCard:MotionExportCard;
  private handles:{[key:string]:PlanarInteraction}={};
  private input:LoopInput;
  private candidate:LoopCandidate;
  private candidates:LoopCandidate[];
  private audit:LoopVerification;
  private auditKey="";
  private inputVersion=0;
  private hashVersion=-1;
  private cachedInputHash="";
  private parameterKey="";
  private parameterSource:LoopCandidate|null=null;
  private history:Snapshot[]=[];
  private receipt="";
  private source="Reference mechanism";
  private generation=0;
  private shareGeneration=0;
  private solving=false;
  private sharing=false;
  private exportUrl="";
  private phase=.4;
  private playing=true;
  private reveal=true;
  private active=true;
  private firstUse=true;
  private lastUi=0;
  private message="";
  private messageUntil=0;
  private page="idle";
  private drawMode:"none"|"armed"|"capturing"|"open"="none";
  private raw:Vec2[]=[];
  private rawVersion=0;
  private strokeLengthCm=0;
  private beforeDraw:Snapshot|null=null;
  private overflow=false;
  private editSession:EditSession|null=null;
  private cranking=false;
  private crankStartPhase=0;
  private crankStartAngle=0;
  private crankHandAngle=0;
  private hover="";
  private showFit=false;
  private showContact=false;
  private lastContact=false;
  private lastRatchet=0;
  private startup=placementPolicy(global.deviceInfoSystem.isEditor());
  private velocity:number=WORKBENCH_PRESENTATION.autoSpeedRad;
  private lastCrankAt=0;
  private menuTouched=0;
  private undoContext:{point:Vec2;height:number;label:string}|null=null;
  private snapped=false;
  private beforePlacement:{playing:boolean;page:string}|null=null;

  constructor(private owner:BaseScriptComponent,parent:SceneObject,metal:Material,porcelain:Material,mint:Material,sky:Material,coral:Material,private internet:InternetModule,private backend:()=>string,private options:WorkbenchOptions={}){
    const reference=makeWorkbenchReference();this.input=reference.input;this.candidate=reference.candidate;this.candidates=[reference.candidate];this.audit=reference.candidate.verification;
    this.startup=placementPolicy(global.deviceInfoSystem.isEditor(),!!options.placeOnStart);
    this.root=global.scene.createSceneObject("Motion Foundry workbench");this.root.setParent(parent);
    this.assembly=new LoopAssembly(this.root,mint);
    this.assembly.resetInk(this.candidate.parameters,this.phase);
    // The tray is in the TABLE frame, not the XY mechanism frame. It tilts gently toward the wearer.
    this.rack=global.scene.createSceneObject("Workbench tool tray");this.rack.setParent(this.root);
    this.rack.getTransform().setLocalPosition(new vec3(0,3.7,17.5));
    this.rack.getTransform().setLocalRotation(quat.fromEulerAngles(-Math.PI/6,0,0));
    this.ui=this.rack.createComponent(LoopWorkshopUI.getTypeName()) as LoopWorkshopUI;
    this.ui.onAction.add(action=>this.action(action));
    this.ui.onEngaged.add(()=>this.menuTouched=getTime());
    this.labels=new WorkbenchLabels(this.root,this.assembly,mint);
    this.audio=new WorkbenchAudio(owner,this.root,options.sounds||{});
    this.hints=new WorkbenchHints(owner,this.root);
    this.exportCard=new MotionExportCard(this.root,porcelain,{position:new vec3(22.5,4.5,17.5),rotation:quat.fromEulerAngles(-Math.PI/9,0,0),extent:10,caption:"Open on your\nphone"});
    this.placement=new WorkbenchPlacement(owner,parent,mint,text=>this.say(text),()=>{this.page="result";this.playing=this.beforePlacement?.playing??true;this.beforePlacement=null;this.refresh();},this.startup.isEditor);
    this.bindHandles();
    owner.createEvent("OnStartEvent").bind(()=>{
      print("[MotionFoundry startup] "+JSON.stringify(this.startup));
      if(this.startup.beginPlacement)this.beginPlacement();
    });
    if(this.startup.beginPlacement)this.assembly.root.enabled=false;
    this.refresh();
  }

  public setEnabled(value:boolean){
    this.active=value;this.root.enabled=value;
    if(!value){this.invalidate();this.placement.cancel();}else this.refresh();
  }
  public tick(){
    if(!this.active)return;
    this.placement.tick();
    const drawing=this.drawMode!=="none",placing=this.placement.mode==="placing";
    if(this.playing&&!drawing&&!placing&&!this.solving&&!this.editSession){
      const step=crankReleaseStep(this.velocity,this.candidate.parameters.driveDirection,getDeltaTime());this.velocity=step.velocity;this.turnTo(this.phase+step.advance,false);
    }
    if((this.page==="more"||this.page==="tools")&&getTime()-this.menuTouched>WORKBENCH_PRESENTATION.menuIdleSeconds){this.page="result";this.refresh();}
    this.assembly.root.enabled=!placing;
    if(getTime()-this.lastUi>.15){this.refresh();this.lastUi=getTime();}
    const near=this.labels.getBand()==="near";
    this.showFit=!drawing&&!this.editSession&&(near||this.hover==="fit")&&!!this.audit.fitWitness;
    const contact=this.audit.collisionWitness;
    this.showContact=!drawing&&!this.editSession&&!!contact&&Math.abs(Math.atan2(Math.sin(this.phase-contact.phaseRad),Math.cos(this.phase-contact.phaseRad)))<.12;
    if(this.showContact&&!this.lastContact&&contact)this.audio.play("contact",this.assembly.worldPoint(contact.location,this.input.linkLayers?.crank||1.8));
    this.lastContact=this.showContact;
    const fresh=this.isFresh();
    this.assembly.update(this.candidate.parameters,this.input,this.phase,{draft:drawing?this.raw:undefined,draftVersion:this.rawVersion,drawing,closed:!drawing,fresh,showFit:this.showFit,showContact:this.showContact,reveal:this.reveal,solving:this.solving,hover:this.hover,editing:this.editSession?.kind||"",isEditor:this.startup.isEditor},this.audit);
    this.handles.crank.planeHeight=this.assembly.crankHeight;
    this.handles.obstacle.planeHeight=this.input.obstacles[0]?.layerZCm??2;
    this.handles.obstacleSize.planeHeight=(this.input.obstacles[0]?.layerZCm??2)+(this.input.obstacles[0]?.depthCm??4)/2;
    this.labels.prepare(this.input,this.candidate.parameters,this.phase,drawing,this.exportCard.exclusions());
    const preferred=placing?this.placement.controlsPoint():this.root.getTransform().getWorldTransform().multiplyPoint(new vec3(0,3.7,17.5));
    this.labels.placeDock(this.rack,this.ui,preferred,placing?this.placement.footprint():undefined);
    this.labels.tick(this.input,this.audit,{drawing,drawMode:this.drawMode,strokeLengthCm:this.strokeLengthCm,fresh,matched:this.assembly.matchProgress().complete,solving:this.solving,message:this.message,messageUntil:this.messageUntil,firstUse:this.firstUse,hover:this.hover,editing:this.editSession?.kind||"",showFit:this.showFit,showContact:this.showContact,isEditor:this.startup.isEditor,parameters:this.candidate.parameters,phase:this.phase,placing,placementText:this.placement.description(),placementPoint:this.placement.labelPoint(),pendingHints:{crank:this.hints.needs("crank"),draw:this.hints.needs("draw"),fit:this.hints.needs("fit"),mount:this.hints.needs("mount"),obstacle:this.hints.needs("obstacle"),obstacleSize:this.hints.needs("obstacleSize")}});
    this.ui.setOpacity(placing?1:this.labels.controlsOpacity());
    const hintKind=this.requestedHint(placing);
    const hintObject=hintKind==="fit"?this.assembly.fitHandle:hintKind==="mount"?this.assembly.mountHandle:hintKind==="obstacle"?this.assembly.keepOutHandle:hintKind==="obstacleSize"?this.assembly.keepOutSizeHandle:this.assembly.crankHandle;
    this.hints.tick(hintKind,hintKind==="draw"?this.assembly.worldPoint({x:8,y:5},.8):hintObject.getTransform().getWorldPosition(),this.root.getTransform().getWorldRotation());
  }

  private requestedHint(placing:boolean):HintKind|null{
    if(placing||this.cranking||this.editSession||this.solving||this.labels.getBand()==="far")return null;
    if(this.drawMode==="armed")return "draw";
    // A first-use crank cue must not appear over an active or unfinished stroke.
    // Completing the draw gesture does not complete the independent crank lesson.
    if(this.drawMode!=="none")return null;
    if(["crank","fit","mount","obstacle","obstacleSize"].includes(this.hover))return this.hover as HintKind;
    return this.firstUse?"crank":null;
  }

  private bindHandles(){
    const bind=(name:string,object:SceneObject,height:number)=>{
      const handle=object.createComponent(PlanarInteraction.getTypeName()) as PlanarInteraction;
      handle.plane=this.assembly.root;handle.planeHeight=height;
      handle.onHover.add(value=>{if(value)this.hover=name;else if(this.hover===name)this.hover="";});
      this.handles[name]=handle;return handle;
    };
    const board=bind("board",this.assembly.boardTarget,.1);
    board.onStart.add(point=>this.startStroke(point));board.onMove.add(point=>this.strokeMove(point));board.onEnd.add(cancelled=>this.endStroke(cancelled));
    const crank=bind("crank",this.assembly.crankHandle,6.7);
    crank.onStart.add(point=>{this.cranking=true;this.playing=false;this.velocity=0;this.lastCrankAt=getTime();this.crankStartPhase=this.phase;this.crankStartAngle=this.crankHandAngle=Math.atan2(point.y,point.x);this.page="result";this.refresh();});
    crank.onMove.add(point=>{
      if(!this.cranking||Math.hypot(point.x,point.y)<.5)return;
      this.crankHandAngle=nearestPhase(Math.atan2(point.y,point.x),this.crankHandAngle);
      const next=this.crankStartPhase+this.crankHandAngle-this.crankStartAngle,now=getTime(),dt=Math.max(.008,now-this.lastCrankAt);
      const speed=Math.max(-WORKBENCH_PRESENTATION.maxFlickRad,Math.min(WORKBENCH_PRESENTATION.maxFlickRad,(next-this.phase)/dt));
      this.velocity=this.velocity*.45+speed*.55;this.lastCrankAt=now;this.turnTo(next,true);
      if(Math.abs(next-this.crankStartPhase)>.08){this.firstUse=false;this.hints.complete("crank");}
    });
    crank.onEnd.add(cancelled=>{if(!this.cranking)return;this.cranking=false;if(cancelled||getTime()-this.lastCrankAt>.15)this.velocity=this.candidate.parameters.driveDirection*WORKBENCH_PRESENTATION.autoSpeedRad;this.playing=true;this.refresh();});
    for(const [kind,object,height] of [["mount",this.assembly.mountHandle,.7],["obstacle",this.assembly.keepOutHandle,2],["obstacleSize",this.assembly.keepOutSizeHandle,4],["fit",this.assembly.fitHandle,1.2]] as const){
      const handle=bind(kind,object,height);handle.onStart.add(point=>this.startEdit(kind,point));handle.onMove.add(point=>this.moveEdit(point));handle.onEnd.add(cancelled=>this.endEdit(cancelled));
    }
  }
  private turnTo(next:number,byHand:boolean){
    const previous=this.phase;this.phase=next;
    this.assembly.advanceInk(this.candidate.parameters,previous,next);
    const ratchet=Math.floor(next/(Math.PI/12));
    if(ratchet!==this.lastRatchet&&byHand)this.audio.play("tick",this.assembly.worldPoint(this.assembly.crankPoint,this.assembly.crankHeight));
    this.lastRatchet=ratchet;
  }
  private startStroke(point:vec3){
    if(this.drawMode!=="armed"&&this.drawMode!=="open")return;
    const q=this.assembly.boundedPoint(point),last=this.raw[this.raw.length-1];
    if(this.drawMode==="open"&&last&&Math.hypot(q.x-last.x,q.y-last.y)>2){this.say("Continue from the bright end");return;}
    this.playing=false;this.drawMode="capturing";this.snapped=false;
    if(!this.raw.length){this.raw=[q];this.strokeLengthCm=0;}this.rawVersion++;this.overflow=false;
    this.say("");this.refresh();
  }
  private strokeMove(point:vec3){
    if(this.drawMode!=="capturing")return;
    const q=this.assembly.boundedPoint(point),last=this.raw[this.raw.length-1];
    if(Math.hypot(q.x-last.x,q.y-last.y)<.05)return;
    if(this.raw.length<1024){this.raw.push(q);this.strokeLengthCm+=Math.hypot(q.x-last.x,q.y-last.y);this.rawVersion++;}else this.overflow=true;
    if(this.raw.length>=4)this.hints.complete("draw");
    if(!this.overflow&&canSnapStroke(this.raw)){this.raw[this.raw.length-1]={...this.raw[0]};this.snapped=true;this.acceptStroke();this.refresh();}
  }
  private endStroke(cancelled:boolean){
    if(this.drawMode!=="capturing")return;
    if(cancelled){this.raw=[];this.rawVersion++;this.strokeLengthCm=0;this.drawMode="armed";this.say("Pinch again to draw");}
    else if(this.overflow){this.drawMode="open";this.say("Stroke too long. Clear and redraw.");}
    else if(this.raw.length<12){this.raw=[];this.rawVersion++;this.strokeLengthCm=0;this.drawMode="armed";this.say("Draw a longer curve");}
    else{
      if(canSnapStroke(this.raw))this.acceptStroke();
      else{this.drawMode="open";this.say("Continue from the bright end");}
    }
    this.refresh();
  }
  private acceptStroke(){
    if(this.raw.length<12||this.overflow){this.say("Finish your drawing first");return;}
    try{
      const stroke=canonicalWorkbenchStroke(this.raw);
      this.checkpoint(this.beforeDraw||undefined);this.input.stroke=stroke;this.touchInput();this.raw=[];this.drawMode="none";this.beforeDraw=null;this.page="closed";
      this.undoContext={point:stroke[0],height:.1,label:"Undo\ndrawing"};
      this.audio.play("clear",this.assembly.worldPoint(stroke[0],.2));this.say("Drawing closed");
    }catch{this.say("Clear and draw a longer curve");}
  }
  private startEdit(kind:EditKind,start:vec3){
    if(this.drawMode!=="none"||this.solving||this.sharing)return;
    this.playing=false;this.page="result";
    const angle=Math.atan2(start.y-this.assembly.fitCenter.y,start.x-this.assembly.fitCenter.x);
    this.editSession={kind,before:this.snapshot(),start,changed:false,startAngle:angle,lastAngle:angle};
    if(kind==="obstacle"&&!this.input.obstacles.length){
      this.checkpoint(this.editSession.before);this.input=withWorkbenchObstacle(this.input,copy(WORKBENCH_KEEP_OUT));this.touchInput();this.editSession.changed=true;
      this.page="closed";this.say("Move the ring to your mug");
    }
  }
  private moveEdit(point:vec3){
    const edit=this.editSession;if(!edit)return;
    const round=(v:number)=>Math.round(v*1000)/1000;
    let value:number|Vec2;
    if(edit.kind==="mount")value=round(Math.max(12,Math.min(20,edit.before.input.fixedMounts.groundCm+point.x-edit.start.x)));
    else if(edit.kind==="obstacle"){
      const before=edit.before.input.obstacles[0]||WORKBENCH_KEEP_OUT;
      value={x:round(Math.max(-14,Math.min(28,before.center.x+point.x-edit.start.x))),y:round(Math.max(-12,Math.min(23,before.center.y+point.y-edit.start.y)))};
    }else if(edit.kind==="obstacleSize"){
      const before=edit.before.input.obstacles[0];if(!before)return;
      const a=Math.hypot(edit.start.x-before.center.x,edit.start.y-before.center.y),b=Math.hypot(point.x-before.center.x,point.y-before.center.y);
      value=round(Math.max(2.5,Math.min(6,before.radiusCm+b-a)));
    }else{
      edit.lastAngle=nearestPhase(Math.atan2(point.y-this.assembly.fitCenter.y,point.x-this.assembly.fitCenter.x),edit.lastAngle);
      value=fitFromDialAngle(dialAngleFromFit(edit.before.input.tolerances.fitCm)+edit.lastAngle-edit.startAngle);
    }
    const current=edit.kind==="mount"?this.input.fixedMounts.groundCm:edit.kind==="fit"?this.input.tolerances.fitCm:edit.kind==="obstacleSize"?this.input.obstacles[0]?.radiusCm:this.input.obstacles[0]?.center;
    if(JSON.stringify(current)===JSON.stringify(value))return;
    if(!edit.changed){this.checkpoint(edit.before);edit.changed=true;}
    if(edit.kind==="mount")this.input.fixedMounts.groundCm=value as number;
    else if(edit.kind==="fit")this.input.tolerances.fitCm=value as number;
    else if(edit.kind==="obstacleSize")this.input.obstacles[0].radiusCm=value as number;
    else this.input.obstacles[0].center=value as Vec2;
    this.touchInput();
    this.page="closed";this.message="";
  }
  private endEdit(cancelled:boolean){
    const edit=this.editSession;if(!edit)return;this.editSession=null;
    if(cancelled&&edit.changed){this.history.pop();this.restore(edit.before);this.say("Edit cancelled");}
    else if(edit.changed){
      this.hints.complete(edit.kind);
      const point=edit.kind==="mount"?{x:this.input.fixedMounts.groundCm,y:0}:edit.kind==="fit"?this.assembly.fitCenter:this.input.obstacles[0].center;
      this.undoContext={point,height:edit.kind==="mount"?.7:edit.kind==="fit"?1.2:edit.kind==="obstacleSize"?4:2,
        label:edit.kind==="mount"?"Undo\nmount":edit.kind==="fit"?"Undo\nlimit":"Undo\nmug"};
      this.audio.play("tick",this.assembly.worldPoint(point,3));this.say("");
    }
    this.refresh();
  }

  private snapshot():Snapshot{return{input:copy(this.input),candidate:copy(this.candidate),candidates:copy(this.candidates),receipt:this.receipt,source:this.source};}
  private restore(snapshot:Snapshot){
    this.invalidate();this.input=copy(snapshot.input);this.touchInput();this.candidate=copy(snapshot.candidate);this.candidates=copy(snapshot.candidates);this.receipt=snapshot.receipt;this.source=snapshot.source;
    this.raw=[];this.drawMode="none";this.beforeDraw=null;this.page="result";this.auditKey="";this.phase=this.candidate.parameters.startingPhaseRad;this.velocity=this.candidate.parameters.driveDirection*WORKBENCH_PRESENTATION.autoSpeedRad;this.assembly.resetInk(this.candidate.parameters,this.phase);this.playing=true;this.undoContext=null;
  }
  private checkpoint(before?:Snapshot){
    this.history.push(before||this.snapshot());if(this.history.length>32)this.history.shift();this.invalidate();
    this.input=copy(this.input);delete this.input.inputHash;this.input.revision++;this.touchInput();this.receipt="";
  }
  private invalidate(){this.generation++;this.shareGeneration++;this.solving=false;this.sharing=false;this.exportCard?.hide();this.exportUrl="";}
  private say(text:string,seconds=3){this.message=text;this.messageUntil=getTime()+seconds;}
  private touchInput(){this.inputVersion++;}
  private inputHash(){if(this.hashVersion!==this.inputVersion){this.cachedInputHash=buildLoopInputHash(this.input);this.hashVersion=this.inputVersion;}return this.cachedInputHash;}
  private isFresh(){return this.inputHash()===this.candidate.verification.inputHash&&this.audit.valid;}

  private action(action:string){
    if(this.cranking||this.editSession||this.drawMode==="capturing")return;
    if(this.sharing&&action!=="send"){this.shareGeneration++;this.sharing=false;}
    if(action!=="send"){this.exportCard.hide();this.exportUrl="";}
    if(this.drawMode==="open"&&!["back","clear"].includes(action)){this.say("Continue from the bright end, or Clear");return;}
    this.menuTouched=getTime();
    if(action==="draw"||action==="clear"){
      if(this.drawMode==="none")this.beforeDraw=this.snapshot();
      this.invalidate();this.raw=[];this.rawVersion++;this.strokeLengthCm=0;this.overflow=false;this.drawMode="armed";this.playing=false;this.page="drawing";this.say("");
    }else if(action==="solve")this.solve();
    else if(action==="cancel"){this.invalidate();this.page="closed";this.say("Cancelled. Previous machine kept.");}
    else if(action==="undo"){
      const previous=this.history.pop();if(previous){this.restore(previous);this.say("Undone");}else this.say("Nothing to undo");
    }else if(action==="next"){
      if(!this.isFresh()){this.say("Make this drawing first");return;}
      const i=this.candidates.findIndex(c=>c.id===this.candidate.id);this.candidate=this.candidates[(i+1)%this.candidates.length];this.phase=this.candidate.parameters.startingPhaseRad;this.velocity=this.candidate.parameters.driveDirection*WORKBENCH_PRESENTATION.autoSpeedRad;this.assembly.resetInk(this.candidate.parameters,this.phase);this.playing=true;this.say("Another machine, same drawing");
    }
    else if(action==="export"){
      if(!this.isFresh()){this.say("Make this drawing before saving");return;}
      this.persistDesign();this.page="share";this.say("");
    }
    else if(action==="send")this.save();
    else if(action==="more")this.page="more";
    else if(action==="tools")this.page="tools";
    else if(action==="back"){
      if(this.drawMode!=="none"&&this.beforeDraw)this.restore(this.beforeDraw);
      else this.page=this.page==="tools"?"more":"result";
    }else if(action==="place")this.beginPlacement();
    else if(action==="place:commit")this.placement.commitHit();
    else if(action==="place:retry")this.placement.begin();
    else if(action==="place:cancel"&&this.placement.canCancel()){
      this.placement.cancel();this.playing=this.beforePlacement?.playing??true;this.page=this.beforePlacement?.page||"result";this.beforePlacement=null;this.say("");
    }
    this.refresh();
  }
  private beginPlacement(){if(this.placement.mode!=="placing")this.beforePlacement={playing:this.playing,page:this.page==="more"?"result":this.page};this.invalidate();this.playing=false;this.page="placement";this.placement.begin();this.refresh();}

  private async solve(){
    if(this.solving||this.drawMode!=="none")return;
    const endpoint=this.backend().replace(/\/$/,"");if(!endpoint){this.say("Needs internet to make a machine",4);return;}
    const input=copy(this.input),hash=buildLoopInputHash(input),generation=++this.generation;
    this.shareGeneration++;this.sharing=false;this.exportCard.hide();this.exportUrl="";this.solving=true;this.playing=false;this.say("");this.refresh();
    const timeout=this.owner.createEvent("DelayedCallbackEvent");
    timeout.bind(()=>{if(this.generation===generation&&this.solving){this.generation++;this.solving=false;this.page="closed";this.say("Taking too long. Try again.",4);this.refresh();}});timeout.reset(28);
    try{
      const response=await this.internet.fetch(endpoint+"/api/loops/solve",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify(input)});
      if(response.status!==200)throw Error("Solve HTTP status "+response.status);
      const result=await response.json() as LoopSolveResult&{receipt?:string};
      if(generation!==this.generation||hash!==this.inputHash()||result.inputHash!==hash||result.revision!==this.input.revision)return;
      this.solving=false;
      if(result.status!=="succeeded"){this.page="closed";this.say("No fit found. Previous machine kept.",5);this.refresh();return;}
      const candidates=result.candidates.map(c=>({...c,verification:verifyLoopCandidate(input,c.parameters)})).filter(c=>c.verification.valid);
      if(!candidates.length)throw Error("Local geometry check failed");
      this.candidates=candidates;this.candidate=candidates[0];this.receipt=result.receipt||"";this.source="HTTPS solve";this.phase=this.candidate.parameters.startingPhaseRad;
      this.velocity=this.candidate.parameters.driveDirection*WORKBENCH_PRESENTATION.autoSpeedRad;this.undoContext=null;
      this.assembly.resetInk(this.candidate.parameters,this.phase);this.playing=true;this.drawMode="none";this.page="result";this.raw=[];this.say("");this.lastContact=false;
      this.audio.play("clear",this.assembly.worldPoint({x:8,y:5},2));
      print("[MotionFoundry loop solved] "+JSON.stringify({revision:input.revision,inputHash:hash,parameters:this.candidate.parameters,verification:this.candidate.verification}));
    }catch(error){if(this.generation===generation){this.solving=false;this.page="closed";this.say("Connection unavailable. Try again.",4);print("[MotionFoundry loop] "+String(error));}}
    this.refresh();
  }

  private async save(){
    this.refresh();const hash=this.inputHash(),id=this.candidate.id,generation=this.generation;
    if(this.drawMode!=="none"||!this.isFresh()){this.say("Make this drawing before saving");return;}
    this.persistDesign();
    const endpoint=this.backend().replace(/\/$/,"");if(!endpoint){this.say("Saved. Needs internet to send.",4);return;}
    if(this.sharing)return;const shareRequest=++this.shareGeneration;this.sharing=true;this.exportCard.hide();this.exportUrl="";this.say("Preparing your machine’s tag…");this.refresh();
    const timeout=this.owner.createEvent("DelayedCallbackEvent");
    timeout.bind(()=>{if(this.generation===generation&&this.shareGeneration===shareRequest&&this.sharing){this.shareGeneration++;this.sharing=false;this.say("Couldn't send. Try again.");this.refresh();}});timeout.reset(20);
    try{
      const response=await this.internet.fetch(endpoint+"/api/loops/shares",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify(this.receipt?{receipt:this.receipt,candidateId:id}:{input:this.input,candidate:this.candidate})});
      if(response.status!==200)throw Error("Share HTTP status "+response.status);
      const share=await response.json();
      if(hash!==this.inputHash()||id!==this.candidate.id||generation!==this.generation||shareRequest!==this.shareGeneration)return;
      if(typeof share.url!=="string"||!share.url.startsWith(endpoint+"/design/loop/"))throw Error("Unexpected share URL");
      this.exportUrl=share.url;global.persistentStorageSystem.store.putString("motion-foundry-loop-export-url",share.url);
      if(share.qr)this.exportCard.show(share.qr.size,share.qr.data);
      this.say(share.qr?"":"Too big to send from here",4);
      print("[MotionFoundry loop export] "+share.url);
    }catch{if(this.generation===generation&&this.shareGeneration===shareRequest)this.say("Tag unavailable. Saved locally; try again.",4);}
    finally{if(this.shareGeneration===shareRequest){this.sharing=false;this.refresh();}}
  }

  private persistDesign(){
    const manifest={format:"motion-foundry/lens-loop-design@1.0",units:{length:"centimetres",angle:"radians"},input:this.input,candidate:this.candidate,source:this.source};
    global.persistentStorageSystem.store.putString("motion-foundry-loop-last-export",JSON.stringify(manifest));
  }
  public getAudioSchedulingSnapshot(){return this.audio.snapshot();}

  private refresh(){
    if(!this.ui)return;
    const hash=this.inputHash();
    if(this.parameterSource!==this.candidate){this.parameterSource=this.candidate;this.parameterKey=JSON.stringify(this.candidate.parameters);}
    const key=hash+this.parameterKey;
    // Avoid 720-pose checks during drag frames; verify once against the finished edit.
    if(key!==this.auditKey&&!this.editSession){this.auditKey=key;this.audit=verifyLoopCandidate(this.input,this.candidate.parameters);}
    this.assembly.configure(this.input,this.candidate.parameters,this.candidate.id,this.inputVersion,this.phase);
    const placing=this.placement?.mode==="placing",drawing=this.drawMode!=="none";
    const canHandle=!placing&&!drawing&&!this.solving&&!this.sharing;
    if(this.handles.board){
      this.handles.board.setAllowed(!placing&&(this.drawMode==="armed"||this.drawMode==="capturing"||this.drawMode==="open"));
      for(const name of ["crank","mount","fit"])this.handles[name].setAllowed(canHandle);
      this.handles.obstacle.setAllowed(canHandle);
      this.handles.obstacleSize.setAllowed(canHandle&&this.input.obstacles.length>0);
    }
    let actions:WorkbenchAction[]=[];const a=(id:string,label:string):WorkbenchAction=>({id,label});
    let page=this.page;
    if(placing){
      page="placement";actions=[this.placement.hasHit()?a("place:commit","Place here"):a("place:retry","Look again")];
      if(this.placement.canCancel())actions.push(a("place:cancel","Back"));
    }
    else if(this.solving){page="solving";actions=[a("cancel","Cancel")];}
    else if(this.sharing){page="sharing";actions=[a("back","Back")];}
    else if(page==="share")actions=this.exportCard.isVisible()?[a("back","Back")]:[a("send","Send to phone"),a("back","Back")];
    else if(drawing){page="drawing";actions=[a("clear","Clear"),a("back","Back")];}
    else if(page==="more")actions=[a("place","Place"),a("tools","Tools"),a("back","Back")];
    else if(page==="tools")actions=[a("draw","Draw new"),...(this.history.length?[a("undo","Undo")]:[]),a("back","Back")];
    else if(page==="idle"&&this.firstUse)actions=[a("draw","Draw"),a("more","More")];
    else if(!this.isFresh())actions=[a("solve",this.audit.collisionWitness?"Avoid mug":"Make it"),a("more","More")];
    else actions=[a("export","Save"),this.candidates.length>1?a("next","Try another"):a("draw","Draw"),a("more","More")];
    const canUndo=this.history.length>0&&!!this.undoContext&&!placing&&!drawing&&!this.solving&&!this.sharing&&!this.editSession&&!this.cranking&&page!=="more"&&page!=="tools"&&page!=="share";
    let undo:undefined|{anchor:vec3;label:string};
    if(canUndo){
      if(actions.length===3)actions.splice(1,1);
      undo={anchor:this.assembly.worldPoint(this.undoContext!.point,this.undoContext!.height),label:this.undoContext!.label};
    }
    this.ui.setState({page,actions,undo});
  }
  public getStateSnapshot(){
    this.refresh();const table=this.root.getParent()!.getTransform();
    return{mode:"loop",source:this.source,revision:this.input.revision,inputHash:this.inputHash(),input:copy(this.input),candidateId:this.candidate.id,parameters:copy(this.candidate.parameters),verifiedForCurrentRevision:this.isFresh(),verification:copy(this.audit),solving:this.solving,sharing:this.sharing,phase:this.phase,driveDirection:this.candidate.parameters.driveDirection,playing:this.playing,firstUse:this.firstUse,reveal:this.reveal,drawMode:this.drawMode,draftPointCount:this.raw.length,boardBounds:this.assembly.bounds,uiPage:this.ui.getPage(),actions:this.ui.getActions(),undoChipVisible:this.ui.undoVisible(),historyLength:this.history.length,candidateCount:this.candidates.length,status:this.message,exportUrl:this.exportUrl,hasReceipt:!!this.receipt,fitWitnessVisible:this.showFit,collisionWitnessVisible:this.showContact,cranking:this.cranking,editing:this.editSession?.kind||null,inkPointCount:this.assembly.inkPointCount(),currentMatch:this.assembly.currentMatch(this.phase),matchProgress:this.assembly.matchProgress(),projection:this.labels.snapshot(),angularVelocity:this.velocity,snapClosed:this.snapped,distanceBand:this.labels.getBand(),startup:this.startup,placement:this.placement.snapshot(),tableWorldPosition:vector3Data(table.getWorldPosition()),tableWorldRotation:rotationData(table.getWorldRotation()),qr:this.exportCard.snapshot(),audio:this.audio.snapshot(),hints:this.hints.snapshot(),displayScope:"Axles, clamps, crank grip and pen are decorative; sampled capsule rods and declared obstacles are verified. Preview mug body, handle and rim lie inside the verified obstacle cylinder; the stand-in is hidden on device."};
  }
}
