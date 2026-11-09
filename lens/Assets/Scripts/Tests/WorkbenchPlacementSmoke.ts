import {Scenario} from "Leaf.lspkg/Scenarios/scenario/Scenario";
import {expect} from "Leaf.lspkg/Utils/common/Expect";
import {sleep} from "Leaf.lspkg/Utils/common/Utils";
import {WorkbenchPathInteractor} from "./WorkbenchPathInteractor";
import {action,evidence,reference,snapshot} from "./WorkbenchScenarioTools";

/** Fresh-Preview QA only. One real WorldQuery placement, without a solver precondition. */
@component
export class WorkbenchPlacementSmoke extends Scenario {
  async run(){
    if(!global.deviceInfoSystem.isEditor())throw Error("Placement smoke is Preview-only");
    const hand=new WorkbenchPathInteractor("Motion real surface smoke hand");
    try{
      await reference(hand);const before=snapshot();
      await action(hand,"more");await action(hand,"place");
      expect(snapshot().placement.mode).toBe("placing");
      let found=false;
      for(let attempt=0;attempt<2&&!found;attempt++){
        const deadline=getTime()+10;
        while(getTime()<deadline){
          if(snapshot().actions.some(a=>a.id==="place:commit")){found=true;break;}
          await sleep(100);
        }
        evidence("placement-smoke-observation",{attempt,placement:snapshot().placement,projection:snapshot().projection});
        if(!found&&attempt===0)await action(hand,"place:retry");
      }
      expect(found,"A genuine horizontal table hit is required; see native query diagnostics").toBe(true);
      expect(snapshot().placement.footprint.length).toBe(4);
      await action(hand,"place:commit");await sleep(700);
      const after=snapshot();
      expect(after.placement.mode).toBe("surface");expect(after.placement.commits).toBe(before.placement.commits+1);
      expect(after.input).toEqual(before.input);expect(after.parameters).toEqual(before.parameters);
      expect(after.playing).toBe(before.playing);expect(after.firstUse).toBe(before.firstUse);
      expect(after.tableWorldPosition.x).toBeCloseTo(after.placement.hit!.x,3);
      expect(after.tableWorldPosition.y).toBeCloseTo(after.placement.hit!.y+.5,3);
      expect(after.tableWorldPosition.z).toBeCloseTo(after.placement.hit!.z,3);
      evidence("placement-smoke-complete",{inputHash:after.inputHash,placement:after.placement,tableWorldPosition:after.tableWorldPosition,projection:after.projection});
    }finally{await hand.teardown();}
  }
}
