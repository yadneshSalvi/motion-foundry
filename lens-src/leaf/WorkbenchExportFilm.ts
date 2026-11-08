import {Scenario} from "Leaf.lspkg/Scenarios/scenario/Scenario";
import {expect} from "Leaf.lspkg/Utils/common/Expect";
import {findSceneObjectByName,sleep} from "Leaf.lspkg/Utils/common/Utils";
import {buildLoopInputHash,LoopParameters} from "../LoopDomain";
import {makeWorkbenchStudy} from "../WorkbenchProfile";
import {WorkbenchPathInteractor} from "./WorkbenchPathInteractor";
import {action,actionTarget,boardPoint,namedTarget,reference,snapshot,WorkbenchSnapshot} from "./WorkbenchScenarioTools";

// Read-only assertions from the accepted main take, not a result installed in the app.
const ACCEPTED_HASH="fnv1a-3049b059";
const ACCEPTED_PARAMETERS:LoopParameters={
  groundCm:16,crankCm:3.7667421307701603,couplerCm:14.446692177549375,
  rockerCm:8.770614008476006,branch:1,attachmentAlongCm:7.167382789600269,
  attachmentAcrossCm:4.888334437088381,startingPhaseRad:.41703572688279433,
  driveDirection:1,
};

/** Preview-only capture setup. Every product mutation is a genuine LEAF → SIK input. */
@component
export class WorkbenchExportFilm extends Scenario {
  private stopped=false;
  private startWallMs=0;
  private eventNumber=0;

  async run(){
    if(!global.deviceInfoSystem.isEditor())throw Error("Export film setup is Preview-only");
    this.startWallMs=Date.now();
    this.createEvent("OnDestroyEvent").bind(()=>{this.stopped=true;});
    for(const name of ["LeafDebugUICamera","LeafDiagnosticReportCamera"]){
      if(findSceneObjectByName(name)?.isEnabledInHierarchy)throw Error("Restart Preview before capture: active LEAF overlay "+name);
    }
    expect(snapshot().revision,"Start a fresh Preview; this test never rewrites revision or controller state").toBe(0);
    const input=new WorkbenchPathInteractor("Motion export film SIK input");
    this.stamp("setup-start",{disclosure:"Automated Preview SIK input. No rendered-hand or physical tracking claim."});

    // The same real controls produce r1 Reference, r2 explicitly closed drawing,
    // then r3 Study. The Study replaces that drawing, exactly as in the main take.
    await reference(input);this.alive();
    const baseline=snapshot();expect(baseline.revision).toBe(1);
    await action(input,"draw");this.alive();
    await input.followPath(namedTarget("Workbench drawing surface"),baseline.input.stroke.slice(0,59).map(p=>boardPoint(p.x+.06,p.y)));
    this.alive();expect(snapshot().drawMode).toBe("open");
    await action(input,"done");this.alive();expect(snapshot().revision).toBe(2);
    await action(input,"more");await action(input,"study");this.alive();
    const blocked=snapshot(),expected=makeWorkbenchStudy().input;
    // This is a separate test oracle only; no field is assigned to the live controller.
    expected.revision=3;
    expect(buildLoopInputHash(expected),"The current fixture must match the accepted main take").toBe(ACCEPTED_HASH);
    expect(blocked.inputHash).toBe(ACCEPTED_HASH);
    expect(JSON.stringify(blocked.input)).toBe(JSON.stringify(expected));
    expect(blocked.verification.valid).toBe(false);
    this.stamp("study-input-matched",{inputHash:blocked.inputHash,revision:blocked.revision,input:blocked.input});

    await action(input,"solve");
    const solveDeadline=Date.now()+33000;
    while(snapshot().solving&&Date.now()<solveDeadline){this.alive();await sleep(100);}
    this.alive();const repaired=snapshot();
    expect(repaired.solving).toBe(false);expect(repaired.source).toBe("HTTPS solve");
    expect(repaired.hasReceipt).toBe(true);expect(repaired.verifiedForCurrentRevision).toBe(true);
    expect(repaired.verification.valid).toBe(true);expect(repaired.verification.minClearanceCm).toBeGreaterThan(0);
    expect(JSON.stringify(repaired.input),"Fresh synthesis must preserve all accepted main-take inputs").toBe(JSON.stringify(expected));
    this.assertAccepted(repaired);
    expect(repaired.verification.maxFitErrorCm).toBe(.24235331508098867);
    expect(repaired.verification.minClearanceCm).toBe(.023257869229840494);
    this.stamp("export-ready",this.publicSnapshot(repaired));
    await this.movingHold("ready-lead-in",3000,repaired);

    const keep=actionTarget("export"),off=[
      keep.onTriggerStart.add(()=>this.stamp("sik-keep-trigger-start")),
      keep.onTriggerEnd.add(()=>this.stamp("sik-keep-trigger-end")),
      keep.onTriggerCanceled.add(()=>this.stamp("sik-keep-trigger-cancelled")),
    ];
    try{
      this.stamp("keep-intent",{inputHash:repaired.inputHash,candidateId:repaired.candidateId});
      await input.trigger(keep);this.alive();await sleep(180);
    }finally{off.forEach(unsubscribe=>unsubscribe());}
    const shareDeadline=Date.now()+22000;
    while(snapshot().sharing&&Date.now()<shareDeadline){this.alive();await sleep(100);}
    this.alive();const shared=snapshot();
    this.assertAccepted(shared);expect(shared.sharing).toBe(false);
    expect(shared.exportUrl.startsWith("https://motion-foundry-nine.vercel.app/design/loop/")).toBe(true);
    expect(shared.qr.visible,"The actual returned QR must be visible; no placeholder is accepted").toBe(true);
    expect(shared.qr.moduleCount).toBeGreaterThan(20);
    expect(shared.candidateId).toBe(repaired.candidateId);
    this.stamp("share-visible",this.publicSnapshot(shared));
    await this.movingHold("actual-qr-hold",8000,shared,true);
    const final=snapshot();expect(final.audio.failed).toBe(false);
    this.stamp("export-film-complete",this.publicSnapshot(final));
  }

