/** A QR graphic for the exact signed design URL. Display only on explicit Save. */
export class MotionExportCard {
  private object:SceneObject|null=null;
  constructor(private parent:SceneObject,private material:Material){}
  hide(){if(this.object){this.object.destroy();this.object=null;}}
  show(size:number,data:number[]){
    this.hide();if(!Number.isInteger(size)||size<21||size>177||data.length!==size*size)throw Error("Invalid export QR");
    const root=global.scene.createSceneObject("Signed design QR");root.setParent(this.parent);root.getTransform().setLocalPosition(new vec3(0,13,18));this.object=root;
    const paper=this.material.clone();paper.mainPass.baseColor=new vec4(1,1,1,1);
    const ink=this.material.clone();ink.mainPass.baseColor=new vec4(.008,.012,.008,1);
    const vertices:number[]=[],indices:number[]=[],extent=26,cell=extent/(size+8);
    const quad=(x:number,y:number,w:number,h:number,z:number)=>{const i=vertices.length/8;vertices.push(x,y,z,0,0,1,0,0,x+w,y,z,0,0,1,1,0,x+w,y+h,z,0,0,1,1,1,x,y+h,z,0,0,1,0,1);indices.push(i,i+1,i+2,i,i+2,i+3);};
    const make=(name:string,mat:Material)=>{const mesh=new MeshBuilder([{name:"position",components:3},{name:"normal",components:3},{name:"texture0",components:2}]);mesh.topology=MeshTopology.Triangles;mesh.indexType=MeshIndexType.UInt16;mesh.appendVerticesInterleaved(vertices);mesh.appendIndices(indices);mesh.updateMesh();const o=global.scene.createSceneObject(name);o.setParent(root);const visual=o.createComponent("Component.RenderMeshVisual") as RenderMeshVisual;visual.mesh=mesh.getMesh();visual.mainMaterial=mat;};
    quad(-extent/2,-extent/2,extent,extent,0);make("QR paper",paper);vertices.length=0;indices.length=0;
    for(let y=0;y<size;y++)for(let x=0;x<size;x++)if(data[y*size+x])quad(-extent/2+(x+4)*cell,extent/2-(y+5)*cell,cell,cell,.04);
    if(vertices.length/8>65535)throw Error("QR is too dense");make("QR modules",ink);
  }
}
