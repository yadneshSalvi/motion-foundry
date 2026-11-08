import {DefaultLeafInteractor} from "Leaf.lspkg/Interactors/interactor/DefaultLeafInteractor";
import {nextFrame} from "Leaf.lspkg/Utils/common/Utils";
import {Interactable} from "SpectaclesInteractionKit.lspkg/Components/Interaction/Interactable/Interactable";
import {InteractorTriggerType} from "SpectaclesInteractionKit.lspkg/Core/Interactor/Interactor";
import WorldCameraFinderProvider from "SpectaclesInteractionKit.lspkg/Providers/CameraProvider/WorldCameraFinderProvider";

/** A test-only LEAF input command: continuous ray-pinch path, delivered through SIK. */
export class WorkbenchPathInteractor extends DefaultLeafInteractor {
  async followPath(target:Interactable,worldPoints:vec3[]){
    if(worldPoints.length<2)throw Error("A path needs two points");
    await this.enterHover(target);
    this.startPoint=WorldCameraFinderProvider.getInstance().getWorldPosition();
    this.endPoint=worldPoints[0];await nextFrame();await nextFrame();
    this.setTriggerType(InteractorTriggerType.Select);
    await nextFrame();await nextFrame();
    try{
      for(let i=1;i<worldPoints.length;i++){
        this.overrideDragVector=worldPoints[i].sub(worldPoints[i-1]);
        this.endPoint=worldPoints[i];await nextFrame();await nextFrame();
      }
    }finally{
      this.setTriggerType(InteractorTriggerType.None);await nextFrame();await nextFrame();
      this.overrideDragVector=undefined;this.overrideInteractable=undefined;this.resetStartEndPoint();await nextFrame();
    }
  }
}
