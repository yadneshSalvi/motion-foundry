import {Scenario} from "Leaf.lspkg/Scenarios/scenario/Scenario";
import {expect} from "Leaf.lspkg/Utils/common/Expect";
import {findSceneObjectByName,sleep} from "Leaf.lspkg/Utils/common/Utils";
import {WorkbenchPathInteractor} from "./WorkbenchPathInteractor";
import {action,snapshot,evidence,observeProductAudio} from "./WorkbenchScenarioTools";

/** Continue the actual verified Round 3 design. No fixed historical hash or fixture install. */
@component
export class WorkbenchExportFilm extends Scenario {
  private stopped=false;
  private runId="";
  private eventNumber=0;
  private stamp(event:string,detail:unknown){
    print("[MotionFoundry export film] "+JSON.stringify({runId:this.runId,eventNumber:++this.eventNumber,event,wallEpochMs:Date.now(),runtimeSeconds:getTime(),detail}));
  }
  async run(){
    if(!global.deviceInfoSystem.isEditor())throw Error("Export capture is Preview-only");
    this.createEvent("OnDestroyEvent").bind(()=>{this.stopped=true;});
    for(const name of ["LeafDebugUICamera","LeafDiagnosticReportCamera"]){
      if(findSceneObjectByName(name)?.isEnabledInHierarchy)throw Error("Active LEAF overlay: "+name);
    }
    const accepted=snapshot();
    if(accepted.source!=="HTTPS solve"||!accepted.hasReceipt||!accepted.verifiedForCurrentRevision||!accepted.verification.valid||accepted.input.obstacles.length!==1)
      throw Error("Run the fresh-draw mug-repair journey or rehearsal first; Save must export that actual verified design");
    const input=new WorkbenchPathInteractor("Motion Round 3 export hand");
    const start=Date.now();this.runId="motion-export-"+start;this.eventNumber=0;
    const stopAudio=observeProductAudio(this,(event,detail)=>this.stamp(event,detail));
    try{
      evidence("round3-save-current-design",{wallEpochMs:start,runtimeSeconds:getTime(),input:accepted.input,inputHash:accepted.inputHash,parameters:accepted.parameters,candidateId:accepted.candidateId,disclosure:"Scripted synthetic SIK hand input in Preview"});
      await action(input,"export");
      const deadline=getTime()+22;
      while(snapshot().sharing&&getTime()<deadline){this.alive();await sleep(100);}
      const shared=snapshot();expect(shared.sharing).toBe(false);
      expect(shared.input).toEqual(accepted.input);expect(shared.parameters).toEqual(accepted.parameters);
      expect(shared.inputHash).toBe(accepted.inputHash);expect(shared.candidateId).toBe(accepted.candidateId);
      expect(shared.verifiedForCurrentRevision).toBe(true);expect(shared.verification.valid).toBe(true);
      expect(shared.exportUrl.startsWith("https://motion-foundry-nine.vercel.app/design/loop/")).toBe(true);
      expect(shared.qr.visible).toBe(true);expect(shared.qr.moduleCount).toBeGreaterThan(20);
      evidence("round3-actual-share-visible",{wallEpochMs:Date.now(),runtimeSeconds:getTime(),inputHash:shared.inputHash,exportUrl:shared.exportUrl,qr:shared.qr});
      const holdEnd=getTime()+8;
      while(getTime()<holdEnd){this.alive();const current=snapshot();expect(current.qr.visible).toBe(true);expect(current.exportUrl).toBe(shared.exportUrl);expect(current.inputHash).toBe(shared.inputHash);await sleep(100);}
      evidence("round3-export-complete",{durationMs:Date.now()-start,audio:snapshot().audio});
    }finally{try{await input.teardown();}finally{stopAudio();}}
  }
  private alive(){if(this.stopped)throw Error("Export capture stopped");}
}
