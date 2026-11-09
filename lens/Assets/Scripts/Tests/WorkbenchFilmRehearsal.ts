import {Scenario} from "Leaf.lspkg/Scenarios/scenario/Scenario";
import {ScenarioConfig} from "Leaf.lspkg/Scenarios/scenario/ScenarioConfig";
import {expect} from "Leaf.lspkg/Utils/common/Expect";
import {findSceneObjectByName,sleep} from "Leaf.lspkg/Utils/common/Utils";
import {Interactable} from "SpectaclesInteractionKit.lspkg/Components/Interaction/Interactable/Interactable";
import {WorkbenchPathInteractor} from "./WorkbenchPathInteractor";
import {actionTarget,boardPoint,crankContactPoint,namedTarget,reference,snapshot,WorkbenchSnapshot,observeProductAudio} from "./WorkbenchScenarioTools";

const TAU=Math.PI*2;

import {addBlockingMug,inspectContact} from "./WorkbenchJourney";
import {WorkbenchControlsFilm} from "./WorkbenchControlsFilm";
import {WorkbenchExportFilm} from "./WorkbenchExportFilm";
import {cameraChanged} from "../WorkbenchLayout";

/** Continuous Preview rehearsal with visible synthetic SIK hands and live results. */
@component
export class WorkbenchFilmRehearsal extends Scenario {
  private runId="";
  private startWallMs=0;
  private startRuntime=0;
  private takeWallMs=0;
  private stopped=false;
  private eventNumber=0;

