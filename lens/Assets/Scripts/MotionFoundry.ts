import {LoopController} from "./LoopController";
import {MotionWorkshopUI} from "./MotionWorkshopUI";
import {MotionAssembly} from "./MotionAssembly";
import {MotionExportCard} from "./MotionExportCard";
import {DragInteraction} from "./DragInteraction";
import {Candidate,DesignInput,SolveResult,buildInputHash,makeDefaultInput,knownExampleParameters,verifyCandidate,makeContradictoryInput,solveDesign} from "./MotionDomain";
type Snapshot={input:DesignInput;candidate:Candidate;candidates:Candidate[];receipt:string;source:string};
const copy=<T>(value:T):T=>JSON.parse(JSON.stringify(value));
/** Native study is physically twice the web fixture size; all serialized centimetre quantities scale together. */
function nativeInput(input:DesignInput):DesignInput {const x=copy(input);delete x.inputHash;x.fixedMounts.groundCm*=2;for(const key of ["crank","coupler","rocker"] as const)x.lengthBounds[key]=[x.lengthBounds[key][0]*2,x.lengthBounds[key][1]*2];x.linkRadiusCm*=2;x.clearanceCm*=2;x.tolerances.closureCm*=2;if(x.linkDepthCm!==undefined)x.linkDepthCm*=2;if(x.linkLayers)for(const key of ["crank","coupler","rocker","ground"] as const)x.linkLayers[key]*=2;x.obstacles.forEach(o=>{o.center.x*=2;o.center.y*=2;o.radiusCm*=2;if(o.layerZCm!==undefined)o.layerZCm*=2;if(o.depthCm!==undefined)o.depthCm*=2;});return x;}
const nativeParameters={...knownExampleParameters,groundCm:16,crankCm:4,couplerCm:14,rockerCm:10};
@component
export class MotionFoundry extends BaseScriptComponent {
  @input @hint("HTTPS deployment URL of the companion API; no vendor secrets belong in the Lens.") backendUrl:string="";
  @input @hint("Champagne metal material for verified links and the display base.") champagne!:Material;
  @input @hint("Porcelain material with two-sided rendering for the thin decorative petals.") porcelain!:Material;
  @input @hint("Light mint material for the actual trajectory.") mint!:Material;
  @input @hint("Light blue material for the desired pose handle.") sky!:Material;
  @input @hint("Coral material for the constraint obstacle.") coral!:Material;
  private loop:LoopController;private petalRack:SceneObject;private productMode:"loop"|"petal"="loop";private modeInitialized=false;
  private internet:InternetModule=require("LensStudio:InternetModule");
  private input:DesignInput=nativeInput(makeDefaultInput());private candidate!:Candidate;private ui!:MotionWorkshopUI;private assembly!:MotionAssembly;
  private exportCard:MotionExportCard;private exportUrl="";private history:Snapshot[]=[];private candidates:Candidate[]=[];private receipt="";private source="Bundled example";private phase=0;private playing=true;private reveal=false;private mode="pose";private targetIndex=0;private generation=0;private solving=false;private message="Turn the crank. Reveal the mechanism.";private lastUi=0;
  onAwake(){
    if(!this.champagne||!this.porcelain||!this.mint||!this.sky||!this.coral){print("[MotionFoundry] Assign all five material inputs.");return;}
    this.candidate={id:"bundled-petal-01",family:"four-bar",parameters:nativeParameters,verification:verifyCandidate(this.input,nativeParameters),score:0,label:"Petal study 01"};this.candidates=[this.candidate];
    this.assembly=new MotionAssembly(this.sceneObject,this.champagne,this.porcelain,this.mint,this.sky,this.coral);this.exportCard=new MotionExportCard(this.sceneObject,this.porcelain);
    const rack=global.scene.createSceneObject("Motion Foundry control rack");rack.setParent(this.sceneObject);rack.getTransform().setLocalPosition(new vec3(0,-13,10));rack.getTransform().setLocalScale(new vec3(1,1,1));this.petalRack=rack;this.ui=rack.createComponent(MotionWorkshopUI.getTypeName()) as MotionWorkshopUI;
    this.ui.onAction.add(action=>this.action(action));this.ui.onPhase.add(value=>{this.playing=false;this.phase=value*Math.PI*2;this.refresh();});this.ui.onEdit.add(value=>this.edit(value));
    const drag=this.assembly.targetHandle.createComponent(DragInteraction.getTypeName()) as DragInteraction;
    let before:Snapshot|null=null;
    drag.onDragStart.add(()=>{this.assembly.draggingTarget=true;before=this.snapshot();this.playing=false;this.mode="pose";this.generation++;this.solving=false;});
    drag.onDragUpdate.add(world=>{const q=this.assembly.root.getTransform().getInvertedWorldTransform().multiplyPoint(world);const angle=Math.max(Math.PI/9,Math.min(17*Math.PI/18,Math.atan2(q.y,q.x-this.candidate.parameters.groundCm)));this.input.targetPoses[this.targetIndex].outputAngleRad=angle;this.message="Pose moved — solve this revision.";this.refresh();});
    drag.onDragEnd.add(()=>{this.assembly.draggingTarget=false;if(before){this.history.push(before);this.input.revision++;before=null;}this.refresh();});
    this.loop=new LoopController(this,this.sceneObject,this.champagne,this.porcelain,this.mint,this.sky,this.coral,this.internet,()=>this.backendUrl,()=>this.setProductMode("petal"));
    this.createEvent("UpdateEvent").bind(()=>{if(!this.modeInitialized){this.modeInitialized=true;this.setProductMode("loop");}if(this.productMode==="loop"){this.loop.tick();return;}if(this.playing)this.phase=(this.phase+getDeltaTime()*.55)%(Math.PI*2);this.assembly.update(this.candidate.parameters,this.input,this.phase,this.reveal,this.targetIndex);if(getTime()-this.lastUi>.1){this.refresh();this.lastUi=getTime();}});
    this.refresh();print("[MotionFoundry] Ready. Loop and Petal modes; centimetres, sampled verification.");
  }
  private setProductMode(mode:"loop"|"petal"){this.productMode=mode;this.assembly.root.enabled=mode==="petal";this.petalRack.enabled=mode==="petal";this.loop.setEnabled(mode==="loop");this.exportCard.hide();this.exportUrl="";if(mode==="petal")this.refresh();}
  private snapshot():Snapshot{return{input:copy(this.input),candidate:copy(this.candidate),candidates:copy(this.candidates),receipt:this.receipt,source:this.source};}
  private checkpoint(){this.history.push(this.snapshot());if(this.history.length>32)this.history.shift();this.generation++;this.solving=false;delete this.input.inputHash;this.input=copy(this.input);this.input.revision++;}
  private edit(value:number){this.checkpoint();if(this.mode==="pose")this.input.targetPoses[this.targetIndex].outputAngleRad=(20+150*value)*Math.PI/180;else if(this.mode==="mount")this.input.fixedMounts.groundCm=12+10*value;else{if(!this.input.obstacles.length)this.input.obstacles=[{id:"space-1",center:{x:-6,y:0},radiusCm:.4,layerZCm:0,depthCm:.4}];this.input.obstacles[0].center.x=-6+12*value;}this.message="Edited — prior result kept for inspection.";this.refresh();}
  private action(action:string){
    if(action==="mode:loop"){this.setProductMode("loop");return;}
    if(action!=="export"){this.exportCard?.hide();this.exportUrl="";}
    if(action==="play")this.playing=!this.playing;
    else if(action==="reveal")this.reveal=!this.reveal;
    else if(action==="pose"){if(this.mode==="pose")this.targetIndex=(this.targetIndex+1)%this.input.targetPoses.length;this.mode="pose";this.phase=this.input.targetPoses[this.targetIndex].phaseRad;this.playing=false;}
    else if(action==="mount")this.mode="mount";
    else if(action==="space"){this.mode="space";if(!this.input.obstacles.length){this.checkpoint();this.input.obstacles=[{id:"space-1",center:{x:-6,y:0},radiusCm:.4,layerZCm:0,depthCm:.4}];this.message="Move the obstacle; then solve.";}}
    else if(action==="solve"){if(this.solving){this.generation++;this.solving=false;this.message="Cancelled. Previous design retained.";}else this.solve();}
    else if(action==="undo"){const past=this.history.pop();if(past){this.generation++;this.solving=false;this.input=past.input;this.candidate=past.candidate;this.candidates=past.candidates;this.receipt=past.receipt;this.source=past.source;this.targetIndex%=this.input.targetPoses.length;this.message="Previous revision restored.";}}
    else if(action==="next"){const i=this.candidates.findIndex(c=>c.id===this.candidate.id);this.candidate=this.candidates[(i+1)%this.candidates.length];this.message=`Alternative ${(i+1)%this.candidates.length+1} of ${this.candidates.length}`;}
    else if(action==="conflict"){this.checkpoint();const revision=this.input.revision;this.input=nativeInput(makeContradictoryInput());this.input.revision=revision;this.targetIndex=0;this.message="Conflicting same-phase targets. Solve to inspect.";}
    else if(action==="export")this.exportDesign();
    this.refresh();
  }
  private async solve(){
    const input=copy(this.input),hash=buildInputHash(input),generation=++this.generation;this.solving=true;this.message="Searching and independently checking…";this.refresh();
    const timeout=this.createEvent("DelayedCallbackEvent");timeout.bind(()=>{if(this.generation===generation&&this.solving){this.generation++;this.solving=false;this.message="Request timed out. Retry or undo.";this.refresh();}});timeout.reset(25);
    try{let result:SolveResult&{receipt?:string};if(!this.backendUrl){result=solveDesign(input);}else{const response=await this.internet.fetch(this.backendUrl.replace(/\/$/,"")+"/api/solve",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify(input)});if(response.status!==200)throw Error("HTTP "+response.status);result=await response.json() as SolveResult&{receipt?:string};}if(generation!==this.generation||hash!==buildInputHash(this.input)||result.inputHash!==hash||result.revision!==this.input.revision)return;
      this.solving=false;if(result.status!=="succeeded"){this.message=result.reason;this.refresh();return;}
      const safe=result.candidates.map(c=>({...c,verification:verifyCandidate(input,c.parameters)})).filter(c=>c.verification.valid);if(!safe.length)throw Error("Returned geometry did not pass local verification");this.candidates=safe;this.candidate=safe[0];this.receipt=result.receipt||"";this.source=this.backendUrl?"HTTPS solve":"Local solve";this.message=`${safe.length} alternative(s). Sampled checks passed.`;print("[MotionFoundry] solved "+JSON.stringify({revision:input.revision,inputHash:hash,parameters:this.candidate.parameters}));
    }catch(error){if(generation===this.generation){this.solving=false;this.message="Connection unavailable. Previous design kept; retry.";print("[MotionFoundry] "+String(error));}}this.refresh();
  }
  private async exportDesign(){
    const expectedHash=buildInputHash(this.input),expectedId=this.candidate.id,expectedGeneration=this.generation;
    if(buildInputHash(this.input)!==this.candidate.verification.inputHash){this.message="Solve the edited revision before exporting.";return;}
    const manifest={format:"motion-foundry/lens-design@1.0",units:{length:"centimetres",angle:"radians"},input:this.input,candidate:this.candidate,source:this.source};global.persistentStorageSystem.store.putString("motion-foundry-last-export",JSON.stringify(manifest));
    if(!this.backendUrl){this.message="Design kept on this device. Connect the companion to create a share link.";this.refresh();return;}
    try{const response=await this.internet.fetch(this.backendUrl.replace(/\/$/,"")+"/api/shares",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify(this.receipt?{receipt:this.receipt,candidateId:this.candidate.id}:{input:this.input,candidate:this.candidate})});if(response.status!==200)throw Error("HTTP "+response.status);const share=await response.json();if(expectedHash!==buildInputHash(this.input)||expectedId!==this.candidate.id||expectedGeneration!==this.generation)return;global.persistentStorageSystem.store.putString("motion-foundry-export-url",share.url);this.exportUrl=share.url;if(share.qr)this.exportCard.show(share.qr.size,share.qr.data);this.message=share.qr?"Scan to download this design + drawing. r"+this.input.revision:"Export link saved. QR exceeds display capacity.";print("[MotionFoundry export] "+share.url);}catch{this.message="Manifest saved locally. Share failed; retry Save.";}this.refresh();
  }
  private refresh(){if(!this.ui||!this.candidate)return;const fresh=buildInputHash(this.input)===this.candidate.verification.inputHash,t=this.input.targetPoses[this.targetIndex];let editLabel=`Pose ${this.targetIndex+1}/${this.input.targetPoses.length}: ${(t.outputAngleRad*180/Math.PI).toFixed(1)}°`,editValue=(t.outputAngleRad*180/Math.PI-20)/150;if(this.mode==="mount"){editLabel=`Mount spacing: ${this.input.fixedMounts.groundCm.toFixed(1)} cm`;editValue=(this.input.fixedMounts.groundCm-12)/10;}if(this.mode==="space"){const x=this.input.obstacles[0]?.center.x??-6;editLabel=`Obstacle x: ${x.toFixed(1)} cm`;editValue=(x+6)/12;}this.ui.setState({status:`${this.solving?"Solving":fresh?this.source:"Edited · previous result"} · r${this.input.revision}`,detail:this.message,editLabel,editValue:Math.max(0,Math.min(1,editValue)),phase:this.phase/(Math.PI*2),playing:this.playing,reveal:this.reveal,metrics:`${fresh?"Current":"Previous"} · 360° input · ${this.candidate.verification.sampleCount} poses\nMax error ${(Math.max(...this.candidate.verification.targetResiduals.map(r=>r.errorRad))*180/Math.PI).toFixed(2)}° · closure ${this.candidate.verification.maxClosureErrorCm.toFixed(4)} cm`});}
  public getStateSnapshot(){if(this.productMode==="loop")return this.loop.getStateSnapshot();return{mode:"petal",revision:this.input.revision,inputHash:buildInputHash(this.input),candidateId:this.candidate?.id,verifiedForCurrentRevision:this.candidate?.verification.inputHash===buildInputHash(this.input),solving:this.solving,phase:this.phase,reveal:this.reveal,status:this.message,parameters:this.candidate?.parameters,exportUrl:this.exportUrl};}
}
