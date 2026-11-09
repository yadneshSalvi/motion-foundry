import {Scenario} from "Leaf.lspkg/Scenarios/scenario/Scenario";
import {ScenarioConfig} from "Leaf.lspkg/Scenarios/scenario/ScenarioConfig";
import {expect} from "Leaf.lspkg/Utils/common/Expect";
import {findSceneObjectByName,sleep} from "Leaf.lspkg/Utils/common/Utils";
import {dialAngleFromFit} from "../WorkbenchGeometry";
import {WorkbenchPathInteractor} from "./WorkbenchPathInteractor";
import {action,actionTarget,boardPoint,namedTarget,snapshot,waitForResult,observeProductAudio} from "./WorkbenchScenarioTools";

/** Separate hand controls / real WorldQuery / opening takes. No fixture or pose injection. */
@component
export class WorkbenchControlsFilm extends Scenario {
  private stopped=false;
  private startWall=0;
  private mode="";
  private runId="";
  private eventNumber=0;
  private alive=()=>{if(this.stopped)throw Error("Controls film stopped");};
  private stamp(event:string,detail:unknown={}){
    print("[MotionFoundry controls film] "+JSON.stringify({runId:this.runId,eventNumber:++this.eventNumber,event,mode:this.mode,wallEpochMs:Date.now(),elapsedMs:Date.now()-this.startWall,runtimeSeconds:getTime(),detail}));
  }
  private receipt(event:string){
    const s=snapshot();this.stamp(event,{source:s.source,input:s.input,inputHash:s.inputHash,parameters:s.parameters,candidateId:s.candidateId,verification:s.verification,verifiedForCurrentRevision:s.verifiedForCurrentRevision,serverReceiptPresent:s.hasReceipt,placement:s.placement,audio:s.audio});
  }
  async run(config?:ScenarioConfig){
    if(!global.deviceInfoSystem.isEditor())throw Error("Controls filming is Preview-only");
    this.mode=config?.get("mode")||"controls";this.startWall=Date.now();this.runId="motion-controls-"+this.mode+"-"+this.startWall;this.eventNumber=0;
    this.createEvent("OnDestroyEvent").bind(()=>{this.stopped=true;});
    for(const name of ["LeafDebugUICamera","LeafDiagnosticReportCamera"]){
      if(findSceneObjectByName(name)?.isEnabledInHierarchy)throw Error("Active LEAF capture overlay: "+name);
    }
    const initial=snapshot();
    if(initial.solving||initial.sharing||initial.drawMode!=="none"||initial.editing||initial.cranking)
      throw Error("Finish the active action before starting a controls take");
    const input=new WorkbenchPathInteractor("Motion controls synthetic SIK hand");
    const stopAudio=observeProductAudio(this,(event,detail)=>this.stamp(event,detail));
    this.stamp("start",{disclosure:"Lens Studio Preview · scripted synthetic hand input · not yet tested on Spectacles"});this.receipt("initial");
    try{
      if(this.mode==="controls")await this.controls(input);
      else if(this.mode==="fit"){await this.fit(input);await this.makeCurrent(input,snapshot());}
      else if(this.mode==="mug"){await this.mug(input);await this.makeCurrent(input,snapshot());}
      else if(this.mode==="mount"){await this.mount(input);}
      else if(this.mode==="place")await this.place(input);
      else if(this.mode==="opening")await this.opening(input);
      else throw Error("Unknown controls film mode: "+this.mode);
      this.receipt("complete");
    }finally{try{await input.teardown();}finally{stopAudio();}}
  }
  private async path(input:WorkbenchPathInteractor,name:string,points:vec3[],ms:number){
    this.stamp("gesture-start",{target:name,durationMs:ms});
    await input.followTimedPath(namedTarget(name),points,ms,this.alive);this.alive();
    this.receipt("gesture-end:"+name);
  }
  private async controls(input:WorkbenchPathInteractor){
    const original=snapshot();
    expect(original.input.tolerances.fitCm,"Start at the actual 3 mm fit limit").toBe(.3);
    await this.fit(input);await this.mug(input);await this.mount(input);
    const requested=snapshot();
    expect(requested.input.stroke).toEqual(original.input.stroke);
    expect(requested.input.fixedMounts).toEqual(original.input.fixedMounts);
    expect(requested.input.tolerances).toEqual(original.input.tolerances);
    expect(requested.input.obstacles[0].radiusCm).toBe(4.5);
    expect(requested.input).toEqual({...original.input,revision:requested.input.revision,obstacles:requested.input.obstacles});
    if(original.input.obstacles.length)expect(requested.input.obstacles).toEqual(original.input.obstacles);
    // Fit/rim edits invalidate receipt freshness even when their final values return.
    expect(requested.verifiedForCurrentRevision).toBe(false);
    await this.makeCurrent(input,requested);
  }
  private async fit(input:WorkbenchPathInteractor){
    expect(snapshot().input.tolerances.fitCm).toBe(.3);
    // Touch the outer dial face and turn its true 270-degree mapping, in both directions.
    for(const [from,to] of [[.3,.2],[.2,.3]]){
      const a=dialAngleFromFit(from),b=dialAngleFromFit(to),r=1.35;
      const points=Array.from({length:49},(_,i)=>{const t=a+(b-a)*i/48;return boardPoint(21+r*Math.cos(t),-4.4+r*Math.sin(t),1.2);});
      await this.path(input,"Workbench fit dial",points,2400);
      expect(snapshot().input.tolerances.fitCm).toBe(to);await this.observe(700);
    }
  }
  private async mug(input:WorkbenchPathInteractor){
    const beforeMug=snapshot();
    if(!beforeMug.input.obstacles.length){
      this.stamp("mug-add-start");await input.trigger(namedTarget("Workbench measured keep-out"));this.alive();this.receipt("mug-add-end");
    }
    let mug=snapshot().input.obstacles[0];
    expect(mug.radiusCm,"Start with the default measured 4.5 cm mug ring").toBe(4.5);
    const fixedMug={...mug,center:{...mug.center}};
    for(const radius of [5,4.5]){
      mug=snapshot().input.obstacles[0];
      const from=boardPoint(mug.center.x,mug.center.y-mug.radiusCm,(mug.layerZCm||2)+(mug.depthCm||4)/2);
      const to=boardPoint(mug.center.x,mug.center.y-radius,(mug.layerZCm||2)+(mug.depthCm||4)/2);
      await this.path(input,"Workbench mug size handle",[from,to],2200);
      expect(snapshot().input.obstacles[0]).toEqual({...fixedMug,radiusCm:radius});await this.observe(700);
    }
  }
  private async mount(input:WorkbenchPathInteractor){
    const beforeMount=snapshot(),mount=namedTarget("Workbench movable mount").getTransform().getWorldPosition();
    const delta=boardPoint(1,0,.7).sub(boardPoint(0,0,.7));
    await this.path(input,"Workbench movable mount",[mount,mount.add(delta)],2200);
    expect(snapshot().input.fixedMounts.groundCm).toBe(beforeMount.input.fixedMounts.groundCm+1);
    expect(snapshot().undoChipVisible).toBe(true);
    this.stamp("undo-chip-start");await input.trigger(namedTarget("Workbench undo chip"));this.alive();
    expect(snapshot().input).toEqual(beforeMount.input);expect(snapshot().parameters).toEqual(beforeMount.parameters);
    this.receipt("undo-chip-end");
  }
  private async makeCurrent(input:WorkbenchPathInteractor,requested:ReturnType<typeof snapshot>){
    this.stamp("real-https-solve-start",{inputHash:requested.inputHash});
    await action(input,"solve");this.alive();const result=await waitForResult(33,this.alive);
    expect(result.input).toEqual(requested.input);expect(result.source).toBe("HTTPS solve");
    expect(result.hasReceipt).toBe(true);expect(result.verifiedForCurrentRevision).toBe(true);
    expect(result.verification.valid).toBe(true);expect(result.verification.inputHash).toBe(requested.inputHash);
    this.receipt("real-https-solve-complete");await this.observe(1600);
  }
  private async place(input:WorkbenchPathInteractor){
    const before=snapshot();
    if(before.uiPage!=="more"){await action(input,"more");this.alive();}
    this.stamp("place-action-start");await action(input,"place");this.alive();
    expect(snapshot().placement.mode).toBe("placing");
    const deadline=getTime()+20;this.stamp("worldquery-wait-start");
    while(!snapshot().actions.some(a=>a.id==="place:commit")){
      this.alive();if(getTime()>deadline)throw Error("No genuine WorldQuery table hit within 20 seconds; root must aim the camera at a real Preview table");await sleep(80);
    }
    const hit=snapshot().placement.hit;expect(hit).not.toBeNull();
    this.stamp("worldquery-hit",snapshot().placement);
    // Current genuine hit is re-checked by the product at the actual SIK release.
    await input.trigger(actionTarget("place:commit"));this.alive();await sleep(180);
    const placed=snapshot();expect(placed.placement.mode).toBe("surface");
    expect(placed.placement.source).toBe("WorldQuery table placement");
    expect(placed.placement.commits).toBe(before.placement.commits+1);
    expect(placed.input).toEqual(before.input);
    expect(placed.tableWorldPosition.x).toBeCloseTo(placed.placement.hit!.x,3);
    expect(placed.tableWorldPosition.y).toBeCloseTo(placed.placement.hit!.y+.5,3);
    expect(placed.tableWorldPosition.z).toBeCloseTo(placed.placement.hit!.z,3);
    this.receipt("worldquery-real-commit");await this.observe(1800);
  }
  private async opening(input:WorkbenchPathInteractor){
    const before=snapshot();expect(before.verifiedForCurrentRevision).toBe(true);expect(before.verification.valid).toBe(true);
    const target=namedTarget("Workbench crank knob"),height=target.getTransform().getLocalPosition().z;
    const phase=before.phase,r=before.parameters.crankCm;
    const points=Array.from({length:97},(_,i)=>{const t=phase+before.driveDirection*2.8*i/96;return boardPoint(r*Math.cos(t),r*Math.sin(t),height);});
    await this.path(input,"Workbench crank knob",points,4500);
    const after=snapshot();expect(after.input).toEqual(before.input);expect(after.candidateId).toBe(before.candidateId);
    expect(after.inkPointCount).toBeGreaterThan(1);expect(Math.abs(after.phase-before.phase)).toBeGreaterThan(2);
    expect(after.audio.tick).toBeGreaterThan(before.audio.tick);await this.observe(2000);
  }
  private async observe(ms:number){
    const deadline=getTime()+ms/1000;
    while(getTime()<deadline){this.alive();await sleep(80);}
  }
}