  async run(config?:ScenarioConfig){
    if(!global.deviceInfoSystem.isEditor())throw Error("Film rehearsal is Preview-only");
    this.startWallMs=Date.now();this.startRuntime=getTime();this.runId="motion-rehearsal-"+this.startWallMs;
    this.createEvent("OnDestroyEvent").bind(()=>{this.stopped=true;});
    const leadInMs=this.parameter(config,"lead_in_ms",1000,1000,5000);
    const contactHoldMs=this.parameter(config,"contact_inspect_ms",2000,2000,5000);
    const endingMs=this.parameter(config,"ending_motion_ms",2000,2000,6000);
    const followups=config?.get("followups");
    if(followups&&followups!=="controls-place-send")throw Error("Unknown film-session followups");
    // Installed Logger has no public overlay-reset API. A clean WARN-level runner avoids
    // creating one. Reject a stale panel instead of hiding or editing framework objects.
    for(const name of ["LeafDebugUICamera","LeafDiagnosticReportCamera"]){
      const object=findSceneObjectByName(name);
      if(object?.isEnabledInHierarchy)throw Error("Restart Preview before rehearsal: active LEAF overlay "+name);
    }
    const input=new WorkbenchPathInteractor("Motion filmed SIK rehearsal input");
    const stopAudio=observeProductAudio(this,(event,detail)=>this.stamp(event,detail));
    this.stamp("run-start",{disclosure:"Lens Studio Preview · scripted synthetic SIK hand input · not yet tested on Spectacles",leadInMs,contactHoldMs,endingMs});
    try{
    await reference(input);this.alive();
    const baseline=snapshot();expect(baseline.verification.valid).toBe(true);
    this.takeWallMs=Date.now();this.receipt("take-start-reference",baseline);
    await this.hold("reference-moving-lead-in",leadInMs,true);

    await this.click(input,"draw");
    await this.hold("drawing-surface-ready",250,false);
    // A declared scripted gesture derived from the reference, not a human freehand take.
    const stroke=baseline.input.stroke.map(p=>boardPoint(p.x+.06,p.y));
    stroke.push(stroke[0]);
    const visibleStroke=input.visibleClosedDrawing(stroke);
    this.stamp("scripted-stroke-start",{source:"64 ordered reference-derived points translated +0.06 cm in x; cyclic start at the visible low point, same edges and full closure; automated input",durationMs:10000});
    await this.path(input,namedTarget("Workbench drawing surface"),visibleStroke,10000,"draw");
    expect(snapshot().drawMode).toBe("none");expect(snapshot().snapClosed).toBe(true);
    const drawn=snapshot();expect(drawn.revision).toBe(baseline.revision+1);
    expect(drawn.inputHash).not.toBe(baseline.inputHash);expect(drawn.verifiedForCurrentRevision).toBe(false);
    this.receipt("snap-close-committed",drawn);
    await this.hold("inspect-snap-closure",500,false);
    await this.click(input,"solve");
    const first=await this.awaitSolve("drawn-loop",drawn);
    await this.hold("inspect-new-machine",800,true);

    const crank=namedTarget("Workbench crank knob");
    const gripStart=snapshot(),height=crank.getTransform().getLocalPosition().z;
    const crankPath=()=>{const current=snapshot();return Array.from({length:97},(_,i)=>{
      const angle=current.phase+current.driveDirection*2.6*i/96;
      return crankContactPoint(current.parameters.crankCm*Math.cos(angle),current.parameters.crankCm*Math.sin(angle),height);
    });};
    await this.path(input,crank,crankPath,4000,"crank");
    const turned=snapshot();expect(Math.abs(turned.phase-gripStart.phase)).toBeGreaterThan(2);
    expect(turned.inputHash).toBe(first.inputHash);expect(turned.playing).toBe(true);
    this.stamp("deliberate-crank-complete",{phaseChange:turned.phase-gripStart.phase,inkPoints:turned.inkPointCount});
    await this.fullCycle("drawn-loop-full-ink-cycle",turned);
    await this.hold("drawn-loop-moving-payoff",500,true);
    await this.nearInspection(first);

    this.stamp("same-drawing-mug-addition",{drawnInputHash:first.inputHash});
    const blocked=await addBlockingMug(input,first,()=>this.alive(),(event,detail)=>this.stamp(event,detail));
    await inspectContact(input,blocked,5000,()=>this.alive(),contactHoldMs);
    this.receipt("same-drawing-mug-contact",snapshot());

    await this.click(input,"solve");
    const repaired=await this.awaitSolve("same-drawing-mug-repair",blocked);
    expect(repaired.parameters.crankCm).toBeLessThan(blocked.parameters.crankCm);
    expect(repaired.verification.minClearanceCm).toBeGreaterThan(0);
    this.stamp("same-drawing-input-repaired",{blockedInputHash:blocked.inputHash,repairedInputHash:repaired.inputHash,oldCrankCm:blocked.parameters.crankCm,newCrankCm:repaired.parameters.crankCm});
    await this.fullCycle("repaired-full-clear-cycle",repaired);
    await this.hold("repaired-moving-ending",endingMs,true);

    const final=snapshot(),audio=final.audio;
    expect(audio.failed).toBe(false);
    if(audio.configured.tick&&audio.configured.contact&&audio.configured.clear){
      expect(audio.voiceCount).toBe(3);expect(audio.tick).toBeGreaterThan(0);expect(audio.contact).toBeGreaterThan(0);expect(audio.clear).toBeGreaterThan(0);
    }
    const duration=(Date.now()-this.takeWallMs)/1000;
    expect(duration,"The main take must preserve at least 83.6 seconds of genuine work, inspection and full cycles; never pad a short take").toBeGreaterThan(83.599);
    this.stamp("take-complete",{durationSeconds:duration,minimumContinuousSeconds:83.6,meetsMinimumContinuousDuration:duration>=83.6,audio,source:"Live HTTPS results and independent local verification",disclosure:"Automated Preview rehearsal; scheduled audio is not an acoustic measurement"});
    if(followups){
      // One scenario, one actual synthetic hand, one LEAF manager lifecycle.
      // Preview is not restarted between the primary journey and these actions.
      const controls=new WorkbenchControlsFilm((event,detail)=>this.stamp(event,detail),()=>this.alive());
      await controls.run(input,"controls");
      const current=snapshot();
      expect(current.input.stroke).toEqual(final.input.stroke);
      expect(current.input.fixedMounts).toEqual(final.input.fixedMounts);
      expect(current.input.tolerances).toEqual(final.input.tolerances);
      expect(current.input.obstacles).toEqual(final.input.obstacles);
      await controls.run(input,"place");
      await new WorkbenchExportFilm((event,detail)=>this.stamp(event,detail),()=>this.alive()).run(input);
      this.receipt("session-complete",snapshot());
      this.stamp("session-complete:audio",snapshot().audio);
    }
    }finally{try{await input.teardown();}finally{stopAudio();}}
  }

