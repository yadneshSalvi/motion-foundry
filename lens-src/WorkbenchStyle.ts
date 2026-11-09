import {Button} from "SpectaclesUIKit.lspkg/Scripts/Components/Button/Button";
import {RoundedRectangleVisual,RoundedRectangleVisualState} from "SpectaclesUIKit.lspkg/Scripts/Visuals/RoundedRectangle/RoundedRectangleVisual";

/** One role scale: measured cap-height is a native Center-view acceptance gate. */
export const WORKBENCH_TYPE={button:{size:58,weight:600},label:{size:53,weight:600},detail:{size:53,weight:500},glyph:{size:120,weight:700}};
export function applyWorkbenchText(text:Text,role:keyof typeof WORKBENCH_TYPE){
  text.size=WORKBENCH_TYPE[role].size;
  (text as Text&{weight?:number}).weight=WORKBENCH_TYPE[role].weight;
  text.depthTest=true;text.textFill.color=new vec4(1,1,1,1);
}

/** Public UIKit styling only; persistent targets retain the SDK's SIK/audio lifecycle. */
export function styleWorkbenchButton(button:Button,size:vec3){
  button.setVariant({theme:"SnapOS2",shape:"Rectangle",style:"PrimaryNeutral"});
  button.size=size;button.playAudio=true;
  const state=(hover=false,pressed=false,inactive=false):RoundedRectangleVisualState=>({
    baseType:"Color",baseColor:new vec4(.025*(hover?1.1:1),.04*(hover?1.1:1),.055*(hover?1.1:1),.78),hasBorder:true,
    borderType:"Color",borderSize:hover?.28:.24,borderColor:new vec4(.82,.9,.94,inactive?.82*.3:hover?1:.82),
    shouldScale:true,localScale:new vec3(hover?1.04:1,hover?1.04:1,1),
    shouldPosition:true,localPosition:new vec3(0,0,pressed?-.35:0),
  });
  // This public custom-visual constructor has no theme key to overwrite its colors.
  // Animate the child face, keeping the collider and Flex item fixed under the hand.
  const face=global.scene.createSceneObject("Workbench button face");face.setParent(button.sceneObject);
  button.visual=new RoundedRectangleVisual({sceneObject:face,transparent:true,
    depthSettings:{depthTest:true,depthWrite:true},
    style:{default:state(),hovered:state(true),triggered:state(true,true),inactive:state(false,false,true)}});
  button.initialize();button.colliderFitElement=false;button.colliderSize=new vec3(size.x,size.y+.5,1.5);
  const visual=button.visual as RoundedRectangleVisual;visual.cornerRadius=.45;visual.animateDuration=.12;
  return face;
}

/** Button.opacity can restore a theme's opaque flag; keep our custom outline blended. */
export function setWorkbenchOpacity(button:Button,opacity:number){
  if(!button.initialized)return;
  const visual=button.visual as RoundedRectangleVisual;
  if(Math.abs(visual.opacity-opacity)>.001){visual.transparencyEnabled=true;visual.opacity=opacity;}
}

/** Noninteractive SDK-rounded plate, so an annotation never steals a pinch. */
export function annotationPlate(root:SceneObject,width:number,height:number){
  const visual=new RoundedRectangleVisual({sceneObject:root,transparent:true});
  visual.size=new vec3(width,height,.12);visual.cornerRadius=.35;
  visual.defaultBaseType="Color";visual.baseDefaultColor=new vec4(.018,.028,.04,.74);
  visual.defaultHasBorder=true;visual.defaultBorderType="Color";
  visual.borderDefaultColor=new vec4(.72,.84,.92,.52);visual.defaultBorderSize=.08;
  visual.depthTest=true;visual.depthWrite=true;
  return visual;
}
