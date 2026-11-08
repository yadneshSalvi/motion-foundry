import {FlexLayout} from "SpectaclesUIKit.lspkg/Scripts/Components/Layout2D/Flex/FlexLayout";
import {FlexItem} from "SpectaclesUIKit.lspkg/Scripts/Components/Layout2D/Flex/FlexItem";
import {FlexAlign,FlexDirection,FlexJustify} from "SpectaclesUIKit.lspkg/Scripts/Components/Layout2D/Flex/FlexTypes";
import {Button} from "SpectaclesUIKit.lspkg/Scripts/Components/Button/Button";
import {Slider} from "SpectaclesUIKit.lspkg/Scripts/Components/Slider/Slider";
import Event from "SpectaclesInteractionKit.lspkg/Utils/Event";

export const WORKBENCH_TYPE={button:{size:34,weight:600},label:{size:29,weight:500},detail:{size:29,weight:500}};
export type WorkbenchAction={id:string;label:string};
export type LoopUiState={page:string;actions:WorkbenchAction[];phase?:number;showPhase?:boolean};

type Tool={root:SceneObject;label:Text;action:string;pressed:string};

/** Three persistent UIKit tools, with no dashboard or mode tabs. */
@component
export class LoopWorkshopUI extends BaseScriptComponent {
  public readonly onAction=new Event<string>();
  public readonly onPhase=new Event<number>();
  private tools:Tool[]=[];
  private row:SceneObject;
  private sliderRoot:SceneObject;
  private slider:Slider;
  private page="idle";
  private updating=false;
  private state:LoopUiState={page:"idle",actions:[{id:"draw",label:"Draw"}]};
  private started=false;

  onAwake(){
    this.sceneObject.createComponent("Component.Canvas");
    this.row=this.object(this.sceneObject,"Workbench contextual tools");
    const flex=this.row.createComponent(FlexLayout.getTypeName()) as FlexLayout;
    flex.autoDiscoverItemsOnStart=false;
    flex.onInitialized.add(()=>{flex.direction=FlexDirection.Row;flex.width=30.4;flex.height=5;flex.columnGap=1.4;flex.rowGap=1.4;flex.alignItems=FlexAlign.Center;flex.justifyContent=FlexJustify.Center;});
    for(const name of ["left","middle","right"]){
      const item=this.object(this.row,"Workbench tool slot "+name),layout=item.createComponent(FlexItem.getTypeName()) as FlexItem;
      layout.overrideWidth=9.2;layout.overrideHeight=5;layout.flexShrink=0;flex.addItems([layout]);
      const root=this.object(item,"Workbench action "+name),button=root.createComponent(Button.getTypeName()) as Button;
      button.playAudio=true;button.onInitialized.add(()=>button.size=new vec3(9.2,5,1));
      const label=this.label(root,"",8.6,4.3),tool:Tool={root,label,action:"",pressed:""};this.tools.push(tool);
      button.onTriggerDown.add(()=>tool.pressed=tool.action);
      button.onTriggerUp.add(()=>{const action=tool.pressed;tool.pressed="";if(action&&action===tool.action)this.onAction.invoke(action);});
    }
    this.sliderRoot=this.object(this.sceneObject,"Workbench optional phase control");
    this.sliderRoot.getTransform().setLocalPosition(new vec3(0,3.6,0));
    this.slider=this.sliderRoot.createComponent(Slider.getTypeName()) as Slider;
    this.slider.size=new vec3(27,3.8,1);this.slider.currentValue=0;this.slider.playAudio=true;
    this.slider.onValueChange.add(value=>{if(!this.updating&&this.state.showPhase)this.onPhase.invoke(value);});
    this.createEvent("UpdateEvent").bind(()=>{if(!this.started){this.started=true;this.apply();}});
  }
  public setState(state:LoopUiState){
    if(state.actions.length+(state.showPhase?1:0)>3)throw Error("Workbench states may contain at most three primary targets");
    this.state=state;this.page=state.page;if(this.started)this.apply();
  }
  public getPage(){return this.page;}
  public getActions(){return this.state.actions.map(a=>({...a}));}
  private apply(){
    const active=this.state.actions,indices=active.length===1?[1]:active.length===2?[0,1]:[0,1,2];
    const t=this.row.getTransform();t.setLocalPosition(new vec3(active.length===2?5.3:0,this.state.showPhase?-2.5:0,0));
    this.tools.forEach((tool,index)=>{
      const position=indices.indexOf(index),action=position>=0?active[position]:undefined;
      tool.action=action?.id||"";
      if(action&&tool.label.text!==action.label)tool.label.text=action.label;
      if(tool.root.enabled!==!!action)tool.root.enabled=!!action;
    });
    if(this.sliderRoot.enabled!==!!this.state.showPhase)this.sliderRoot.enabled=!!this.state.showPhase;
    this.updating=true;if(this.state.phase!==undefined)this.slider.currentValue=this.state.phase;this.updating=false;
  }
  private object(parent:SceneObject,name:string){const o=global.scene.createSceneObject(name);o.setParent(parent);return o;}
  private label(parent:SceneObject,value:string,w:number,h:number){
    const o=this.object(parent,"Tool label");o.getTransform().setLocalPosition(new vec3(0,0,.12));
    const t=o.createComponent("Component.Text") as Text;t.text=value;t.depthTest=true;t.size=WORKBENCH_TYPE.button.size;
    (t as Text&{weight?:number}).weight=WORKBENCH_TYPE.button.weight;
    t.textFill.color=new vec4(.93,.98,.92,1);t.horizontalAlignment=HorizontalAlignment.Center;t.verticalAlignment=VerticalAlignment.Center;
    t.horizontalOverflow=HorizontalOverflow.Wrap;t.verticalOverflow=VerticalOverflow.Overflow;t.layoutRect=Rect.create(-w/2,w/2,-h/2,h/2);return t;
  }
}
