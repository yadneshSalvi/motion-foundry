import {LoopAssembly} from "./LoopAssembly";
import {LoopWorkshopUI,WorkbenchAction} from "./LoopWorkshopUI";
import {WorkbenchLabels} from "./WorkbenchLabels";
import {WorkbenchPlacement} from "./WorkbenchPlacement";
import {WorkbenchAudio,WorkbenchSounds} from "./WorkbenchAudio";
import {PlanarInteraction} from "./PlanarInteraction";
import {MotionExportCard} from "./MotionExportCard";
import {Vec2} from "./MotionDomain";
import {LoopInput,LoopCandidate,LoopSolveResult,LoopVerification,buildLoopInputHash,verifyLoopCandidate} from "./LoopDomain";
import {canonicalWorkbenchStroke,makeWorkbenchReference,makeWorkbenchStudy,nearestPhase,WORKBENCH_PROFILE} from "./WorkbenchProfile";
import {fitFromDialAngle,dialAngleFromFit} from "./WorkbenchGeometry";

const copy=<T>(v:T):T=>JSON.parse(JSON.stringify(v));
const TAU=Math.PI*2,wrap=(v:number)=>(v%TAU+TAU)%TAU;
type Snapshot={input:LoopInput;candidate:LoopCandidate;candidates:LoopCandidate[];receipt:string;source:string};
type EditKind="mount"|"obstacle"|"fit";
type EditSession={kind:EditKind;before:Snapshot;start:vec3;changed:boolean;startAngle:number;lastAngle:number};
export type WorkbenchOptions={sounds?:WorkbenchSounds;measuredKeepOutProp?:SceneObject;placeOnStart?:boolean};

/** Physical native workbench. Network synthesis is bounded; playback is deterministic and local. */
export class LoopController {
  readonly root:SceneObject;
  private rack:SceneObject;
  private assembly:LoopAssembly;
  private ui:LoopWorkshopUI;
  private labels:WorkbenchLabels;
  private placement:WorkbenchPlacement;
  private audio:WorkbenchAudio;
  private exportCard:MotionExportCard;
  private handles:{[key:string]:PlanarInteraction}={};
  private input:LoopInput;
  private candidate:LoopCandidate;
  private candidates:LoopCandidate[];
  private audit:LoopVerification;
  private auditKey="";
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
  private inspectUntil=0;
  private lastContact=false;
  private lastRatchet=0;

