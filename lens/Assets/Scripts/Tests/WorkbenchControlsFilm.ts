import {expect} from "Leaf.lspkg/Utils/common/Expect";
import {sleep} from "Leaf.lspkg/Utils/common/Utils";
import {dialAngleFromFit} from "../WorkbenchGeometry";
import {WorkbenchPathInteractor} from "./WorkbenchPathInteractor";
import {action,actionTarget,boardPoint,namedTarget,snapshot,waitForResult} from "./WorkbenchScenarioTools";

/** Real SIK control actions reused inside ONE registered LEAF scenario/session.
 * This is not a product handler and cannot install a fixture or solve result. */
export class WorkbenchControlsFilm {
  constructor(private stamp:(event:string,detail?:unknown)=>void,private alive:()=>void){}
  private receipt(event:string){
    const s=snapshot();this.stamp(event,{source:s.source,input:s.input,inputHash:s.inputHash,parameters:s.parameters,candidateId:s.candidateId,verification:s.verification,verifiedForCurrentRevision:s.verifiedForCurrentRevision,serverReceiptPresent:s.hasReceipt,placement:s.placement,audio:s.audio});
  }
  async run(input:WorkbenchPathInteractor,mode:"controls"|"place"){
    this.alive();
    const initial=snapshot();
    if(initial.solving||initial.sharing||initial.drawMode!=="none"||initial.editing||initial.cranking)
      throw Error("Finish the active action before starting the controls flow");
    if(initial.source!=="HTTPS solve"||!initial.hasReceipt||!initial.verifiedForCurrentRevision||!initial.verification.valid||initial.revision<1||initial.input.obstacles.length!==1)
      throw Error("The same-session freshly drawn and repaired HTTPS design is required; never reload a fixture for support footage");
    this.stamp("support-flow-start",{mode});this.receipt("support-initial");
    if(mode==="controls")await this.controls(input);
    else await this.place(input);
    this.receipt("support-complete");this.stamp("support-flow-complete",{mode});
  }
  /** Isolated Preview QA of the identical mount/held-readout/Undo gesture.
   * It does not qualify the bundled reference as same-drawing film footage. */
  async probeMount(input:WorkbenchPathInteractor){
    const before=snapshot();
    if(before.solving||before.sharing||before.editing||before.cranking||before.drawMode!=="none")
      throw Error("Mount probe requires an idle workbench");
    this.stamp("mount-probe-start",{inputHash:before.inputHash,scope:"Gesture/layout QA only; no film continuity claim"});
    await this.mount(input);this.alive();
    const after=snapshot();expect(after.input).toEqual(before.input);expect(after.parameters).toEqual(before.parameters);
    this.receipt("mount-probe-restored");
  }
  private async path(input:WorkbenchPathInteractor,name:string,points:vec3[],ms:number){
    this.stamp("gesture-start",{target:name,durationMs:ms});
    await input.followTimedPath(namedTarget(name),points,ms,this.alive,name==="Workbench movable mount"?async()=>{
      await sleep(350);this.alive();const held=snapshot();
      expect(held.editing).toBe("mount");
      expect(held.projection.gestureOccluders.length,"The live value layout must see the actual tracked hand").toBeGreaterThan(0);
      const label=held.projection.labels.find(l=>l.id==="mount");
      expect(!!label&&label.opacity>.8&&label.overlaps.length===0,"Read the mount value beside the held hand, with no projected overlap").toBe(true);
      this.stamp("mount-held-value",{wallEpochMs:Date.now(),valueCm:held.input.fixedMounts.groundCm,label,gestureOccluders:held.projection.gestureOccluders});
    }:undefined);this.alive();
    this.receipt("gesture-end:"+name);
  }
  private async controls(input:WorkbenchPathInteractor){
    const original=snapshot();
    expect(original.input.tolerances.fitCm,"Start at the actual 3 mm fit limit").toBe(.3);
    await this.fit(input);await this.mug(input);await this.mount(input);
    const requested=snapshot();
    expect(requested.input.stroke).toEqual(original.input.stroke);
    expect(requested.input.fixedMounts).toEqual(original.input.fixedMounts);
    expect(requested.input.tolerances).toEqual(original.input.tolerances);
    expect(requested.input.obstacles[0].radiusCm).toBe(4.5);
    expect(requested.input).toEqual({...original.input,revision:requested.input.revision,obstacles:requested.input.obstacles});
    if(original.input.obstacles.length)expect(requested.input.obstacles).toEqual(original.input.obstacles);
    // Fit/rim edits invalidate receipt freshness even when their final values return.
    expect(requested.verifiedForCurrentRevision).toBe(false);
    await this.makeCurrent(input,requested);
  }
  private async fit(input:WorkbenchPathInteractor){
    expect(snapshot().input.tolerances.fitCm).toBe(.3);
    // Touch the outer dial face and turn its true 270-degree mapping, in both directions.
    for(const [from,to] of [[.3,.2],[.2,.3]]){
      const a=dialAngleFromFit(from),b=dialAngleFromFit(to),r=1.35;
      const points=Array.from({length:49},(_,i)=>{const t=a+(b-a)*i/48;return boardPoint(21+r*Math.cos(t),-6.5+r*Math.sin(t),1.2);});
      await this.path(input,"Workbench fit dial",points,2400);
      expect(snapshot().input.tolerances.fitCm).toBe(to);await this.observe(700);
    }
  }
  private async mug(input:WorkbenchPathInteractor){
    const beforeMug=snapshot();
    if(!beforeMug.input.obstacles.length){
      this.stamp("mug-add-start");await input.trigger(namedTarget("Workbench measured keep-out"));this.alive();this.receipt("mug-add-end");
    }
    let mug=snapshot().input.obstacles[0];
    expect(mug.radiusCm,"Start with the default measured 4.5 cm mug ring").toBe(4.5);
    const fixedMug={...mug,center:{...mug.center}};
    for(const radius of [5,4.5]){
      mug=snapshot().input.obstacles[0];
      const from=boardPoint(mug.center.x,mug.center.y-mug.radiusCm,(mug.layerZCm||2)+(mug.depthCm||4)/2);
      const to=boardPoint(mug.center.x,mug.center.y-radius,(mug.layerZCm||2)+(mug.depthCm||4)/2);
      await this.path(input,"Workbench mug size handle",[from,to],2200);
      expect(snapshot().input.obstacles[0]).toEqual({...fixedMug,radiusCm:radius});await this.observe(700);
    }
  }
  private async mount(input:WorkbenchPathInteractor){
    const beforeMount=snapshot(),mount=namedTarget("Workbench movable mount").getTransform().getWorldPosition();
    const delta=boardPoint(1,0,.7).sub(boardPoint(0,0,.7));
    await this.path(input,"Workbench movable mount",[mount,mount.add(delta)],2200);
    expect(snapshot().input.fixedMounts.groundCm).toBe(beforeMount.input.fixedMounts.groundCm+1);
    expect(snapshot().undoChipVisible).toBe(true);
    this.stamp("undo-chip-start");await input.trigger(namedTarget("Workbench undo chip"));this.alive();
    expect(snapshot().input).toEqual(beforeMount.input);expect(snapshot().parameters).toEqual(beforeMount.parameters);
    this.receipt("undo-chip-end");
  }
  private async makeCurrent(input:WorkbenchPathInteractor,requested:ReturnType<typeof snapshot>){
    this.stamp("real-https-solve-start",{inputHash:requested.inputHash});
    await action(input,"solve");this.alive();const result=await waitForResult(33,this.alive);
    expect(result.input).toEqual(requested.input);expect(result.source).toBe("HTTPS solve");
    expect(result.hasReceipt).toBe(true);expect(result.verifiedForCurrentRevision).toBe(true);
    expect(result.verification.valid).toBe(true);expect(result.verification.inputHash).toBe(requested.inputHash);
    this.receipt("real-https-solve-complete");await this.observe(1600);
  }
  private async place(input:WorkbenchPathInteractor){
    const before=snapshot();
    if(before.uiPage!=="more"){await action(input,"more");this.alive();}
    this.stamp("place-action-start");await action(input,"place");this.alive();
    expect(snapshot().placement.mode).toBe("placing");
    const deadline=getTime()+20;this.stamp("worldquery-wait-start");
    while(!snapshot().actions.some(a=>a.id==="place:commit")){
      this.alive();if(getTime()>deadline)throw Error("No genuine WorldQuery table hit within 20 seconds; root must aim the camera at a real Preview table");await sleep(80);
    }
    const hit=snapshot().placement.hit;expect(hit).not.toBeNull();
    this.stamp("worldquery-hit",snapshot().placement);
    // Current genuine hit is re-checked by the product at the actual SIK release.
    await input.trigger(actionTarget("place:commit"));this.alive();await sleep(180);
    const placed=snapshot();expect(placed.placement.mode).toBe("surface");
    expect(placed.placement.source).toBe("WorldQuery table placement");
    expect(placed.placement.commits).toBe(before.placement.commits+1);
    expect(placed.input).toEqual(before.input);
    expect(placed.tableWorldPosition.x).toBeCloseTo(placed.placement.hit!.x,3);
    expect(placed.tableWorldPosition.y).toBeCloseTo(placed.placement.hit!.y+.5,3);
    expect(placed.tableWorldPosition.z).toBeCloseTo(placed.placement.hit!.z,3);
    this.receipt("worldquery-real-commit");await this.observe(1800);
  }
  private async observe(ms:number){
    const deadline=getTime()+ms/1000;
    while(getTime()<deadline){this.alive();await sleep(80);}
  }
}
