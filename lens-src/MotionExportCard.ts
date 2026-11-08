import {WORKBENCH_TYPE} from "./LoopWorkshopUI";
export type ExportCardPlacement={position:vec3;rotation:quat;extent:number;caption?:string};

/** Exact signed URL, on an explicit side tag. The QR is never substituted with a placeholder. */
export class MotionExportCard {
  private object:SceneObject;
  private paper:RenderMeshVisual;
  private ink:RenderMeshVisual;
  private caption:Text;
  private visible=false;
  private moduleCount=0;
  constructor(parent:SceneObject,material:Material,private placement?:ExportCardPlacement){
    this.object=global.scene.createSceneObject("Signed design QR tag");this.object.setParent(parent);
    const t=this.object.getTransform();t.setLocalPosition(placement?.position||new vec3(0,13,18));
    if(placement)t.setLocalRotation(placement.rotation);
    const white=material.clone();white.mainPass.baseColor=new vec4(1,1,1,1);
    const black=material.clone();black.mainPass.baseColor=new vec4(.008,.012,.008,1);
    this.paper=this.visual("QR paper",white);this.ink=this.visual("QR modules",black);
    const caption=global.scene.createSceneObject("QR handoff label");caption.setParent(this.object);
    caption.getTransform().setLocalPosition(new vec3(0,-(placement?.extent||26)/2-1.6,.1));
    this.caption=caption.createComponent("Component.Text") as Text;this.caption.depthTest=true;this.caption.size=WORKBENCH_TYPE.label.size;
    this.caption.textFill.color=new vec4(1,.98,.82,1);this.caption.horizontalAlignment=HorizontalAlignment.Center;this.caption.verticalAlignment=VerticalAlignment.Center;
    this.caption.horizontalOverflow=HorizontalOverflow.Wrap;this.caption.verticalOverflow=VerticalOverflow.Overflow;
    this.caption.layoutRect=Rect.create(-9,9,-1.8,1.8);this.caption.text=placement?.caption||"Scan to take this machine with you";
    this.object.enabled=false;
  }
  hide(){this.visible=false;this.object.enabled=false;}
  show(size:number,data:number[]){
    if(!Number.isInteger(size)||size<21||size>177||data.length!==size*size||data.some(x=>x!==0&&x!==1))throw Error("Invalid export QR");
    const extent=this.placement?.extent||26,cell=extent/(size+8),vertices:number[]=[],indices:number[]=[];
    const quad=(x:number,y:number,w:number,h:number,z:number)=>{const i=vertices.length/8;vertices.push(x,y,z,0,0,1,0,0,x+w,y,z,0,0,1,1,0,x+w,y+h,z,0,0,1,1,1,x,y+h,z,0,0,1,0,1);indices.push(i,i+1,i+2,i,i+2,i+3);};
    quad(-extent/2,-extent/2,extent,extent,0);this.paper.mesh=this.mesh(vertices,indices);vertices.length=0;indices.length=0;
    for(let y=0;y<size;y++)for(let x=0;x<size;x++)if(data[y*size+x])quad(-extent/2+(x+4)*cell,extent/2-(y+5)*cell,cell,cell,.04);
    if(vertices.length/8>65535)throw Error("QR is too dense");
    this.ink.mesh=this.mesh(vertices,indices);this.moduleCount=size;this.visible=true;this.object.enabled=true;
  }
  snapshot(){return{visible:this.visible,moduleCount:this.moduleCount,extentCm:this.placement?.extent||26,position:this.object.getTransform().getWorldPosition()};}
  private visual(name:string,material:Material){const o=global.scene.createSceneObject(name);o.setParent(this.object);const v=o.createComponent("Component.RenderMeshVisual") as RenderMeshVisual;v.mainMaterial=material;return v;}
  private mesh(vertices:number[],indices:number[]){const b=new MeshBuilder([{name:"position",components:3},{name:"normal",components:3},{name:"texture0",components:2}]);b.topology=MeshTopology.Triangles;b.indexType=MeshIndexType.UInt16;b.appendVerticesInterleaved(vertices);b.appendIndices(indices);b.updateMesh();return b.getMesh();}
}
