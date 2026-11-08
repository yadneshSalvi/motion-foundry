import {Scenario} from "Leaf.lspkg/Scenarios/scenario/Scenario";
import {expect} from "Leaf.lspkg/Utils/common/Expect";
import {sleep} from "Leaf.lspkg/Utils/common/Utils";
import {WorkbenchPathInteractor} from "./WorkbenchPathInteractor";
import {action,boardPoint,evidence,namedTarget,reference,snapshot,waitForResult} from "./WorkbenchScenarioTools";

/** Draw → explicit close → actual HTTPS solve → crank path → contact → fresh repair. */
@component
export class WorkbenchJourney extends Scenario {
  async run(){
    const input=new WorkbenchPathInteractor("Motion workbench journey input");
    await reference(input);
    const before=snapshot();
    await action(input,"draw");
    // An open, slightly translated reference-shaped gesture. Offline feasibility is recorded,
    // but this test must obtain and independently verify a NEW HTTPS result at run time.
    const path=before.input.stroke.slice(0,59).map(p=>boardPoint(p.x+.06,p.y));
    await input.followPath(namedTarget("Workbench drawing surface"),path);
    expect(snapshot().drawMode,"Open stroke must request explicit closure").toBe("open");
    await action(input,"done");
    const drawn=snapshot();
    expect(drawn.revision).toBe(before.revision+1);
    expect(drawn.inputHash).not.toBe(before.inputHash);
    expect(drawn.verifiedForCurrentRevision).toBe(false);
    const requested=JSON.stringify(drawn.input);
    await action(input,"solve");
    const solved=await waitForResult();
    expect(solved.source).toBe("HTTPS solve");expect(solved.verification.valid).toBe(true);
    expect(JSON.stringify(solved.input),"Synthesis must preserve the requested drawing and constraints").toBe(requested);
    expect(solved.verification.maxFitErrorCm).toBeLessThan(solved.input.tolerances.fitCm+1e-9);
    evidence("draw-close-solve",{revision:solved.revision,inputHash:solved.inputHash,errorCm:solved.verification.maxFitErrorCm});

    const crank=namedTarget("Workbench crank knob"),local=crank.getTransform().getLocalPosition(),phase=solved.phase,radius=solved.parameters.crankCm;
    const crankPath=Array.from({length:33},(_,i)=>boardPoint(radius*Math.cos(phase+i*.9/32),radius*Math.sin(phase+i*.9/32),local.z));
    const hashBefore=snapshot().inputHash;
    await input.followPath(crank,crankPath);await sleep(120);
    const turned=snapshot();
    expect(Math.abs(turned.phase-phase)).toBeGreaterThan(.3);
    expect(turned.inputHash).toBe(hashBefore);expect(turned.playing).toBe(true);expect(turned.inkPointCount).toBeGreaterThan(1);
    evidence("crank-and-ink",{phaseChange:turned.phase-phase,inputHash:turned.inputHash,inkPoints:turned.inkPointCount});

    await action(input,"more");await action(input,"study");
    const blocked=snapshot();expect(blocked.verification.valid).toBe(false);
    expect(blocked.verification.collisionWitness?.geometry).toBe("crank");
    expect(blocked.verification.collisionWitness!.marginCm).toBeLessThan(0);
    const fixed=JSON.stringify(blocked.input),oldCrank=blocked.parameters.crankCm;
    await action(input,"solve");
    const repaired=await waitForResult();
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
  }
}
