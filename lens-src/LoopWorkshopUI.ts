import {FlexLayout} from "SpectaclesUIKit.lspkg/Scripts/Components/Layout2D/Flex/FlexLayout";
import {FlexItem} from "SpectaclesUIKit.lspkg/Scripts/Components/Layout2D/Flex/FlexItem";
import {FlexAlign,FlexDirection,FlexJustify,FlexAlignSelf} from "SpectaclesUIKit.lspkg/Scripts/Components/Layout2D/Flex/FlexTypes";
import {Button} from "SpectaclesUIKit.lspkg/Scripts/Components/Button/Button";
import {Slider} from "SpectaclesUIKit.lspkg/Scripts/Components/Slider/Slider";
import Event from "SpectaclesInteractionKit.lspkg/Utils/Event";
const TYPE_SCALE={title:{size:54,weight:700},body:{size:39,weight:500},caption:{size:38,weight:500}};
export type LoopUiState={status:string;detail:string;phase:number;playing:boolean;solving:boolean;editLabel:string;editValue:number;metrics:string;drawLabel:string};
/** Contextual UIKit dock; all interactions use standard SIK-backed controls. */
@component
export class LoopWorkshopUI extends BaseScriptComponent {
 public readonly onAction=new Event<string>();public readonly onPhase=new Event<number>();public readonly onEdit=new Event<number>();
 private detailItem:FlexItem;private statusText:Text;private detailText:Text;private metricsText:Text;private editText:Text;private drawText:Text;private playLabel:Text;private solveLabel:Text;private phaseSlider:Slider;private editSlider:Slider;private updating=false;private page="home";private pages:{name:string;root:SceneObject}[]=[];private initialized=false;
 onAwake(){
  this.sceneObject.createComponent("Component.Canvas");const content=this.obj(this.sceneObject,"Loop contextual dock");this.flex(content,FlexDirection.Column,40,24,.5);
  const modes=this.row(content,"Mechanism mode",3.2);this.button(modes,"Loop",19.6,"home",3.2);this.button(modes,"Petal",19.6,"mode:petal",3.2);
  this.statusText=this.text(content,"Reference loop",1.8,"caption");this.detailText=this.text(content,"Draw a closed loop",3,"caption");this.detailItem=this.detailText.sceneObject.getParent().getComponent(FlexItem.getTypeName()) as FlexItem;
  const slot=this.item(content,"Loop contextual controls",40,15.5);
  const home=this.pageRoot(slot,"home",12),actions=this.row(home,"Loop primary actions",4.2);this.playLabel=this.button(actions,"Pause",12.8,"play");this.button(actions,"Draw",12.8,"draw");this.button(actions,"Controls",12.8,"controls");
  this.text(home,"CRANK",1.8,"caption");this.phaseSlider=this.slider(home,"Loop crank phase",v=>this.onPhase.invoke(v));const trace=this.row(home,"Trace inspection",3.2);this.button(trace,"Reveal / trace",40,"reveal",3.2);
  const draw=this.pageRoot(slot,"drawing",12),drawing=this.row(draw,"Drawing actions",4.2);this.button(drawing,"Place",12.8,"place");this.button(drawing,"Draw",12.8,"arm");this.button(drawing,"Close",12.8,"close");this.drawText=this.text(draw,"Drag the blue pen. Release near the start.",3.8,"body");const finish=this.row(draw,"Finish drawing",4.2);this.button(finish,"Clear",12.8,"clear");this.button(finish,"Reference",12.8,"reference");this.button(finish,"Done",12.8,"done");
  const controls=this.pageRoot(slot,"controls",15.5),edit=this.row(controls,"Loop edit mode",4.2);this.button(edit,"Point",9.4,"edit");this.button(edit,"Mount",9.4,"mount");this.button(edit,"Space",9.4,"space");this.button(edit,"Fit limit",9.4,"tolerance");
  this.editText=this.text(controls,"Fit limit 0.30 cm",2.2,"body");this.editSlider=this.slider(controls,"Loop edit value",v=>this.onEdit.invoke(v));const run=this.row(controls,"Loop solve actions",4.2);this.solveLabel=this.button(run,"Solve",9.4,"solve");this.button(run,"Undo",9.4,"undo");this.button(run,"Checks",9.4,"checks");this.button(run,"Done",9.4,"done");
  const checks=this.pageRoot(slot,"checks",14);this.metricsText=this.text(checks,"Sampled verification",5,"body");const saved=this.row(checks,"Loop result actions",4.2);this.button(saved,"Next",12.8,"next");this.button(saved,"Save",12.8,"export");this.button(saved,"Back",12.8,"done");const inspection=this.row(checks,"Loop evidence",4.2);this.button(inspection,"Fit error",12.8,"fit");this.button(inspection,"Contact",12.8,"contact");this.button(inspection,"Study",12.8,"study");
  this.createEvent("UpdateEvent").bind(()=>{if(!this.initialized){this.initialized=true;this.show(this.page);}});
 }
 public show(page:string){this.page=page;this.pages.forEach(p=>p.root.enabled=p.name===page);}
 public getPage(){return this.page;}
 public setState(s:LoopUiState){if(!this.statusText)return;this.updating=true;this.statusText.text=s.status;this.detailText.text=s.detail;this.detailText.sceneObject.enabled=!!s.detail;this.detailItem.overrideHeight=s.detail?3:.01;this.metricsText.text=s.metrics;this.editText.text=s.editLabel;this.drawText.text=s.drawLabel;this.playLabel.text=s.playing?"Pause":"Play";this.solveLabel.text=s.solving?"Cancel":"Solve";this.phaseSlider.currentValue=s.phase;this.editSlider.currentValue=s.editValue;this.updating=false;}
 private dispatch(action:string){if(action==="home"||action==="controls"||action==="checks"){this.show(action);this.onAction.invoke(action);return;}this.onAction.invoke(action);}
 private pageRoot(parent:SceneObject,name:string,h:number){const root=this.obj(parent,"Loop "+name+" page");this.flex(root,FlexDirection.Column,40,h,.5);this.pages.push({name,root});return root;}
 private obj(parent:SceneObject,name:string){const o=global.scene.createSceneObject(name);o.setParent(parent);return o;}
 private item(parent:SceneObject,name:string,w:number,h:number){const o=this.obj(parent,name),item=o.createComponent(FlexItem.getTypeName()) as FlexItem;item.overrideWidth=w;item.overrideHeight=h;item.flexShrink=0;item.alignSelf=FlexAlignSelf.Stretch;const f=parent.getComponent(FlexLayout.getTypeName()) as FlexLayout;if(f)f.addItems([item]);return o;}
 private flex(parent:SceneObject,direction:FlexDirection,w:number,h:number,gap:number){const f=parent.createComponent(FlexLayout.getTypeName()) as FlexLayout;f.autoDiscoverItemsOnStart=false;f.onInitialized.add(()=>{f.direction=direction;f.width=w;f.height=h;f.alignItems=FlexAlign.Stretch;f.justifyContent=FlexJustify.Start;f.rowGap=gap;f.columnGap=gap;});return f;}
 private row(parent:SceneObject,name:string,h:number){const o=this.item(parent,name,40,h);this.flex(o,FlexDirection.Row,40,h,.8);return o;}
 private text(parent:SceneObject,value:string,h:number,role:keyof typeof TYPE_SCALE){return this.label(this.item(parent,`Label ${value}`,40,h),value,40,h,role);}
 private label(parent:SceneObject,value:string,w:number,h:number,role:keyof typeof TYPE_SCALE){const o=this.obj(parent,"Text");o.getTransform().setLocalPosition(new vec3(0,0,.1));const t=o.createComponent("Component.Text") as Text;t.text=value;t.depthTest=true;t.size=TYPE_SCALE[role].size;(t as Text&{weight?:number}).weight=TYPE_SCALE[role].weight;t.textFill.color=role==="title"?new vec4(1,.94,.77,1):new vec4(.85,.96,.86,1);t.horizontalAlignment=HorizontalAlignment.Center;t.verticalAlignment=VerticalAlignment.Center;t.horizontalOverflow=HorizontalOverflow.Wrap;t.verticalOverflow=VerticalOverflow.Overflow;t.layoutRect=Rect.create(-w/2,w/2,-h/2,h/2);return t;}
 private button(parent:SceneObject,label:string,w:number,action:string,h=4.2){const o=this.item(parent,`Loop ${action}`,w,h),b=o.createComponent(Button.getTypeName()) as Button;b.onInitialized.add(()=>{b.size=new vec3(w,h,1);});b.onTriggerUp.add(()=>this.dispatch(action));return this.label(o,label,w-.5,h-.5,"body");}
 private slider(parent:SceneObject,name:string,fn:(value:number)=>void){const o=this.item(parent,name,40,3),s=o.createComponent(Slider.getTypeName()) as Slider;s.size=new vec3(40,3,1);s.currentValue=.5;s.onValueChange.add((value:number)=>{if(!this.updating)fn(value);});return s;}
}
