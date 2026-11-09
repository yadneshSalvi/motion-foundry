import {Scenario} from "Leaf.lspkg/Scenarios/scenario/Scenario";
import {ScenarioConfig} from "Leaf.lspkg/Scenarios/scenario/ScenarioConfig";
import {expect} from "Leaf.lspkg/Utils/common/Expect";
import {sleep} from "Leaf.lspkg/Utils/common/Utils";
import {WorkbenchPathInteractor} from "./WorkbenchPathInteractor";
import {WorkbenchControlsFilm} from "./WorkbenchControlsFilm";
import {WorkbenchExportFilm} from "./WorkbenchExportFilm";
import {addBlockingMug} from "./WorkbenchJourney";
import {action,evidence,reference,snapshot,waitForResult} from "./WorkbenchScenarioTools";

/** Bounded follow-up risk probe. It uses the real visible bundled reference,
 * real SIK controls and HTTPS responses. This is QA, never final F14 footage. */
@component
export class WorkbenchSupportSmoke extends Scenario {
  private stopped=false;
  private alive(){if(this.stopped)throw Error("Support smoke stopped");}
  async run(config?:ScenarioConfig){
    if(!global.deviceInfoSystem.isEditor())throw Error("Support smoke is Preview-only");
    this.createEvent("OnDestroyEvent").bind(()=>{this.stopped=true;});
    const mode=config?.get("mode")||"mount";
    if(mode!=="mount"&&mode!=="controls-send")throw Error("Unknown support smoke mode");
    const hand=new WorkbenchPathInteractor("Motion bounded support visibility hand");
    const stamp=(event:string,detail?:unknown)=>evidence("support-smoke:"+event,{wallEpochMs:Date.now(),detail});
    const flow=new WorkbenchControlsFilm(stamp,()=>this.alive());
    try{
      await reference(hand);const baseline=snapshot();
      stamp("start",{mode,inputHash:baseline.inputHash,scope:"Visible reference-derived QA; no same-drawing film claim"});
      if(mode==="mount"){
        let running=true,failure:unknown=null,readableMs=0,last=Date.now(),samples=0;
        const probe=flow.probeMount(hand).catch(error=>{failure=error;}).finally(()=>{running=false;});
        while(running){
          await sleep(100);this.alive();const now=Date.now(),state=snapshot();
          if(state.editing==="mount"){
            const label=state.projection.labels.find(l=>l.id==="mount");
            if(label&&label.opacity>.8&&label.overlaps.length===0)readableMs+=now-last;
            if(samples++%5===0)stamp("mount-live-value",{valueCm:state.input.fixedMounts.groundCm,label:label||null,
              gestureOccluders:state.projection.gestureOccluders,unavailable:state.projection.unavailable});
          }
          last=now;
        }
        await probe;if(failure)throw failure;
        expect(readableMs,"Read the mount value during the real drag, as well as at its held endpoint").toBeGreaterThan(600);
        stamp("mount-visible-complete",{readableMs,samples,inputHash:snapshot().inputHash});
      }else{
        const blocked=await addBlockingMug(hand,baseline,()=>this.alive(),stamp);
        await action(hand,"solve");const solved=await waitForResult(33,()=>this.alive());
        expect(solved.input).toEqual(blocked.input);expect(solved.source).toBe("HTTPS solve");
        expect(solved.hasReceipt).toBe(true);expect(solved.verifiedForCurrentRevision).toBe(true);expect(solved.verification.valid).toBe(true);
        stamp("reference-https-repair",{input:solved.input,inputHash:solved.inputHash,parameters:solved.parameters,verification:solved.verification});
        await flow.run(hand,"controls");
        await new WorkbenchExportFilm(stamp,()=>this.alive()).run(hand);
        const shared=snapshot();expect(shared.projection.dockSafe).toBe(true);
        // One entry is expected for the visible Back control. Each entry lists
        // its actual subject collisions; the array itself is not a hit list.
        expect(shared.projection.dockOverlaps.length).toBeGreaterThan(0);
        expect(shared.projection.dockOverlaps.every(control=>control.overlaps.length===0)).toBe(true);
        stamp("controls-and-current-qr-complete",{inputHash:shared.inputHash,qr:shared.qr,projection:shared.projection,
          scope:"Native functions/layout passed; full-pixel QR decode and hand/readout review remain required"});
      }
    }finally{await hand.teardown();}
  }
}