  private alive(){if(this.stopped)throw Error("Export film setup stopped");}
  private assertAccepted(state:WorkbenchSnapshot){
    expect(state.revision).toBe(3);expect(state.inputHash).toBe(ACCEPTED_HASH);
    expect(state.verifiedForCurrentRevision).toBe(true);expect(state.verification.valid).toBe(true);
    for(const key of Object.keys(ACCEPTED_PARAMETERS) as (keyof LoopParameters)[]){
      expect(state.parameters[key],"The exported mechanism must exactly match the accepted main take: "+key).toBe(ACCEPTED_PARAMETERS[key]);
    }
  }
  private async movingHold(reason:string,durationMs:number,expected:WorkbenchSnapshot,requireQr=false){
    const before=snapshot(),deadline=Date.now()+durationMs;
    this.stamp("observation-start",{reason,durationMs,phase:before.phase});
    while(Date.now()<deadline){
      this.alive();const state=snapshot();this.assertAccepted(state);
      expect(state.candidateId).toBe(expected.candidateId);expect(state.playing).toBe(true);
      if(requireQr){expect(state.qr.visible).toBe(true);expect(state.exportUrl).toBe(expected.exportUrl);}
      await sleep(100);
    }
    const after=snapshot();expect(Math.abs(after.phase-before.phase)).toBeGreaterThan(.1);
    this.stamp("observation-complete",{reason,phase:after.phase,inputHash:after.inputHash,exportUrl:after.exportUrl});
  }
  private publicSnapshot(state:WorkbenchSnapshot){
    // The product exposes receipt presence, never the private signed solve receipt or credentials.
    return{source:state.source,revision:state.revision,inputHash:state.inputHash,input:state.input,
      candidateId:state.candidateId,parameters:state.parameters,verification:state.verification,
      verifiedForCurrentRevision:state.verifiedForCurrentRevision,serverReceiptPresent:state.hasReceipt,
      phase:state.phase,playing:state.playing,inkPoints:state.inkPointCount,sharing:state.sharing,
      exportUrl:state.exportUrl,qr:state.qr,audio:state.audio};
  }
  private stamp(event:string,detail:unknown={}){
    const now=Date.now();
    print("[MotionFoundry export film] "+JSON.stringify({eventNumber:++this.eventNumber,event,
      wallEpochMs:now,runElapsedMs:now-this.startWallMs,runtimeSeconds:getTime(),detail}));
  }
}
