import {Scenario} from "Leaf.lspkg/Scenarios/scenario/Scenario";
import {expect} from "Leaf.lspkg/Utils/common/Expect";
import {sleep} from "Leaf.lspkg/Utils/common/Utils";
import {WorkbenchPathInteractor} from "./WorkbenchPathInteractor";
import {action,boardPoint,crankContactPoint,evidence,namedTarget,reference,snapshot} from "./WorkbenchScenarioTools";

/** Fresh Preview; every transition uses visible real SIK input, never product handlers. */
@component
export class WorkbenchMenuGraph extends Scenario {
  private firstUse(){return (snapshot() as ReturnType<typeof snapshot>&{firstUse:boolean}).firstUse;}
  async run(){
    const hand=new WorkbenchPathInteractor("Motion menu graph hand");
    try{
      await reference(hand);const initial=snapshot();expect(this.firstUse()).toBe(true);
      await action(hand,"more");expect(snapshot().uiPage).toBe("more");
      await action(hand,"tools");expect(snapshot().uiPage).toBe("tools");
      await action(hand,"back");expect(snapshot().uiPage).toBe("more");
      await action(hand,"back");expect(snapshot().uiPage).toBe("result");
      for(const tools of [false,true]){
        await action(hand,"more");if(tools)await action(hand,"tools");
        // More/Tools must close after six seconds without any decorative hovering hand.
        await sleep(6300);expect(snapshot().uiPage).toBe("result");
        expect(snapshot().input).toEqual(initial.input);expect(this.firstUse()).toBe(true);
      }
      await action(hand,"draw");expect(snapshot().uiPage).toBe("drawing");
      await action(hand,"back");expect(snapshot().drawMode).toBe("none");
      expect(snapshot().input).toEqual(initial.input);expect(this.firstUse()).toBe(true);
      const beforePlace=snapshot();expect(beforePlace.playing).toBe(true);
      await action(hand,"more");await action(hand,"place");
      expect(snapshot().placement.mode).toBe("placing");expect(snapshot().playing).toBe(false);
      expect(this.firstUse()).toBe(true);
      await action(hand,"place:cancel");
      expect(snapshot().placement.mode).not.toBe("placing");expect(snapshot().playing).toBe(beforePlace.playing);
      expect(snapshot().input).toEqual(beforePlace.input);expect(this.firstUse()).toBe(true);
      await action(hand,"export");expect(snapshot().uiPage).toBe("share");
      expect(snapshot().sharing).toBe(false);await action(hand,"back");
      expect(snapshot().uiPage).toBe("result");expect(this.firstUse()).toBe(true);
      const beforeCrank=snapshot(),target=namedTarget("Workbench crank knob"),z=target.getTransform().getLocalPosition().z;
      const points=()=>{const current=snapshot();return Array.from({length:25},(_,i)=>{const t=current.phase+.7*i/24,r=current.parameters.crankCm;return crankContactPoint(r*Math.cos(t),r*Math.sin(t),z);});};
      await hand.followTimedPath(target,points,1400,()=>{});
      expect(Math.abs(snapshot().phase-beforeCrank.phase)).toBeGreaterThan(.08);expect(this.firstUse()).toBe(false);
      await action(hand,"draw");
      const stroke=initial.input.stroke.map(p=>boardPoint(p.x+.06,p.y));stroke.push(stroke[0]);
      await hand.followTimedPath(namedTarget("Workbench drawing surface"),stroke,4000,()=>{});
      expect(snapshot().drawMode).toBe("none");const requested=snapshot();
      expect(requested.inputHash).not.toBe(initial.inputHash);
      await action(hand,"solve");
      // An unusually fast response cannot be represented as successful cancellation.
      expect(snapshot().solving,"Cancel coverage needs a still-pending genuine backend request").toBe(true);
      await action(hand,"cancel");expect(snapshot().solving).toBe(false);
      expect(snapshot().uiPage).not.toBe("solving");expect(snapshot().input).toEqual(requested.input);
      const canceled=snapshot();await sleep(1200);
      expect(snapshot().input).toEqual(canceled.input);expect(snapshot().candidateId).toBe(canceled.candidateId);
      // Recovery remains useful after the former five-second chip lifetime.
      await sleep(6300);
      const delayed=snapshot();expect(delayed.undoChipVisible).toBe(true);
      expect(delayed.actions.length+1).toBeLessThan(4);
      expect(delayed.projection.undo.reason).toBe("visible");
      expect(delayed.projection.undo.anchorDistanceCm!).toBeLessThan(10.001);
      expect(delayed.projection.dockOverlaps.find(c=>c.id==="undo")?.overlaps||[]).toEqual([]);
      await hand.trigger(namedTarget("Workbench undo chip"));await sleep(180);
      expect(snapshot().input).toEqual(initial.input);expect(snapshot().undoChipVisible).toBe(false);
      evidence("persistent-object-undo",{waitMs:6300,anchor:delayed.projection.undo,inputRestored:snapshot().inputHash});
      evidence("menu-graph-complete",{inputHash:snapshot().inputHash,firstUse:this.firstUse(),scope:"Actual SIK menu transitions, placement play restoration, stale solve guard; native run required"});
    }finally{await hand.teardown();}
  }
}
