import {Scenario} from "Leaf.lspkg/Scenarios/scenario/Scenario";
import {ScenarioConfig} from "Leaf.lspkg/Scenarios/scenario/ScenarioConfig";
import {expect} from "Leaf.lspkg/Utils/common/Expect";
import {findSceneObjectByName,nextFrame,sleep} from "Leaf.lspkg/Utils/common/Utils";
import {Interactable} from "SpectaclesInteractionKit.lspkg/Components/Interaction/Interactable/Interactable";
import {InteractorTriggerType} from "SpectaclesInteractionKit.lspkg/Core/Interactor/Interactor";
import WorldCameraFinderProvider from "SpectaclesInteractionKit.lspkg/Providers/CameraProvider/WorldCameraFinderProvider";
import {WorkbenchPathInteractor} from "./WorkbenchPathInteractor";
import {actionTarget,boardPoint,namedTarget,reference,snapshot,WorkbenchSnapshot} from "./WorkbenchScenarioTools";

const TAU=Math.PI*2;

/** Same LEAF→SIK input route as QA, paced in real runtime seconds. No product handlers. */
class RehearsalInput extends WorkbenchPathInteractor {
  async followTimedPath(target:Interactable,points:vec3[],durationMs:number,alive:()=>void){
    if(points.length<2||durationMs<1000)throw Error("Rehearsal path needs points and a deliberate duration");
    const distances=[0];
    for(let i=1;i<points.length;i++)distances.push(distances[i-1]+points[i].distance(points[i-1]));
    const length=distances[distances.length-1];if(!(length>0))throw Error("Rehearsal path has no length");
    await this.enterHover(target);alive();
    this.startPoint=WorldCameraFinderProvider.getInstance().getWorldPosition();
    this.endPoint=points[0];await nextFrame();await nextFrame();alive();
    this.setTriggerType(InteractorTriggerType.Select);await nextFrame();await nextFrame();alive();
    const start=getTime(),end=start+durationMs/1000;
    let segment=1,previous=points[0];
    try{
      while(true){
        alive();const fraction=Math.min(1,(getTime()-start)/(end-start)),distance=fraction*length;
        while(segment<points.length-1&&distances[segment]<distance)segment++;
        const span=distances[segment]-distances[segment-1];
        const t=span>0?(distance-distances[segment-1])/span:1;
        const point=points[segment-1].add(points[segment].sub(points[segment-1]).uniformScale(t));
        this.overrideDragVector=point.sub(previous);this.endPoint=point;previous=point;
        await nextFrame();
        if(fraction>=1)break;
      }
    }finally{
      this.setTriggerType(InteractorTriggerType.None);await nextFrame();await nextFrame();
      this.overrideDragVector=undefined;this.overrideInteractable=undefined;this.resetStartEndPoint();await nextFrame();
    }
  }
}

