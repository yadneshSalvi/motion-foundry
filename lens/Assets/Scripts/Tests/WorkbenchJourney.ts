import {Scenario} from "Leaf.lspkg/Scenarios/scenario/Scenario";
import {expect} from "Leaf.lspkg/Utils/common/Expect";
import {sleep} from "Leaf.lspkg/Utils/common/Utils";
import {WorkbenchPathInteractor} from "./WorkbenchPathInteractor";
import {action,boardPoint,crankContactPoint,evidence,namedTarget,reference,snapshot,waitForResult} from "./WorkbenchScenarioTools";
import {WORKBENCH_KEEP_OUT} from "../WorkbenchProfile";
import {planCrankContactPlacement} from "./WorkbenchContactPlan";

/** Fresh visible-hand drawing → HTTPS solve → real mug contact → same-input repair. */
@component
export class WorkbenchJourney extends Scenario {
  private stopped=false;
  private alive(){if(this.stopped)throw Error("Journey stopped");}
  async run(){
    this.createEvent("OnDestroyEvent").bind(()=>{this.stopped=true;});
    const input=new WorkbenchPathInteractor("Motion workbench journey input");
    try{
    await reference(input);
    const before=snapshot();
    await action(input,"draw");
    // Reference-derived automated input, translated +0.06 cm, including full closure.
    const points=before.input.stroke.map(p=>boardPoint(p.x+.06,p.y));points.push(points[0]);
    await input.followTimedPath(namedTarget("Workbench drawing surface"),input.visibleClosedDrawing(points),10000,()=>this.alive());
    expect(snapshot().drawMode,"Endpoint proximity must snap the loop closed").toBe("none");
    expect(snapshot().snapClosed).toBe(true);
    const drawn=snapshot();
    expect(drawn.revision).toBe(before.revision+1);
    expect(drawn.inputHash).not.toBe(before.inputHash);
    expect(drawn.verifiedForCurrentRevision).toBe(false);
    const requested=JSON.stringify(drawn.input);
    await action(input,"solve");
    const solved=await waitForResult(32,()=>this.alive());
    expect(solved.source).toBe("HTTPS solve");expect(solved.hasReceipt).toBe(true);expect(solved.verifiedForCurrentRevision).toBe(true);expect(solved.verification.valid).toBe(true);
    expect(JSON.stringify(solved.input),"Synthesis must preserve the requested drawing and constraints").toBe(requested);
    expect(solved.verification.maxFitErrorCm).toBeLessThan(solved.input.tolerances.fitCm+1e-9);
    evidence("draw-close-solve",{revision:solved.revision,inputHash:solved.inputHash,errorCm:solved.verification.maxFitErrorCm});

    const crank=namedTarget("Workbench crank knob"),local=crank.getTransform().getLocalPosition(),phase=solved.phase,radius=solved.parameters.crankCm;
    const crankPath=()=>{const current=snapshot();return Array.from({length:33},(_,i)=>crankContactPoint(radius*Math.cos(current.phase+i*.9/32),radius*Math.sin(current.phase+i*.9/32),local.z));};
    const hashBefore=snapshot().inputHash;
    await input.followTimedPath(crank,crankPath,3000,()=>this.alive());await sleep(120);
    const turned=snapshot();
    expect(Math.abs(turned.phase-phase)).toBeGreaterThan(.3);
    expect(turned.inputHash).toBe(hashBefore);expect(turned.playing).toBe(true);expect(turned.inkPointCount).toBeGreaterThan(1);
    evidence("crank-and-ink",{phaseChange:turned.phase-phase,inputHash:turned.inputHash,inkPoints:turned.inkPointCount});

    const blocked=await addBlockingMug(input,solved,()=>this.alive(),(event,detail)=>evidence(event,detail));
    await inspectContact(input,blocked,4000,()=>this.alive());
    const fixed=JSON.stringify(blocked.input),oldCrank=blocked.parameters.crankCm;
    await action(input,"solve");
    const repaired=await waitForResult(32,()=>this.alive());
    expect(repaired.source).toBe("HTTPS solve");expect(repaired.hasReceipt).toBe(true);expect(repaired.verifiedForCurrentRevision).toBe(true);
    expect(repaired.verification.valid).toBe(true);expect(repaired.verification.minClearanceCm).toBeGreaterThan(0);
    expect(repaired.parameters.crankCm).toBeLessThan(oldCrank);
    expect(JSON.stringify(repaired.input),"Repair cannot move the keep-out or loosen the fit limit").toBe(fixed);
    evidence("contact-repair",{inputHash:repaired.inputHash,oldCrankCm:oldCrank,newCrankCm:repaired.parameters.crankCm,errorCm:repaired.verification.maxFitErrorCm,sampledMarginCm:repaired.verification.minClearanceCm});
    const audio=snapshot().audio;
    expect(audio.failed,"Native audio scheduling must not report an exception").toBe(false);
    if(audio.configured.tick&&audio.configured.contact&&audio.configured.clear){
      expect(audio.voiceCount).toBe(3);
      expect(audio.tick,"Turning the crank must schedule its ratchet cue").toBeGreaterThan(0);
      expect(audio.contact,"The contact witness must schedule its cue").toBeGreaterThan(0);
      expect(audio.clear,"Closure or an accepted solve must schedule its clear cue").toBeGreaterThan(0);
    }
    // Scheduling evidence is not a microphone recording or a claim about physical Spectacles audio.
    evidence("spatial-audio-scheduling",audio);
    }finally{await input.teardown();}
  }
}

