import {FlexLayout} from "SpectaclesUIKit.lspkg/Scripts/Components/Layout2D/Flex/FlexLayout";
import {FlexItem} from "SpectaclesUIKit.lspkg/Scripts/Components/Layout2D/Flex/FlexItem";
import {FlexAlign,FlexDirection,FlexJustify} from "SpectaclesUIKit.lspkg/Scripts/Components/Layout2D/Flex/FlexTypes";
import {Button} from "SpectaclesUIKit.lspkg/Scripts/Components/Button/Button";
import Event from "SpectaclesInteractionKit.lspkg/Utils/Event";
import {applyWorkbenchText,styleWorkbenchButton,setWorkbenchOpacity} from "./WorkbenchStyle";
export {WORKBENCH_TYPE} from "./WorkbenchStyle";

export type WorkbenchAction={id:string;label:string};
export type LoopUiState={page:string;actions:WorkbenchAction[];undo?:{position:vec3;rotation:quat}};
type Tool={root:SceneObject;label:Text;button:Button;action:string;pressed:string};

/** Three persistent UIKit slots. A contextual Undo chip uses one of the same budget. */
@component
export class LoopWorkshopUI extends BaseScriptComponent {
  public readonly onAction=new Event<string>();
  public readonly onEngaged=new Event<void>();
  private tools:Tool[]=[];
  private undo:Tool;
  private row:SceneObject;
  private page="idle";
  private state:LoopUiState={page:"idle",actions:[{id:"draw",label:"Draw"}]};
  private started=false;
  private opacity=1;

  onAwake(){
    this.sceneObject.createComponent("Component.Canvas");
    this.row=this.object(this.sceneObject,"Workbench contextual tools");
    const flex=this.row.createComponent(FlexLayout.getTypeName()) as FlexLayout;
    flex.autoDiscoverItemsOnStart=false;
    flex.onInitialized.add(()=>{flex.direction=FlexDirection.Row;flex.width=31.6;flex.height=5;flex.columnGap=2;flex.rowGap=2;flex.alignItems=FlexAlign.Center;flex.justifyContent=FlexJustify.Center;});
    for(const name of ["left","middle","right"]){
      const item=this.object(this.row,"Workbench tool slot "+name),layout=item.createComponent(FlexItem.getTypeName()) as FlexItem;
      layout.overrideWidth=9.2;layout.overrideHeight=5;layout.flexShrink=0;flex.addItems([layout]);
      this.tools.push(this.tool(item,"Workbench action "+name,9.2,5));
    }
    this.undo=this.tool(this.sceneObject,"Workbench undo chip",6.2,4);
    this.undo.action="undo";this.undo.label.text="Undo";
    this.createEvent("UpdateEvent").bind(()=>{if(!this.started){this.started=true;this.apply();}});
  }
  public setState(state:LoopUiState){
    if(state.actions.length+(state.undo?1:0)>3)throw Error("Workbench UI may contain at most three buttons, including Undo and Back");
    this.state=state;this.page=state.page;if(this.started)this.apply();
  }
  public setOpacity(value:number){
    this.opacity=Math.max(0,Math.min(1,value));
    if(!this.started)return;
    for(const tool of [...this.tools,this.undo]){
      setWorkbenchOpacity(tool.button,this.opacity);
      tool.label.textFill.color=new vec4(1,1,1,this.opacity);
      if(tool.button.initialized)tool.button.inactive=this.opacity<.2;
    }
  }
  public getPage(){return this.page;}
  public getActions(){return this.state.actions.map(a=>({...a}));}
  public undoVisible(){return!!this.state.undo;}
  private apply(){
    const active=this.state.actions,indices=active.length===1?[1]:active.length===2?[0,1]:[0,1,2];
    this.row.getTransform().setLocalPosition(new vec3(active.length===2?5.6:0,0,0));
    this.tools.forEach((tool,index)=>{
      const position=indices.indexOf(index),action=position>=0?active[position]:undefined;
      tool.action=action?.id||"";
      if(action&&tool.label.text!==action.label)tool.label.text=action.label;
      if(tool.root.enabled!==!!action)tool.root.enabled=!!action;
    });
    const undo=this.state.undo;
    if(this.undo.root.enabled!==!!undo)this.undo.root.enabled=!!undo;
    if(undo){this.undo.root.getTransform().setWorldPosition(undo.position);this.undo.root.getTransform().setWorldRotation(undo.rotation);}
    this.setOpacity(this.opacity);
  }
  private tool(parent:SceneObject,name:string,width:number,height:number):Tool{
    const root=this.object(parent,name),button=root.createComponent(Button.getTypeName()) as Button;
    const face=styleWorkbenchButton(button,new vec3(width,height,1));
    const label=this.label(face,"",width-.8,height-.5),tool:Tool={root,label,button,action:"",pressed:""};
    button.onHoverEnter.add(()=>this.onEngaged.invoke());
    button.onTriggerDown.add(()=>{tool.pressed=tool.action;this.onEngaged.invoke();});
    button.onTriggerUp.add(()=>{const action=tool.pressed;tool.pressed="";if(action&&action===tool.action)this.onAction.invoke(action);});
    return tool;
  }
  private object(parent:SceneObject,name:string){const o=global.scene.createSceneObject(name);o.setParent(parent);return o;}
  private label(parent:SceneObject,value:string,w:number,h:number){
    const o=this.object(parent,"Tool label");o.getTransform().setLocalPosition(new vec3(0,0,.16));
    const t=o.createComponent("Component.Text") as Text;t.text=value;applyWorkbenchText(t,"button");
    t.horizontalAlignment=HorizontalAlignment.Center;t.verticalAlignment=VerticalAlignment.Center;
    t.horizontalOverflow=HorizontalOverflow.Wrap;t.verticalOverflow=VerticalOverflow.Overflow;t.layoutRect=Rect.create(-w/2,w/2,-h/2,h/2);return t;
  }
}
