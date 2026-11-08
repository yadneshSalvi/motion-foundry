import WorldCameraFinderProvider from "SpectaclesInteractionKit.lspkg/Providers/CameraProvider/WorldCameraFinderProvider";
import {LoopAssembly} from "./LoopAssembly";
import {LoopInput,LoopVerification} from "./LoopDomain";
import {WORKBENCH_TYPE} from "./LoopWorkshopUI";

type Label={root:SceneObject;text:Text};
export type LabelFrame={drawing:boolean;fresh:boolean;solving:boolean;message:string;messageUntil:number;firstUse:boolean;hover:string;showFit:boolean;showContact:boolean;placement:string;about:boolean};

/** Small depth-tested annotations stay with the thing they describe, not with the head. */
export class WorkbenchLabels {
  private camera=WorldCameraFinderProvider.getInstance();
  private labels:{[key:string]:Label}={};
  private openedAt=getTime();
  constructor(private parent:SceneObject,private assembly:LoopAssembly){
    for(const key of ["status","hint","fit","contact","mount","dial","scope","about"])this.labels[key]=this.make(key);
  }
  public near(point:vec3,cm=40){return point.distance(this.camera.getWorldPosition())<cm;}
  public tick(input:LoopInput,audit:LoopVerification,frame:LabelFrame){
    for(const key of Object.keys(this.labels))this.labels[key].root.enabled=false;
    const base=this.assembly.worldPoint({x:8,y:-5.5},.6);
    const nearBase=this.near(base,95),detail=this.near(this.assembly.worldPoint({x:8,y:5},1),42);
    if(frame.solving)this.show("status","Finding the machine…",base);
    else if(frame.message&&getTime()<frame.messageUntil)this.show("status",frame.message,base);
    else if(frame.fresh&&audit.valid&&nearBase)this.show("status","Fits within "+this.mm(input.tolerances.fitCm)+" mm",base);
    else if(!frame.fresh&&!frame.drawing&&nearBase)this.show("status","Make it again",base);
    if(frame.drawing)this.show("hint","Pinch and draw on the board",this.assembly.worldPoint({x:8,y:14.7},.5));
    else if(frame.firstUse)this.show("hint","Turn the crank",this.assembly.worldPoint(this.assembly.crankPoint,this.assembly.crankHeight+2.7));
    else if(frame.hover==="crank")this.show("hint","Turn to draw",this.assembly.worldPoint(this.assembly.crankPoint,this.assembly.crankHeight+2.7));
    if(frame.showFit&&audit.fitWitness){
      const witness=audit.fitWitness;
      this.show("fit",this.mm(witness.errorCm)+" mm off",this.assembly.worldPoint({x:witness.actual.x+1.5,y:witness.actual.y+1.2},.6));
    }
    if(frame.showContact&&audit.collisionWitness){
      const o=input.obstacles.find(o=>o.id===audit.collisionWitness!.obstacleId);
      if(o&&(detail||frame.hover==="obstacle"||getTime()<frame.messageUntil))this.show("contact","Hits the provided container",this.assembly.worldPoint({x:o.center.x,y:o.center.y},(o.layerZCm??6)+(o.depthCm??12)/2+1.3));
    }
    if(frame.hover==="mount")this.show("mount",input.fixedMounts.groundCm.toFixed(1)+" cm mounts",this.assembly.worldPoint({x:input.fixedMounts.groundCm,y:-2.2},1.4));
    if(frame.hover==="fit")this.show("dial","Fit within "+this.mm(input.tolerances.fitCm)+" mm",this.assembly.worldPoint({x:21,y:-1.3},1.5));
    if(frame.hover==="obstacle"&&input.obstacles[0]){
      const o=input.obstacles[0];
      this.show("scope","Provided container · no detection",this.assembly.worldPoint({x:o.center.x,y:o.center.y+o.radiusCm+1.5},.7));
    }else if(getTime()-this.openedAt<4.5)this.show("scope","Preview · simulated room\n"+frame.placement,this.assembly.worldPoint({x:8,y:15.5},1));
    if(frame.about)this.show("about","Sampled rods and layers checked.\nPins, clamps and pen are decorative.",this.assembly.worldPoint({x:8,y:12},5.8));
  }
  private mm(cm:number){const mm=cm*10;return mm<1?mm.toFixed(1):mm.toFixed(0);}
  private make(name:string):Label{
    const root=global.scene.createSceneObject("Workbench "+name+" annotation");root.setParent(this.parent);
    const text=root.createComponent("Component.Text") as Text;text.depthTest=true;text.size=WORKBENCH_TYPE.label.size;
    (text as Text&{weight?:number}).weight=WORKBENCH_TYPE.label.weight;
    text.outlineSettings.enabled=true;text.outlineSettings.size=.16;text.outlineSettings.fill.color=new vec4(.035,.055,.05,.94);
    text.textFill.color=new vec4(.98,.98,.88,1);text.horizontalAlignment=HorizontalAlignment.Center;text.verticalAlignment=VerticalAlignment.Center;
    text.horizontalOverflow=HorizontalOverflow.Wrap;text.verticalOverflow=VerticalOverflow.Overflow;text.layoutRect=Rect.create(-7,7,-1.8,1.8);
    root.enabled=false;return{root,text};
  }
  private show(key:string,value:string,point:vec3){
    const label=this.labels[key];label.text.text=value;label.root.enabled=true;
    const t=label.root.getTransform();t.setWorldPosition(point);t.setWorldRotation(this.camera.getTransform().getWorldRotation());
  }
}
