import {Scenario} from "Leaf.lspkg/Scenarios/scenario/Scenario";
import {expect} from "Leaf.lspkg/Utils/common/Expect";
import {sleep} from "Leaf.lspkg/Utils/common/Utils";
import {WorkbenchPathInteractor} from "./WorkbenchPathInteractor";
import {assertObstacleOnly,inspectContact} from "./WorkbenchJourney";
import {crankContactPoint,evidence,namedTarget,reference,snapshot} from "./WorkbenchScenarioTools";

/** Short, Preview-only visibility probe using the real crank and mug controls.
 * Starts from the bundled reference already shown by a fresh Preview. No solve,
 * state reset, phase assignment, hidden hold, or product handler is invoked. */
@component
export class WorkbenchCrankSmoke extends Scenario {
  private stopped=false;
  private alive(){if(this.stopped)throw Error("Crank smoke stopped");}
  async run(){
    if(!global.deviceInfoSystem.isEditor())throw Error("Crank smoke is Preview-only");
    this.createEvent("OnDestroyEvent").bind(()=>{this.stopped=true;});
    const hand=new WorkbenchPathInteractor("Motion crank visibility hand");
    try{
      await reference(hand);const before=snapshot();
      const crank=namedTarget("Workbench crank knob"),height=crank.getTransform().getLocalPosition().z;
      const points=()=>{const current=snapshot();return Array.from({length:49},(_,i)=>{
        const angle=current.phase+2.6*i/48;
        return crankContactPoint(current.parameters.crankCm*Math.cos(angle),current.parameters.crankCm*Math.sin(angle),height);
      });};
      evidence("crank-smoke:first-start",{wallEpochMs:Date.now(),inputHash:before.inputHash,phase:before.phase});
      await hand.followTimedPath(crank,points,4000,()=>this.alive());await sleep(700);
      const turned=snapshot();
      expect(turned.input).toEqual(before.input);expect(turned.parameters).toEqual(before.parameters);
      expect(turned.playing).toBe(true);expect(turned.firstUse).toBe(false);
      expect(Math.abs(turned.phase-before.phase)).toBeGreaterThan(2.5);
      expect(turned.inkPointCount).toBeGreaterThan(1);
      evidence("crank-smoke:first-end",{wallEpochMs:Date.now(),phase:turned.phase,inkPoints:turned.inkPointCount,projection:turned.projection});
      await hand.trigger(namedTarget("Workbench measured keep-out"));await sleep(180);
      const blocked=snapshot();assertObstacleOnly(before,blocked);
      expect(blocked.verification.valid).toBe(false);expect(blocked.verification.collisionWitness?.geometry).toBe("crank");
      expect(blocked.verification.collisionWitness!.marginCm+blocked.input.clearanceCm).toBeLessThan(0);
      evidence("crank-smoke:contact-start",{wallEpochMs:Date.now(),inputHash:blocked.inputHash,witness:blocked.verification.collisionWitness});
      await inspectContact(hand,blocked,4000,()=>this.alive(),2000);await sleep(700);
      const after=snapshot();expect(after.input).toEqual(blocked.input);expect(after.parameters).toEqual(blocked.parameters);
      expect(after.audio.failed).toBe(false);
      evidence("crank-smoke:complete",{wallEpochMs:Date.now(),inputHash:after.inputHash,audio:after.audio,projection:after.projection,
        scope:"Functional input assertions only; inspect recorded pinch, nib, drawing and contact edge before visual acceptance"});
    }finally{await hand.teardown();}
  }
}