/** Read-only oracle: direct mug addition may change only obstacles and revision. */
export function assertObstacleOnly(before:ReturnType<typeof snapshot>,after:ReturnType<typeof snapshot>,center={x:-8.9,y:0}){
  const a={...before.input,revision:after.input.revision,obstacles:after.input.obstacles};
  expect(after.input).toEqual(a);
  expect(after.input.stroke).toEqual(before.input.stroke);
  expect(after.input.fixedMounts).toEqual(before.input.fixedMounts);
  expect(after.input.tolerances).toEqual(before.input.tolerances);
  expect(after.parameters).toEqual(before.parameters);
  expect(after.input.obstacles.length).toBe(1);
  const mug=after.input.obstacles[0];
  expect(mug.center).toEqual(center);expect(mug.radiusCm).toBe(4.5);
  expect(mug.layerZCm).toBe(2);expect(mug.depthCm).toBe(4);
}
/** Adding and positioning the mug is ONE genuine visible ring gesture. The
 * selected current mechanism determines the small inward destination. The
 * runtime's independent verifier must then prove physical contact separately. */
export async function addBlockingMug(input:WorkbenchPathInteractor,before:ReturnType<typeof snapshot>,
  alive=()=>{},stamp:(event:string,detail:unknown)=>void=(event,detail)=>evidence(event,detail)){
  expect(before.input.obstacles.length).toBe(0);
  const mug=WORKBENCH_KEEP_OUT,plan=planCrankContactPlacement(before.parameters.crankCm,before.input.linkRadiusCm,mug.center,mug.radiusCm);
  const target=namedTarget("Workbench measured keep-out"),from=target.getTransform().getWorldPosition();
  const delta=boardPoint(plan.center.x,plan.center.y,mug.layerZCm).sub(boardPoint(mug.center.x,mug.center.y,mug.layerZCm));
  stamp("mug-placement-intent",{wallEpochMs:Date.now(),inputHash:before.inputHash,plan,
    scope:"One actual SIK add/position gesture; no product input or candidate is assigned"});
  if(plan.inwardCm>0)await input.followTimedPath(target,[from,from.add(delta)],1600,alive);
  else await input.trigger(target);
  alive();await sleep(200);const blocked=snapshot();
  assertObstacleOnly(before,blocked,plan.center);
  expect(blocked.verification.valid).toBe(false);
  expect(blocked.verification.collisionWitness?.geometry).toBe("crank");
  const physicalMargin=blocked.verification.collisionWitness!.marginCm+blocked.input.clearanceCm;
  expect(physicalMargin,"The mug must overlap the actual rod, not merely its required clearance buffer").toBeLessThan(0);
  stamp("mug-placement-observed",{wallEpochMs:Date.now(),inputHash:blocked.inputHash,obstacle:blocked.input.obstacles[0],
    physicalMarginCm:physicalMargin,sampledMarginCm:blocked.verification.collisionWitness!.marginCm});
  return blocked;
}
/** Move the physical grip through the actual collision phase; never assign phase. */
export async function inspectContact(input:WorkbenchPathInteractor,blocked:ReturnType<typeof snapshot>,durationMs=4000,alive=()=>{},contactHoldMs=300){
  const target=namedTarget("Workbench crank knob"),height=target.getTransform().getLocalPosition().z;
  const witness=blocked.verification.collisionWitness!;
  const points=()=>{
    const phase=snapshot().phase;
    let delta=Math.atan2(Math.sin(witness.phaseRad-phase),Math.cos(witness.phaseRad-phase));
    if(Math.abs(delta)<.02)delta+=Math.PI*2*blocked.parameters.driveDirection;
    return Array.from({length:65},(_,i)=>crankContactPoint(blocked.parameters.crankCm*Math.cos(phase+delta*i/64),blocked.parameters.crankCm*Math.sin(phase+delta*i/64),height));
  };
  await input.followTimedPath(target,points,durationMs,alive,async()=>{
    await sleep(100);alive();
    expect(snapshot().collisionWitnessVisible,"The real amber contact ring must be shown at its kinematic witness").toBe(true);
    expect(snapshot().audio.contact).toBeGreaterThan(0);
    const end=getTime()+contactHoldMs/1000;
    while(getTime()<end){alive();expect(snapshot().collisionWitnessVisible).toBe(true);await sleep(80);}
    evidence("physical-mug-contact-visible",{phase:snapshot().phase,audio:snapshot().audio,verification:snapshot().verification});
  });
}
