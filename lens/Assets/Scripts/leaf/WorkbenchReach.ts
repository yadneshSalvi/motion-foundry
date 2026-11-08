import {Scenario} from "Leaf.lspkg/Scenarios/scenario/Scenario";
import {expect} from "Leaf.lspkg/Utils/common/Expect";
import {sleep} from "Leaf.lspkg/Utils/common/Utils";
import {DefaultLeafInteractor} from "Leaf.lspkg/Interactors/interactor/DefaultLeafInteractor";
import {IKBodyInteractor} from "Leaf.lspkg/Interactors/interactor/ik/IKBodyInteractor";
import {DiagnosticRecorder} from "Leaf.lspkg/Diagnostic/DiagnosticRecorder";
import {LeafHandInteractor} from "Leaf.lspkg/Interactors/interactor/LeafTwoHandInteractor";
import {SIK} from "SpectaclesInteractionKit.lspkg/SIK";
import {actionTarget,boardPoint,evidence,namedTarget,reference,snapshot} from "./WorkbenchScenarioTools";

/** Direct crank reach and a shared SIK hand mount edit with exact Undo. No IK fallback pass. */
@component
export class WorkbenchReach extends Scenario {
  async run(){
    const navigation=new DefaultLeafInteractor("Motion reach navigation");await reference(navigation);
    const recorder=DiagnosticRecorder.getInstance(),previousPolicy=recorder.policy;
    recorder.setPolicy("fail-fast");
    let body:IKBodyInteractor|undefined;
    try{
      const parents=(["left","right"] as const).map(side=>SIK.HandInputData.getHand(side).getHandVisuals().root.getParent());
      // The supported IK controller drives the real SIK hands without a Bitmoji
      // visualizer. This avoids a camera-anchored avatar head obscuring Preview.
      body=new IKBodyInteractor();
      const crank=namedTarget("Workbench crank knob");
      // A far-field route is useful, but it does not satisfy the physical crank-reach gate.
      expect(body.right.isIndirect(crank),"Step to the intended near working pose; the crank must be directly reachable").toBe(false);
      const before=snapshot();await body.trigger(crank);await sleep(150);
      expect(snapshot().inputHash).toBe(before.inputHash);
      expect(snapshot().cranking).toBe(false);
      expect(recorder.hasErrors()).toBe(false);
      evidence("direct-crank-reach",{diagnostics:recorder.toReport(),inputHash:snapshot().inputHash});

      // IK and the shared hand driver both wrap the same SIK hands. Release one before
      // acquiring the other so LEAF restores each mesh to its real tracking parent.
      body.destroy();body=undefined;
      const restoredParents=(["left","right"] as const).map((side,index)=>{
        const parent=SIK.HandInputData.getHand(side).getHandVisuals().root.getParent();
        expect(parent.isSame(parents[index]),"IK disposal must restore the original hand hierarchy").toBe(true);
        expect(isNull(parent.getComponent("ObjectTracking3D")),"Restored hand parent must own tracking").toBe(false);
        return{side,parent:parent.name};
      });
      evidence("ik-disposed-before-shared-hand",{restoredParents});
      // TrackedHandWrapper schedules its supported tracking restart after 500 ms.
      await sleep(650);

      const hand=LeafHandInteractor.get("right"),mount=namedTarget("Workbench movable mount");
      const beforeEdit=snapshot(),worldDelta=boardPoint(.02,0,.7).sub(boardPoint(0,0,.7));
      await hand.drag(mount,worldDelta,500);await sleep(150);
      const edited=snapshot();expect(edited.revision).toBe(beforeEdit.revision+1);expect(edited.verifiedForCurrentRevision).toBe(false);
      const beforeTap=edited.revision;await hand.trigger(mount);await sleep(120);expect(snapshot().revision,"No-motion trigger must not make another revision").toBe(beforeTap);
      await navigation.trigger(actionTarget("undo"));await sleep(180);
      const restored=snapshot();expect(restored.input).toEqual(beforeEdit.input);expect(restored.parameters).toEqual(beforeEdit.parameters);
      expect(restored.candidateCount).toBe(beforeEdit.candidateCount);expect(restored.hasReceipt).toBe(beforeEdit.hasReceipt);
      evidence("mount-edit-undo",{editedRevision:edited.revision,restoredRevision:restored.revision,inputHash:restored.inputHash});
    }finally{try{body?.destroy();}finally{recorder.setPolicy(previousPolicy);}}
  }
}