  constructor(private owner:BaseScriptComponent,parent:SceneObject,metal:Material,porcelain:Material,mint:Material,sky:Material,coral:Material,private internet:InternetModule,private backend:()=>string,private options:WorkbenchOptions={}){
    const reference=makeWorkbenchReference();this.input=reference.input;this.candidate=reference.candidate;this.candidates=[reference.candidate];this.audit=reference.candidate.verification;
    this.root=global.scene.createSceneObject("Motion Foundry workbench");this.root.setParent(parent);
    this.assembly=new LoopAssembly(this.root,metal,porcelain,mint,sky,coral);
    this.assembly.resetInk(this.candidate.parameters,this.phase);
    // The tray is in the TABLE frame, not the XY mechanism frame. It tilts gently toward the wearer.
    this.rack=global.scene.createSceneObject("Workbench tool tray");this.rack.setParent(this.root);
    this.rack.getTransform().setLocalPosition(new vec3(0,3.7,17.5));
    this.rack.getTransform().setLocalRotation(quat.fromEulerAngles(-Math.PI/6,0,0));
    this.ui=this.rack.createComponent(LoopWorkshopUI.getTypeName()) as LoopWorkshopUI;
    this.ui.onAction.add(action=>this.action(action));
    this.ui.onPhase.add(value=>{if(this.solving||this.drawMode!=="none")return;const next=nearestPhase(value*TAU,this.phase);if(Math.abs(next-this.phase)<1e-6)return;this.phase=next;this.playing=false;this.assembly.resetInk(this.candidate.parameters,this.phase);this.refresh();});
    this.labels=new WorkbenchLabels(this.root,this.assembly);
    this.audio=new WorkbenchAudio(owner,this.root,options.sounds||{});
    this.exportCard=new MotionExportCard(this.root,porcelain,{position:new vec3(24.5,10,3),rotation:quat.fromEulerAngles(-Math.PI/18,0,0),extent:16,caption:"Scan to take this machine with you"});
    this.placement=new WorkbenchPlacement(owner,parent,mint,text=>this.say(text),()=>{this.page="result";this.refresh();});
    this.bindHandles();
    owner.createEvent("OnStartEvent").bind(()=>{if(options.placeOnStart)this.beginPlacement();});
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
    if(this.playing&&!drawing&&!placing&&!this.solving&&!this.editSession)this.turnTo(this.phase+getDeltaTime()*.42*this.candidate.parameters.driveDirection,false);
    if(getTime()-this.lastUi>.15){this.refresh();this.lastUi=getTime();}
    const near=this.labels.near(this.assembly.worldPoint({x:8,y:5},1),42);
    this.showFit=!drawing&&!this.editSession&&(near||this.hover==="fit"||getTime()<this.inspectUntil)&&!!this.audit.fitWitness;
    const contact=this.audit.collisionWitness;
    this.showContact=!drawing&&!this.editSession&&!!contact&&Math.abs(Math.atan2(Math.sin(this.phase-contact.phaseRad),Math.cos(this.phase-contact.phaseRad)))<.12;
    if(this.showContact&&!this.lastContact&&contact)this.audio.play("contact",this.assembly.worldPoint(contact.location,this.input.linkLayers?.crank||1.8));
    this.lastContact=this.showContact;
    this.assembly.update(this.candidate.parameters,this.input,this.phase,{draft:drawing?this.raw:undefined,drawing,closed:!drawing,fresh:this.isFresh(),showFit:this.showFit,showContact:this.showContact,reveal:this.reveal},this.audit);
    this.handles.crank.planeHeight=this.assembly.crankHeight;
    this.handles.obstacle.planeHeight=this.input.obstacles[0]?.layerZCm??6;
    this.labels.tick(this.input,this.audit,{drawing,fresh:this.isFresh(),solving:this.solving,message:this.message,messageUntil:this.messageUntil,firstUse:this.firstUse,hover:this.hover,showFit:this.showFit,showContact:this.showContact,placement:this.placement.description(),about:this.page==="about"});
    this.updateProvidedProp();
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
    crank.onStart.add(point=>{this.firstUse=false;this.cranking=true;this.playing=false;this.crankStartPhase=this.phase;this.crankStartAngle=this.crankHandAngle=Math.atan2(point.y,point.x);this.page="result";this.inspectUntil=0;this.refresh();});
    crank.onMove.add(point=>{if(!this.cranking||Math.hypot(point.x,point.y)<.5)return;this.crankHandAngle=nearestPhase(Math.atan2(point.y,point.x),this.crankHandAngle);this.turnTo(this.crankStartPhase+this.crankHandAngle-this.crankStartAngle,true);});
    crank.onEnd.add(()=>{if(!this.cranking)return;this.cranking=false;this.playing=true;this.refresh();});
    for(const [kind,object,height] of [["mount",this.assembly.mountHandle,.7],["obstacle",this.assembly.keepOutHandle,6],["fit",this.assembly.fitHandle,1.2]] as const){
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
    if(this.drawMode!=="armed")return;
    this.firstUse=false;this.playing=false;this.drawMode="capturing";this.raw=[this.assembly.boundedPoint(point)];this.overflow=false;
    this.say("");this.refresh();
  }
  private strokeMove(point:vec3){
    if(this.drawMode!=="capturing")return;
    const q=this.assembly.boundedPoint(point),last=this.raw[this.raw.length-1];
    if(Math.hypot(q.x-last.x,q.y-last.y)<.05)return;
    if(this.raw.length<1024)this.raw.push(q);else this.overflow=true;
  }
  private endStroke(cancelled:boolean){
    if(this.drawMode!=="capturing")return;
    if(cancelled){this.raw=[];this.drawMode="armed";this.say("Pinch again to draw");}
    else if(this.overflow){this.drawMode="open";this.say("Stroke too long. Clear and redraw.");}
    else if(this.raw.length<12){this.raw=[];this.drawMode="armed";this.say("Draw a longer loop");}
    else{
      const a=this.raw[0],b=this.raw[this.raw.length-1];
      if(Math.hypot(a.x-b.x,a.y-b.y)<=WORKBENCH_PROFILE.closeDistanceCm)this.acceptStroke();
      else{this.drawMode="open";this.say("Done joins the open ends");}
    }
    this.refresh();
  }
  private acceptStroke(){
    if(this.raw.length<12||this.overflow){this.say("Draw a complete loop first");return;}
    try{
      const stroke=canonicalWorkbenchStroke(this.raw);
      this.checkpoint(this.beforeDraw||undefined);this.input.stroke=stroke;this.raw=[];this.drawMode="none";this.beforeDraw=null;this.page="closed";
      this.audio.play("clear",this.assembly.worldPoint(stroke[0],.2));this.say("Loop closed");
    }catch{this.say("Clear and draw a longer loop");}
  }
  private startEdit(kind:EditKind,start:vec3){
    if(this.drawMode!=="none"||this.solving||this.sharing)return;
    this.firstUse=false;this.playing=false;
    const angle=Math.atan2(start.y-this.assembly.fitCenter.y,start.x-this.assembly.fitCenter.x);
    this.editSession={kind,before:this.snapshot(),start,changed:false,startAngle:angle,lastAngle:angle};
  }
  private moveEdit(point:vec3){
    const edit=this.editSession;if(!edit)return;
    const round=(v:number)=>Math.round(v*1000)/1000;
    let value:number|Vec2;
    if(edit.kind==="mount")value=round(Math.max(12,Math.min(20,edit.before.input.fixedMounts.groundCm+point.x-edit.start.x)));
    else if(edit.kind==="obstacle"){
      const before=edit.before.input.obstacles[0];if(!before)return;
      value={x:round(Math.max(-14,Math.min(28,before.center.x+point.x-edit.start.x))),y:round(Math.max(-12,Math.min(23,before.center.y+point.y-edit.start.y)))};
    }else{
      edit.lastAngle=nearestPhase(Math.atan2(point.y-this.assembly.fitCenter.y,point.x-this.assembly.fitCenter.x),edit.lastAngle);
      value=fitFromDialAngle(dialAngleFromFit(edit.before.input.tolerances.fitCm)+edit.lastAngle-edit.startAngle);
    }
    const current=edit.kind==="mount"?this.input.fixedMounts.groundCm:edit.kind==="fit"?this.input.tolerances.fitCm:this.input.obstacles[0]?.center;
    if(JSON.stringify(current)===JSON.stringify(value))return;
    if(!edit.changed){this.checkpoint(edit.before);edit.changed=true;}
    if(edit.kind==="mount")this.input.fixedMounts.groundCm=value as number;
    else if(edit.kind==="fit")this.input.tolerances.fitCm=value as number;
    else this.input.obstacles[0].center=value as Vec2;
    this.page="closed";this.message="";
  }
  private endEdit(cancelled:boolean){
    const edit=this.editSession;if(!edit)return;this.editSession=null;
    if(cancelled&&edit.changed){this.history.pop();this.restore(edit.before);this.say("Edit cancelled");}
    else if(edit.changed)this.say("Make it again");
    this.refresh();
  }

  private snapshot():Snapshot{return{input:copy(this.input),candidate:copy(this.candidate),candidates:copy(this.candidates),receipt:this.receipt,source:this.source};}
  private restore(snapshot:Snapshot){
    this.invalidate();this.input=copy(snapshot.input);this.candidate=copy(snapshot.candidate);this.candidates=copy(snapshot.candidates);this.receipt=snapshot.receipt;this.source=snapshot.source;
    this.raw=[];this.drawMode="none";this.beforeDraw=null;this.page="result";this.auditKey="";this.phase=this.candidate.parameters.startingPhaseRad;this.assembly.resetInk(this.candidate.parameters,this.phase);this.playing=true;
  }
  private checkpoint(before?:Snapshot){
    this.history.push(before||this.snapshot());if(this.history.length>32)this.history.shift();this.invalidate();
    this.input=copy(this.input);delete this.input.inputHash;this.input.revision++;this.receipt="";
  }
  private invalidate(){this.generation++;this.shareGeneration++;this.solving=false;this.sharing=false;this.exportCard?.hide();this.exportUrl="";this.inspectUntil=0;}
  private say(text:string,seconds=3){this.message=text;this.messageUntil=getTime()+seconds;}
  private isFresh(){return buildLoopInputHash(this.input)===this.candidate.verification.inputHash&&this.audit.valid;}

  private action(action:string){
    if(this.cranking||this.editSession||this.drawMode==="capturing")return;
    if(this.sharing&&action!=="export"){this.shareGeneration++;this.sharing=false;}
    if(action!=="export"){this.exportCard.hide();this.exportUrl="";}
    if(this.drawMode==="open"&&!["done","clear"].includes(action)){this.say("Done closes the loop; Clear redraws it");return;}
    this.firstUse=false;
    if(action==="draw"||action==="clear"){
      if(this.drawMode==="none")this.beforeDraw=this.snapshot();
      this.invalidate();this.raw=[];this.overflow=false;this.drawMode="armed";this.playing=false;this.page="drawing";this.say("");
    }else if(action==="done"){
      if(this.raw.length)this.acceptStroke();else{this.drawMode="none";this.page="result";this.beforeDraw=null;this.playing=true;}
    }else if(action==="solve")this.solve();
    else if(action==="cancel"){this.invalidate();this.page="closed";this.say("Cancelled. Previous machine kept.");}
    else if(action==="undo"){
      const previous=this.history.pop();if(previous){this.restore(previous);this.say("Previous machine restored");}else this.say("Nothing to undo");
    }else if(action==="next"){
      if(!this.isFresh()){this.say("Make this loop first");return;}
      const i=this.candidates.findIndex(c=>c.id===this.candidate.id);this.candidate=this.candidates[(i+1)%this.candidates.length];this.phase=this.candidate.parameters.startingPhaseRad;this.assembly.resetInk(this.candidate.parameters,this.phase);this.playing=true;this.inspectUntil=0;this.say("Another machine, same loop");
    }else if(action==="study"||action==="reference")this.loadReference(action==="study");
    else if(action==="export")this.save();
    else if(action==="more")this.page="more";
    else if(action==="tools")this.page="tools";
    else if(action==="extras")this.page="extras";
    else if(action==="phase")this.page="phase";
    else if(action==="about")this.page="about";
    else if(action==="back")this.page="result";
    else if(action==="play"){this.playing=!this.playing;this.inspectUntil=0;}
    else if(action==="fit"){
      this.refresh();if(this.audit.fitWitness){this.phase=this.audit.fitWitness.phaseRad;this.playing=false;this.inspectUntil=getTime()+4;this.say("Largest gap on this loop");}
    }else if(action==="place")this.beginPlacement();
    else if(action==="place:cancel"){this.placement.cancel();this.page="result";this.say("Using the placed table");}
    this.refresh();
  }
  private beginPlacement(){this.invalidate();this.playing=false;this.page="placement";this.placement.begin();this.refresh();}
  private loadReference(study:boolean){
    const previous=this.snapshot(),next=study?makeWorkbenchStudy():makeWorkbenchReference();
    this.invalidate();this.history.push(previous);if(this.history.length>32)this.history.shift();
    next.input.revision=this.input.revision+1;next.candidate.verification=verifyLoopCandidate(next.input,next.candidate.parameters);
    this.input=next.input;this.candidate=next.candidate;this.candidates=[next.candidate];this.receipt="";this.source=study?"Measured keep-out study":"Reference mechanism";
    this.raw=[];this.drawMode="none";this.page=study?"closed":"result";this.auditKey="";
    this.phase=study?(next.candidate.verification.collisionWitness?.phaseRad||Math.PI):next.candidate.parameters.startingPhaseRad;
    this.assembly.resetInk(this.candidate.parameters,this.phase);this.playing=!study;this.lastContact=false;
    this.say(study?"Reference study":"Reference machine",4);
  }

  private async solve(){
    if(this.solving||this.drawMode!=="none")return;
    const endpoint=this.backend().replace(/\/$/,"");if(!endpoint){this.say("Connect the companion to make a machine",4);return;}
    const input=copy(this.input),hash=buildLoopInputHash(input),generation=++this.generation;
    this.shareGeneration++;this.sharing=false;this.exportCard.hide();this.exportUrl="";this.solving=true;this.playing=false;this.say("");this.refresh();
    const timeout=this.owner.createEvent("DelayedCallbackEvent");
    timeout.bind(()=>{if(this.generation===generation&&this.solving){this.generation++;this.solving=false;this.page="closed";this.say("Taking too long. Try again.",4);this.refresh();}});timeout.reset(28);
    try{
      const response=await this.internet.fetch(endpoint+"/api/loops/solve",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify(input)});
      if(response.status!==200)throw Error("Solve HTTP status "+response.status);
      const result=await response.json() as LoopSolveResult&{receipt?:string};
      if(generation!==this.generation||hash!==buildLoopInputHash(this.input)||result.inputHash!==hash||result.revision!==this.input.revision)return;
      this.solving=false;
      if(result.status!=="succeeded"){this.page="closed";this.say("No fit found. Previous machine kept.",5);this.refresh();return;}
      const candidates=result.candidates.map(c=>({...c,verification:verifyLoopCandidate(input,c.parameters)})).filter(c=>c.verification.valid);
      if(!candidates.length)throw Error("Local geometry check failed");
      this.candidates=candidates;this.candidate=candidates[0];this.receipt=result.receipt||"";this.source="HTTPS solve";this.phase=this.candidate.parameters.startingPhaseRad;
      this.assembly.resetInk(this.candidate.parameters,this.phase);this.playing=true;this.drawMode="none";this.page="result";this.raw=[];this.inspectUntil=0;this.say("");this.lastContact=false;
      this.audio.play("clear",this.assembly.worldPoint({x:8,y:5},2));
      print("[MotionFoundry loop solved] "+JSON.stringify({revision:input.revision,inputHash:hash,parameters:this.candidate.parameters,verification:this.candidate.verification}));
    }catch(error){if(this.generation===generation){this.solving=false;this.page="closed";this.say("Connection unavailable. Try again.",4);print("[MotionFoundry loop] "+String(error));}}
    this.refresh();
  }