/**
 * Preview-only automated rehearsal. The second Study loads its own reference drawing;
 * unchanged-input repair applies ONLY from that blocked Study to its fresh result.
 */
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
    const leadInMs=this.parameter(config,"lead_in_ms",3500,1000,5000);
    const contactHoldMs=this.parameter(config,"contact_inspect_ms",3500,2000,5000);
    const endingMs=this.parameter(config,"ending_motion_ms",3500,2000,6000);
    // Installed Logger has no public overlay-reset API. A clean WARN-level runner avoids
    // creating one. Reject a stale panel instead of hiding or editing framework objects.
    for(const name of ["LeafDebugUICamera","LeafDiagnosticReportCamera"]){
      const object=findSceneObjectByName(name);
      if(object?.isEnabledInHierarchy)throw Error("Restart Preview before rehearsal: active LEAF overlay "+name);
    }
    const input=new RehearsalInput("Motion filmed SIK rehearsal input");
    this.stamp("run-start",{disclosure:"Automated Preview SIK CustomController input; no rendered hands or physical tracking",leadInMs,contactHoldMs,endingMs});
    await reference(input);this.alive();
    const baseline=snapshot();expect(baseline.verification.valid).toBe(true);
    this.takeWallMs=Date.now();this.receipt("take-start-reference",baseline);
    await this.hold("reference-moving-lead-in",leadInMs,true);

    await this.click(input,"draw");
    await this.hold("drawing-surface-ready",800,false);
    // A declared scripted gesture derived from the reference, not a human freehand take.
    const stroke=baseline.input.stroke.slice(0,59).map(p=>boardPoint(p.x+.06,p.y));
    this.stamp("scripted-stroke-start",{source:"59 ordered reference points translated +0.06 cm in x; final gap deliberately open",durationMs:10000});
    await this.path(input,namedTarget("Workbench drawing surface"),stroke,10000,"draw");
    const open=snapshot();expect(open.drawMode).toBe("open");
    this.stamp("open-stroke-visible",{rawPointCount:open.draftPointCount});
    await this.hold("inspect-open-endpoints",1400,false);
    await this.click(input,"done");
    const drawn=snapshot();expect(drawn.revision).toBe(baseline.revision+1);
    expect(drawn.inputHash).not.toBe(baseline.inputHash);expect(drawn.verifiedForCurrentRevision).toBe(false);
    this.receipt("explicit-close-committed",drawn);
    await this.hold("inspect-explicit-closure",1500,false);
    await this.click(input,"solve");
    const first=await this.awaitSolve("drawn-loop",drawn);
    await this.hold("inspect-new-machine",2400,true);

    const crank=namedTarget("Workbench crank knob");
    await input.hover(crank,650);this.alive();
    const gripStart=snapshot(),height=crank.getTransform().getLocalPosition().z;
    const crankPath=Array.from({length:97},(_,i)=>{
      const angle=gripStart.phase+gripStart.driveDirection*2.6*i/96;
      return boardPoint(gripStart.parameters.crankCm*Math.cos(angle),gripStart.parameters.crankCm*Math.sin(angle),height);
    });
    await this.path(input,crank,crankPath,4000,"crank");
    const turned=snapshot();expect(Math.abs(turned.phase-gripStart.phase)).toBeGreaterThan(2);
    expect(turned.inputHash).toBe(first.inputHash);expect(turned.playing).toBe(true);
    this.stamp("deliberate-crank-complete",{phaseChange:turned.phase-gripStart.phase,inkPoints:turned.inkPointCount});
    await this.fullCycle("drawn-loop-full-ink-cycle",turned);
    await this.hold("drawn-loop-moving-payoff",2000,true);

    this.stamp("second-case-navigation-start",{instruction:"Study loads a separate supplied reference drawing; this is not an obstacle added to the preceding drawn input",drawnInputHash:first.inputHash});
    await this.click(input,"more");await this.click(input,"study");
    const blocked=snapshot();
    expect(JSON.stringify(blocked.input.stroke)).not.toBe(JSON.stringify(first.input.stroke));
    expect(blocked.verification.valid).toBe(false);expect(blocked.verification.collisionWitness?.geometry).toBe("crank");
    expect(blocked.verification.collisionWitness!.marginCm+blocked.input.clearanceCm,"Study must physically overlap, not merely miss a requested gap").toBeLessThan(0);
    expect(blocked.input.obstacles[0].depthCm).toBe(4);expect(blocked.input.obstacles[0].radiusCm).toBe(4.5);
    this.receipt("second-case-provided-container-contact",blocked);
    await this.hold("inspect-provided-container-contact",contactHoldMs,false);
    await this.click(input,"solve");
    const repaired=await this.awaitSolve("provided-container-repair",blocked);
    expect(repaired.parameters.crankCm).toBeLessThan(blocked.parameters.crankCm);
    expect(repaired.verification.minClearanceCm).toBeGreaterThan(0);
    this.stamp("same-study-input-repaired",{blockedInputHash:blocked.inputHash,repairedInputHash:repaired.inputHash,oldCrankCm:blocked.parameters.crankCm,newCrankCm:repaired.parameters.crankCm});
    await this.fullCycle("repaired-full-clear-cycle",repaired);
    await this.hold("repaired-moving-ending",endingMs,true);

    const final=snapshot(),audio=final.audio;
    expect(audio.failed).toBe(false);
    if(audio.configured.tick&&audio.configured.contact&&audio.configured.clear){
      expect(audio.voiceCount).toBe(3);expect(audio.tick).toBeGreaterThan(0);expect(audio.contact).toBeGreaterThan(0);expect(audio.clear).toBeGreaterThan(0);
    }
    const duration=(Date.now()-this.takeWallMs)/1000;
    this.stamp("take-complete",{durationSeconds:duration,targetSeconds:[65,80],withinTimingTarget:duration>=65&&duration<=80,audio,source:"Live HTTPS results and independent local verification",disclosure:"Automated Preview rehearsal; scheduled audio is not an acoustic measurement"});
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
  private async click(input:RehearsalInput,id:string){
    this.alive();const target=actionTarget(id),unwatch=this.watch(target,id);
    this.stamp("action-intent",{action:id,label:snapshot().actions.find(a=>a.id===id)?.label});
    try{await input.hover(target,650);this.alive();await input.trigger(target);await sleep(180);this.alive();}
    finally{unwatch();}
    this.stamp("action-observed",{action:id,revision:snapshot().revision,inputHash:snapshot().inputHash,solving:snapshot().solving});
  }
  private async path(input:RehearsalInput,target:Interactable,points:vec3[],durationMs:number,label:string){
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
      if(progress>=TAU){expect(current.inkPointCount).toBeGreaterThan(1);this.stamp(label+":complete",{durationMs:Date.now()-wallStart,startPhase:start.phase,endPhase:current.phase,advanceRad:progress,inkPoints:current.inkPointCount});return;}
      if(Date.now()>deadline)throw Error("Actual full crank cycle did not complete: "+label);
      await sleep(80);
    }
  }
}
