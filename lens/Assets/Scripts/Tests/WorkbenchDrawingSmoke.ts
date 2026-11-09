import {Scenario} from "Leaf.lspkg/Scenarios/scenario/Scenario";
import {expect} from "Leaf.lspkg/Utils/common/Expect";
import {sleep} from "Leaf.lspkg/Utils/common/Utils";
import {WorkbenchPathInteractor} from "./WorkbenchPathInteractor";
import {action,boardPoint,evidence,namedTarget,reference,snapshot} from "./WorkbenchScenarioTools";

/** Short real SIK drawing probe. It neither installs a design nor solves one. */
@component
export class WorkbenchDrawingSmoke extends Scenario {
  private stopped=false;
  private alive(){if(this.stopped)throw Error("Drawing smoke stopped");}
  async run(){
    if(!global.deviceInfoSystem.isEditor())throw Error("Drawing smoke is Preview-only");
    this.createEvent("OnDestroyEvent").bind(()=>{this.stopped=true;});
    const hand=new WorkbenchPathInteractor("Motion writing visibility hand");
    try{
      await reference(hand);const before=snapshot();await action(hand,"draw");
      const points=before.input.stroke.map(p=>boardPoint(p.x+.06,p.y));points.push(points[0]);
      const path=hand.visibleClosedDrawing(points);let running=true,lastSecond=-1,capturing=0,maxPoints=0,failure:unknown=null;
      const start=Date.now();
      const draw=hand.followTimedPath(namedTarget("Workbench drawing surface"),path,10000,()=>this.alive()).catch(error=>{failure=error;}).finally(()=>{running=false;});
      // Observe only. All state changes still enter through the genuine SIK path.
      while(running){
        await sleep(100);this.alive();const state=snapshot();
        if(state.drawMode==="capturing"){
          capturing++;maxPoints=Math.max(maxPoints,state.draftPointCount);
          expect(state.hints.active,"No instructional hand may compete with an active real drawing gesture").toBe(null);
          const second=Math.floor((Date.now()-start)/1000);
          if(second!==lastSecond){lastSecond=second;evidence("draw-smoke:progress",{wallEpochMs:Date.now(),draftPoints:state.draftPointCount,hints:state.hints,projection:state.projection});}
        }
      }
      await draw;if(failure)throw failure;await sleep(500);const after=snapshot();
      expect(capturing).toBeGreaterThan(20);expect(maxPoints).toBeGreaterThan(20);
      expect(after.drawMode).toBe("none");expect(after.snapClosed).toBe(true);
      expect(after.revision).toBe(before.revision+1);expect(after.inputHash).not.toBe(before.inputHash);
      expect(after.verifiedForCurrentRevision).toBe(false);
      expect(after.input.fixedMounts).toEqual(before.input.fixedMounts);
      expect(after.input.tolerances).toEqual(before.input.tolerances);
      evidence("draw-smoke:complete",{wallEpochMs:Date.now(),inputHash:after.inputHash,input:after.input,projection:after.projection,
        scope:"Actual ordered SIK input and hint suppression passed; inspect the full captured pinch/trail interval separately"});
    }finally{await hand.teardown();}
  }
}