  private async save(){
    this.refresh();const hash=buildLoopInputHash(this.input),id=this.candidate.id,generation=this.generation;
    if(this.drawMode!=="none"||!this.isFresh()){this.say("Make this loop before keeping it");return;}
    const manifest={format:"motion-foundry/lens-loop-design@1.0",units:{length:"centimetres",angle:"radians"},input:this.input,candidate:this.candidate,source:this.source};
    global.persistentStorageSystem.store.putString("motion-foundry-loop-last-export",JSON.stringify(manifest));
    const endpoint=this.backend().replace(/\/$/,"");if(!endpoint){this.say("Kept locally. Connect to make a share tag.",4);return;}
    if(this.sharing)return;const shareRequest=++this.shareGeneration;this.sharing=true;this.exportCard.hide();this.exportUrl="";this.say("Preparing your machine’s tag…");this.refresh();
    const timeout=this.owner.createEvent("DelayedCallbackEvent");
    timeout.bind(()=>{if(this.generation===generation&&this.shareGeneration===shareRequest&&this.sharing){this.shareGeneration++;this.sharing=false;this.say("Tag timed out. Try Keep again.");this.refresh();}});timeout.reset(20);
    try{
      const response=await this.internet.fetch(endpoint+"/api/loops/shares",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify(this.receipt?{receipt:this.receipt,candidateId:id}:{input:this.input,candidate:this.candidate})});
      if(response.status!==200)throw Error("Share HTTP status "+response.status);
      const share=await response.json();
      if(hash!==buildLoopInputHash(this.input)||id!==this.candidate.id||generation!==this.generation||shareRequest!==this.shareGeneration)return;
      if(typeof share.url!=="string"||!share.url.startsWith(endpoint+"/design/loop/"))throw Error("Unexpected share URL");
      this.exportUrl=share.url;global.persistentStorageSystem.store.putString("motion-foundry-loop-export-url",share.url);
      if(share.qr)this.exportCard.show(share.qr.size,share.qr.data);
      this.say(share.qr?"Your machine is on the tag":"Too much data for a QR. Use the companion export.",4);
      print("[MotionFoundry loop export] "+share.url);
    }catch{if(this.generation===generation&&this.shareGeneration===shareRequest)this.say("Tag unavailable. Kept locally; try again.",4);}
    finally{if(this.shareGeneration===shareRequest){this.sharing=false;this.refresh();}}
  }

  private refresh(){
    if(!this.ui)return;
    const hash=buildLoopInputHash(this.input),key=hash+JSON.stringify(this.candidate.parameters);
    // Avoid 720-pose checks during drag frames; verify once against the finished edit.
    if(key!==this.auditKey&&!this.editSession){this.auditKey=key;this.audit=verifyLoopCandidate(this.input,this.candidate.parameters);}
    const placing=this.placement?.mode==="placing",drawing=this.drawMode!=="none";
    const canHandle=!placing&&!drawing&&!this.solving&&!this.sharing;
    if(this.handles.board){
      this.handles.board.setAllowed(!placing&&(this.drawMode==="armed"||this.drawMode==="capturing"));
      for(const name of ["crank","mount","fit"])this.handles[name].setAllowed(canHandle);
      this.handles.obstacle.setAllowed(canHandle&&this.input.obstacles.length>0);
    }
    let actions:WorkbenchAction[]=[];const a=(id:string,label:string):WorkbenchAction=>({id,label});
    let page=this.page,showPhase=false;
    if(placing){page="placement";actions=[a("place:cancel","Cancel")];}
    else if(this.solving){page="solving";actions=[a("cancel","Cancel")];}
    else if(this.sharing){page="sharing";actions=[a("back","Back")];}
    else if(drawing){page="drawing";actions=[a("clear","Clear"),a("done","Done")];}
    else if(page==="more")actions=[a("draw","Draw"),a("study","Study"),a("tools","Tools")];
    else if(page==="tools")actions=[a("undo","Undo"),a("phase","Crank"),a("extras","More")];
    else if(page==="extras")actions=[a("fit","Error"),a("place","Place"),a("about","About")];
    else if(page==="about")actions=[a("reference","Reference"),a("back","Back")];
    else if(page==="phase"){actions=[a("play",this.playing?"Pause":"Play"),a("back","Back")];showPhase=true;}
    else if(page==="idle"&&this.firstUse)actions=[a("draw","Draw")];
    else if(!this.isFresh())actions=[a("solve",this.input.obstacles.length?"Make it again":"Make it"),a("undo","Undo"),a("more","More")];
    else actions=[a("export","Keep"),this.candidates.length>1?a("next","Try another"):a("draw","Draw"),a("more","More")];
    this.ui.setState({page,actions,phase:wrap(this.phase)/TAU,showPhase});
  }
  private updateProvidedProp(){
    const prop=this.options.measuredKeepOutProp;if(!prop)return;
    const obstacle=this.input.obstacles[0];prop.enabled=!!obstacle;
    if(!obstacle)return;
    const t=prop.getTransform();t.setWorldPosition(this.assembly.worldPoint(obstacle.center,obstacle.layerZCm??6));
    // The supplied cylinder is authored with its vertical axis along local Y, dimensions set by the editor owner.
    t.setWorldRotation(this.root.getTransform().getWorldRotation());
  }
  public getStateSnapshot(){
    this.refresh();const table=this.root.getParent()!.getTransform();
    return{mode:"loop",source:this.source,revision:this.input.revision,inputHash:buildLoopInputHash(this.input),input:copy(this.input),candidateId:this.candidate.id,parameters:copy(this.candidate.parameters),verifiedForCurrentRevision:this.isFresh(),verification:copy(this.audit),solving:this.solving,sharing:this.sharing,phase:this.phase,driveDirection:this.candidate.parameters.driveDirection,playing:this.playing,reveal:this.reveal,drawMode:this.drawMode,draftPointCount:this.raw.length,boardBounds:this.assembly.bounds,uiPage:this.ui.getPage(),actions:this.ui.getActions(),historyLength:this.history.length,candidateCount:this.candidates.length,status:this.message,exportUrl:this.exportUrl,hasReceipt:!!this.receipt,fitWitnessVisible:this.showFit,collisionWitnessVisible:this.showContact,cranking:this.cranking,editing:this.editSession?.kind||null,inkPointCount:this.assembly.inkPointCount(),placement:this.placement.snapshot(),tableWorldPosition:table.getWorldPosition(),tableWorldRotation:table.getWorldRotation(),qr:this.exportCard.snapshot(),audio:this.audio.snapshot(),displayScope:"Axles, clamps, crank grip and pen are decorative; sampled capsule rods and declared obstacles are verified."};
  }
}
