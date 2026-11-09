import {expect} from "Leaf.lspkg/Utils/common/Expect";
import {sleep} from "Leaf.lspkg/Utils/common/Utils";
import {WorkbenchPathInteractor} from "./WorkbenchPathInteractor";
import {action,snapshot} from "./WorkbenchScenarioTools";

/** Same-session Save/Send flow using only genuine SIK actions and the live backend. */
export class WorkbenchExportFilm {
  constructor(private stamp:(event:string,detail?:unknown)=>void,private alive:()=>void){}
  async run(input:WorkbenchPathInteractor){
    this.alive();
    const accepted=snapshot();
    if(accepted.source!=="HTTPS solve"||!accepted.hasReceipt||!accepted.verifiedForCurrentRevision||!accepted.verification.valid||accepted.input.obstacles.length!==1)
      throw Error("Run the fresh-draw mug-repair journey or rehearsal first; Save must export that actual verified design");
    const start=Date.now();
      this.stamp("save-current-design",{wallEpochMs:start,runtimeSeconds:getTime(),input:accepted.input,inputHash:accepted.inputHash,parameters:accepted.parameters,candidateId:accepted.candidateId,disclosure:"Scripted synthetic SIK hand input in Preview"});
      await action(input,"export");
      expect(snapshot().uiPage).toBe("share");
      expect(snapshot().sharing).toBe(false);
      await action(input,"send");
      const deadline=getTime()+22;
      while(snapshot().sharing&&getTime()<deadline){this.alive();await sleep(100);}
      await sleep(150);this.alive();
      const shared=snapshot();expect(shared.sharing).toBe(false);
      expect(shared.input).toEqual(accepted.input);expect(shared.parameters).toEqual(accepted.parameters);
      expect(shared.inputHash).toBe(accepted.inputHash);expect(shared.candidateId).toBe(accepted.candidateId);
      expect(shared.verifiedForCurrentRevision).toBe(true);expect(shared.verification.valid).toBe(true);
      expect(shared.exportUrl.startsWith("https://motion-foundry-nine.vercel.app/design/loop/")).toBe(true);
      expect(shared.qr.visible).toBe(true);expect(shared.qr.moduleCount).toBeGreaterThan(20);
      expect(shared.actions.map(a=>a.id)).toEqual(["back"]);
      expect(shared.qr.exclusions.length).toBe(2);
      this.stamp("actual-share-visible",{wallEpochMs:Date.now(),runtimeSeconds:getTime(),inputHash:shared.inputHash,exportUrl:shared.exportUrl,qr:shared.qr});
      const holdEnd=getTime()+8;
      while(getTime()<holdEnd){this.alive();const current=snapshot();expect(current.qr.visible).toBe(true);expect(current.exportUrl).toBe(shared.exportUrl);expect(current.inputHash).toBe(shared.inputHash);await sleep(100);}
      this.stamp("export-complete",{durationMs:Date.now()-start,audio:snapshot().audio});
  }
}
