/** Retained Petal UI. The shipping native entry point instantiates LoopWorkshopUI instead. */
import {FlexLayout} from "SpectaclesUIKit.lspkg/Scripts/Components/Layout2D/Flex/FlexLayout";
import {FlexItem} from "SpectaclesUIKit.lspkg/Scripts/Components/Layout2D/Flex/FlexItem";
import {FlexAlign,FlexDirection,FlexJustify,FlexAlignSelf} from "SpectaclesUIKit.lspkg/Scripts/Components/Layout2D/Flex/FlexTypes";
import {Button} from "SpectaclesUIKit.lspkg/Scripts/Components/Button/Button";
import {Slider} from "SpectaclesUIKit.lspkg/Scripts/Components/Slider/Slider";
import Event from "SpectaclesInteractionKit.lspkg/Utils/Event";
const TYPE_SCALE={title:{size:54,weight:700},body:{size:39,weight:500},caption:{size:38,weight:500}};
type UiState={status:string;detail:string;editLabel:string;editValue:number;phase:number;playing:boolean;reveal:boolean;metrics?:string};
/** An unbacked spatial dock. Each page is a UIKit flex composition, never a tall control rack. */
@component
export class MotionWorkshopUI extends BaseScriptComponent {
 public readonly onAction=new Event<string>();public readonly onPhase=new Event<number>();public readonly onEdit=new Event<number>();
 private statusText!:Text;private detailText!:Text;private editText!:Text;private metricsText!:Text;private phaseSlider!:Slider;private editSlider!:Slider;private playLabel!:Text;private revealLabel!:Text;private updating=false;private page="browse";private pages:{name:string;root:SceneObject}[]=[];private initialized=false;
 private state:UiState={status:"Bundled example",detail:"One computed cell · centimetres",editLabel:"Target 1",editValue:.5,phase:0,playing:true,reveal:false};
 onAwake(){
  this.sceneObject.createComponent("Component.Canvas");
  const content=this.obj(this.sceneObject,"Floating workshop dock");this.flex(content,FlexDirection.Column,40,22,.5);
  const modes=this.row(content,"Mechanism mode",3.2);this.button(modes,"Loop",19.6,"mode:loop",3.2);this.button(modes,"Petal",19.6,"mode:petal",3.2);this.statusText=this.text(content,this.state.status,1.8,"caption");this.detailText=this.text(content,this.state.detail,2.8,"caption");
  const slot=this.item(content,"Contextual controls",40,12.5);
  const browse=this.pageRoot(slot,"browse",12.5),top=this.row(browse,"Playback",4.4);
  this.playLabel=this.button(top,"Pause",12.8,"play");this.revealLabel=this.button(top,"Reveal",12.8,"reveal");this.button(top,"Design",12.8,"design");
  this.text(browse,"TURN THE CRANK",1.8,"caption");this.phaseSlider=this.slider(browse,"Crank phase",value=>this.onPhase.invoke(value));
  const design=this.pageRoot(slot,"design",13.5),mode=this.row(design,"Edit mode",4.2);this.button(mode,"Pose",12.8,"pose");this.button(mode,"Mount",12.8,"mount");this.button(mode,"Space",12.8,"space");
  this.editText=this.text(design,this.state.editLabel,2,"body");this.editSlider=this.slider(design,"Edit constraint",value=>this.onEdit.invoke(value));
  const actions=this.row(design,"Solve actions",4.2);this.button(actions,"Solve",9.4,"solve");this.button(actions,"Undo",9.4,"undo");this.button(actions,"Checks",9.4,"checks");this.button(actions,"Done",9.4,"done");
  const checks=this.pageRoot(slot,"checks",13.5);this.metricsText=this.text(checks,"360° input · sampled clearance",4.4,"body");
  const choices=this.row(checks,"Design actions",4.2);this.button(choices,"Next",12.8,"next");this.button(choices,"Save",12.8,"export");this.button(choices,"Back",12.8,"back");const test=this.row(checks,"Contradiction study",3.8);this.button(test,"Test conflicting targets",40,"conflict");
  // Hide pages only after every child has received OnStart and initialized its UIKit internals.
  this.createEvent("UpdateEvent").bind(()=>{if(!this.initialized){this.initialized=true;this.showPage();}});this.setState(this.state);
 }
 public setState(state:UiState){this.state=state;if(!this.statusText)return;this.updating=true;this.statusText.text=state.status;this.detailText.text=state.detail;this.editText.text=state.editLabel;this.metricsText.text=state.metrics||"Full input rotation · sampled geometry";this.phaseSlider.currentValue=state.phase;this.editSlider.currentValue=state.editValue;this.playLabel.text=state.playing?"Pause":"Play";this.revealLabel.text=state.reveal?"Petal":"Reveal";this.updating=false;}
 private showPage(){this.pages.forEach(p=>{p.root.enabled=p.name===this.page;});}
 private dispatch(action:string){if(action==="mode:petal"){this.page="browse";this.showPage();return;}if(action==="design"||action==="checks"){this.page=action;this.showPage();return;}if(action==="done"||action==="back"){this.page="browse";this.showPage();return;}this.onAction.invoke(action);}
 private pageRoot(parent:SceneObject,name:string,h:number){const root=this.obj(parent,`Workshop ${name} page`);this.flex(root,FlexDirection.Column,40,h,.5);this.pages.push({name,root});return root;}
 private obj(parent:SceneObject,name:string){const o=global.scene.createSceneObject(name);o.setParent(parent);return o;}
 private item(parent:SceneObject,name:string,w:number,h:number){const o=this.obj(parent,name),item=o.createComponent(FlexItem.getTypeName()) as FlexItem;item.overrideWidth=w;item.overrideHeight=h;item.flexShrink=0;item.alignSelf=FlexAlignSelf.Stretch;const f=parent.getComponent(FlexLayout.getTypeName()) as FlexLayout;if(f)f.addItems([item]);return o;}
 private flex(parent:SceneObject,direction:FlexDirection,w:number,h:number,gap:number){const f=parent.createComponent(FlexLayout.getTypeName()) as FlexLayout;f.autoDiscoverItemsOnStart=false;f.onInitialized.add(()=>{f.direction=direction;f.width=w;f.height=h;f.alignItems=FlexAlign.Stretch;f.justifyContent=FlexJustify.Start;f.rowGap=gap;f.columnGap=gap;});return f;}
 private row(parent:SceneObject,name:string,h:number){const o=this.item(parent,name,40,h);this.flex(o,FlexDirection.Row,40,h,.8);return o;}
 private text(parent:SceneObject,value:string,h:number,role:keyof typeof TYPE_SCALE){return this.label(this.item(parent,`Label ${value}`,40,h),value,40,h,role);}
 private label(parent:SceneObject,value:string,w:number,h:number,role:keyof typeof TYPE_SCALE){const o=this.obj(parent,"Text");o.getTransform().setLocalPosition(new vec3(0,0,.1));const t=o.createComponent("Component.Text") as Text;t.text=value;t.depthTest=true;t.size=TYPE_SCALE[role].size;(t as Text&{weight?:number}).weight=TYPE_SCALE[role].weight;t.textFill.color=role==="title"?new vec4(1,.94,.77,1):new vec4(.85,.96,.86,1);t.horizontalAlignment=HorizontalAlignment.Center;t.verticalAlignment=VerticalAlignment.Center;t.horizontalOverflow=HorizontalOverflow.Wrap;t.verticalOverflow=VerticalOverflow.Overflow;t.layoutRect=Rect.create(-w/2,w/2,-h/2,h/2);return t;}
 private button(parent:SceneObject,label:string,w:number,action:string,h=4.2){const o=this.item(parent,`MF ${action}`,w,h),b=o.createComponent(Button.getTypeName()) as Button;b.onInitialized.add(()=>{b.size=new vec3(w,h,1);});b.onTriggerUp.add(()=>this.dispatch(action));return this.label(o,label,w-.5,h-.5,"body");}
 private slider(parent:SceneObject,name:string,fn:(value:number)=>void){const o=this.item(parent,name,40,3),s=o.createComponent(Slider.getTypeName()) as Slider;s.size=new vec3(40,3,1);s.currentValue=.5;s.onValueChange.add((value:number)=>{if(!this.updating)fn(value);});return s;}
}