  private alive(){if(this.stopped)throw Error("Rehearsal stopped");}
  private parameter(config:ScenarioConfig|undefined,key:string,fallback:number,min:number,max:number){
    const raw=config?.get(key);if(raw===undefined)return fallback;
    const value=Number(raw);if(!Number.isFinite(value)||value<min||value>max)throw Error(key+" must be between "+min+" and "+max+" ms");
    return value;
  }
  private stamp(event:string,detail:unknown={}){
    const now=Date.now();
    print("[MotionFoundry rehearsal] "+JSON.stringify({runId:this.runId,eventNumber:++this.eventNumber,event,wallEpochMs:now,runElapsedMs:now-this.startWallMs,takeElapsedMs:this.takeWallMs?now-this.takeWallMs:null,runtimeSeconds:getTime(),runtimeElapsedSeconds:getTime()-this.startRuntime,detail}));
  }
  private receipt(event:string,state:WorkbenchSnapshot){
    this.stamp(event,{source:state.source,revision:state.revision,inputHash:state.inputHash,candidateId:state.candidateId,serverReceiptPresent:state.hasReceipt,phase:state.phase,driveDirection:state.driveDirection,playing:state.playing,inkPoints:state.inkPointCount});
    this.stamp(event+":input",state.input);
    this.stamp(event+":mechanism",state.parameters);
    this.stamp(event+":verification",state.verification);
  }
  private watch(target:Interactable,label:string){
    const targetName=target.getSceneObject().name;
    const off=[
      target.onTriggerStart.add(()=>this.stamp("sik-trigger-start",{action:label,target:targetName})),
      target.onTriggerEnd.add(()=>this.stamp("sik-trigger-end",{action:label,target:targetName})),
      target.onDragStart.add(()=>this.stamp("sik-drag-start",{action:label,target:targetName})),
      target.onDragEnd.add(()=>this.stamp("sik-drag-end",{action:label,target:targetName})),
      target.onTriggerCanceled.add(()=>this.stamp("sik-trigger-cancelled",{action:label,target:targetName})),
    ];
    return()=>off.forEach(unsubscribe=>unsubscribe());
  }
  private async click(input:WorkbenchPathInteractor,id:string){
    this.alive();const target=actionTarget(id),unwatch=this.watch(target,id);
    this.stamp("action-intent",{action:id,label:snapshot().actions.find(a=>a.id===id)?.label});
    try{await input.trigger(target);await sleep(180);this.alive();}
    finally{unwatch();}
    this.stamp("action-observed",{action:id,revision:snapshot().revision,inputHash:snapshot().inputHash,solving:snapshot().solving});
  }
  private async path(input:WorkbenchPathInteractor,target:Interactable,points:vec3[]|(()=>vec3[]),durationMs:number,label:string){
    const unwatch=this.watch(target,label);this.stamp("input-path-intent",{action:label,requestedDurationMs:durationMs});
    try{await input.followTimedPath(target,points,durationMs,()=>this.alive());}
    finally{unwatch();}
    this.stamp("input-path-observed",{action:label});
  }
  private async hold(reason:string,durationMs:number,mustMove:boolean){
    const before=snapshot(),end=Date.now()+durationMs;this.stamp("observation-start",{reason,durationMs,mustMove});
    while(Date.now()<end){this.alive();await sleep(100);}
    if(mustMove){const after=snapshot();expect(after.playing).toBe(true);expect(Math.abs(after.phase-before.phase)).toBeGreaterThan(.1);expect(after.inputHash).toBe(before.inputHash);}
    this.stamp("observation-complete",{reason,phase:snapshot().phase,inkPoints:snapshot().inkPointCount});
  }
  private async awaitSolve(label:string,requested:WorkbenchSnapshot){
    const end=Date.now()+33000;this.stamp("real-solve-wait",{case:label,inputHash:requested.inputHash});
    while(snapshot().solving&&Date.now()<end){this.alive();await sleep(100);}
    this.alive();const result=snapshot();expect(result.solving).toBe(false);
    expect(result.source).toBe("HTTPS solve");expect(result.verifiedForCurrentRevision).toBe(true);expect(result.hasReceipt).toBe(true);
    expect(result.verification.valid).toBe(true);expect(JSON.stringify(result.input)).toBe(JSON.stringify(requested.input));
    expect(result.verification.inputHash).toBe(requested.inputHash);expect(result.verification.maxFitErrorCm).toBeLessThan(result.input.tolerances.fitCm+1e-9);
    this.receipt(label+":live-result",result);return result;
  }
  private async nearInspection(expected:WorkbenchSnapshot){
    const before=snapshot(),durationMs=15500,start=Date.now(),end=start+durationMs;
    let observedNear=false,readableMs=0,previous=Date.now(),recorded=false;
    this.stamp("near-inspection:start",{durationMs,camera:before.projection.camera,inputHash:expected.inputHash,instruction:"Root moves the real Preview camera near, holds readable rod lengths/gap, and returns to this working pose. This test never assigns camera or product state."});
    while(Date.now()<end){
      this.alive();await sleep(100);const state=snapshot(),now=Date.now(),dt=now-previous;previous=now;
      expect(state.inputHash).toBe(expected.inputHash);expect(state.candidateId).toBe(expected.candidateId);
      expect(state.verifiedForCurrentRevision).toBe(true);expect(state.playing).toBe(true);
      const lengths=state.projection.labels.filter(l=>l.id.startsWith("rod")&&l.opacity>.8&&l.overlaps.length===0);
      const fit=state.projection.labels.some(l=>l.id==="fit"&&l.opacity>.8&&l.overlaps.length===0);
      if(state.distanceBand==="near")observedNear=true;
      if(state.distanceBand==="near"&&lengths.length>=2&&fit){
        readableMs+=dt;
        if(!recorded){recorded=true;this.stamp("near-inspection:readable",{camera:state.projection.camera,labels:state.projection.labels,phase:state.phase,matchProgress:state.matchProgress});}
      }
    }
    const after=snapshot();
    expect(observedNear,"A real camera approach must enter the near band").toBe(true);
    expect(readableMs,"Near inspection needs two visible length plates and the computed gap for at least six seconds").toBeGreaterThan(5999);
    expect(after.distanceBand).toBe("middle");
    expect(cameraChanged(before.projection.camera,after.projection.camera),"Return the actual camera to the working pose before mug contact").toBe(false);
    this.stamp("near-inspection:end",{durationMs:Date.now()-start,readableMs,observedNear,camera:after.projection.camera,inputHash:after.inputHash,phaseAdvance:after.phase-before.phase});
  }
  private async fullCycle(label:string,expected:WorkbenchSnapshot){
    const start=snapshot(),wallStart=Date.now(),deadline=wallStart+35000;
    let quarter=0,lastPhase=start.phase;
    expect(start.playing).toBe(true);this.stamp(label+":start",{phase:start.phase,inputHash:start.inputHash,inkPoints:start.inkPointCount});
    while(true){
      this.alive();const current=snapshot();
      expect(current.inputHash).toBe(expected.inputHash);expect(current.candidateId).toBe(expected.candidateId);
      expect(current.playing).toBe(true);expect(current.verifiedForCurrentRevision).toBe(true);
      expect((current.phase-lastPhase)*current.driveDirection).toBeGreaterThan(-1e-6);lastPhase=current.phase;
      const progress=(current.phase-start.phase)*current.driveDirection;
      while(quarter<4&&progress>=(quarter+1)*Math.PI/2){quarter++;this.stamp(label+":quarter",{quarter,phase:current.phase,advanceRad:progress,inkPoints:current.inkPointCount});}
      if(progress>=TAU){expect(current.inkPointCount).toBeGreaterThan(1);expect(current.matchProgress.complete).toBe(true);this.stamp(label+":complete",{durationMs:Date.now()-wallStart,startPhase:start.phase,endPhase:current.phase,advanceRad:progress,inkPoints:current.inkPointCount,matchProgress:current.matchProgress});return;}
      if(Date.now()>deadline)throw Error("Actual full crank cycle did not complete: "+label);
      await sleep(80);
    }
  }
}
