/** Retained Petal sculpture. The shipping native workbench instantiates LoopAssembly instead. */
import {evaluateMechanism, MechanismParameters, DesignInput, Vec2} from "./MotionDomain";
/** Every decorative blade is rigidly attached to the computed output rocker. */
export class MotionAssembly {
  readonly root:SceneObject;readonly targetHandle:SceneObject;public draggingTarget=false;
  private base:SceneObject;private baseEdges:SceneObject[]=[];private links:SceneObject[]=[];private joints:SceneObject[]=[];private petal:SceneObject;private obstacle:SceneObject;private trace:SceneObject[]=[];private lastGeometry="";
  constructor(parent:SceneObject,metal:Material,porcelain:Material,mint:Material,sky:Material,coral:Material){
    this.root=this.object(parent,"Foundry mechanism",new vec3(-8,9,0));
    this.root.getTransform().setLocalRotation(quat.fromEulerAngles(0,-.6,0));
    this.base=this.visual(this.root,"Champagne instrument plinth",this.cylinder(1,1,96),metal);
    for(const [name,mat,radius] of [["Mint perimeter",mint,1],["Champagne hairline",metal,.93]] as [string,Material,number][]){const edge=this.visual(this.root,name,this.ellipseRing(radius,.008,96),mat);this.baseEdges.push(edge);}
    for(let i=0;i<4;i++)this.links.push(this.visual(this.root,`Link ${i}`,this.cylinder(1,1,20),metal));
    for(let i=0;i<4;i++)this.joints.push(this.visual(this.root,`Joint ${"ABCD"[i]}`,this.cylinder(.32,.44,24),metal));
    this.petal=this.object(this.root,"Rigid porcelain petal",vec3.zero());this.visual(this.petal,"Central blade",this.blade(20.8,5.1),porcelain);
    for(const side of [-1,1]){const wing=this.visual(this.petal,`Sepal ${side}`,this.blade(16.4,3.4),porcelain);wing.getTransform().setLocalRotation(quat.fromEulerAngles(side*.22,side*.58,0));wing.getTransform().setLocalPosition(new vec3(0,0,side*1.1));}
    this.targetHandle=this.visual(this.root,"Pose target handle",this.cylinder(.6,.36,28),sky);this.targetHandle.getTransform().setLocalRotation(quat.fromEulerAngles(Math.PI/2,0,0));
    this.obstacle=this.visual(this.root,"Clearance obstacle",this.cylinder(1,1,48),coral);
    for(let i=0;i<72;i++){const dot=this.visual(this.root,`Actual trace ${i}`,this.cylinder(.07,.16,8),mint);dot.getTransform().setLocalRotation(quat.fromEulerAngles(Math.PI/2,0,0));this.trace.push(dot);}
  }
  update(p:MechanismParameters,input:DesignInput,phase:number,reveal:boolean,targetIndex:number){
    const pose=evaluateMechanism(p,phase);if(!pose)return;
    this.base.getTransform().setLocalPosition(new vec3(p.groundCm/2,-1.5,0));this.base.getTransform().setLocalScale(new vec3(p.groundCm*.95,.55,p.groundCm*.47));
    this.baseEdges.forEach((edge,i)=>{edge.getTransform().setLocalPosition(new vec3(p.groundCm/2,-1.2+i*.02,0));edge.getTransform().setLocalScale(new vec3(p.groundCm*.95,1,p.groundCm*.47));});const layers=input.linkLayers||{crank:0,coupler:.4,rocker:0,ground:-.4};
    this.link(this.links[0],pose.A,pose.B,layers.crank,input.linkRadiusCm);this.link(this.links[1],pose.B,pose.C,layers.coupler,input.linkRadiusCm);this.link(this.links[2],pose.D,pose.C,layers.rocker,input.linkRadiusCm);this.link(this.links[3],pose.A,pose.D,layers.ground,input.linkRadiusCm);
    [pose.A,pose.B,pose.C,pose.D].forEach((q,i)=>{this.joints[i].getTransform().setLocalPosition(new vec3(q.x,q.y,1));this.joints[i].getTransform().setLocalRotation(quat.fromEulerAngles(Math.PI/2,0,0));});
    this.petal.enabled=!reveal;this.petal.getTransform().setLocalPosition(new vec3(pose.D.x,pose.D.y,-.8));this.petal.getTransform().setLocalRotation(quat.fromEulerAngles(0,0,pose.outputAngleRad-Math.PI/2));
    const target=input.targetPoses[targetIndex%input.targetPoses.length];if(!this.draggingTarget)this.targetHandle.getTransform().setLocalPosition(new vec3(p.groundCm+p.rockerCm*Math.cos(target.outputAngleRad),p.rockerCm*Math.sin(target.outputAngleRad),1.8));
    const o=input.obstacles[0];this.obstacle.enabled=!!o;if(o){this.obstacle.getTransform().setLocalPosition(new vec3(o.center.x,o.center.y,o.layerZCm||0));this.obstacle.getTransform().setLocalRotation(quat.fromEulerAngles(Math.PI/2,0,0));this.obstacle.getTransform().setLocalScale(new vec3(o.radiusCm,o.depthCm||2,o.radiusCm));}
    const hash=JSON.stringify(p);if(hash!==this.lastGeometry){this.lastGeometry=hash;this.trace.forEach((dot,i)=>{const q=evaluateMechanism(p,i*Math.PI/36)!.C;dot.getTransform().setLocalPosition(new vec3(q.x,q.y,1.5));});}this.trace.forEach(dot=>dot.enabled=reveal);
  }
  private link(o:SceneObject,a:Vec2,b:Vec2,z:number,r:number){const t=o.getTransform();t.setLocalPosition(new vec3((a.x+b.x)/2,(a.y+b.y)/2,z));t.setLocalScale(new vec3(r,Math.hypot(b.x-a.x,b.y-a.y),r));t.setLocalRotation(quat.fromEulerAngles(0,0,Math.atan2(b.y-a.y,b.x-a.x)-Math.PI/2));}
  private object(parent:SceneObject,name:string,position:vec3){const o=global.scene.createSceneObject(name);o.setParent(parent);o.getTransform().setLocalPosition(position);return o;}
  private visual(parent:SceneObject,name:string,mesh:RenderMesh,mat:Material){const o=this.object(parent,name,vec3.zero()),v=o.createComponent("Component.RenderMeshVisual") as RenderMeshVisual;v.mesh=mesh;v.mainMaterial=mat;return o;}
  private mesh(vertices:number[],indices:number[]){const b=new MeshBuilder([{name:"position",components:3},{name:"normal",components:3},{name:"texture0",components:2}]);b.topology=MeshTopology.Triangles;b.indexType=MeshIndexType.UInt16;b.appendVerticesInterleaved(vertices);b.appendIndices(indices);b.updateMesh();return b.getMesh();}
  private cylinder(radius:number,height:number,n:number){const v:number[]=[],idx:number[]=[];for(let i=0;i<=n;i++){const a=i/n*Math.PI*2,x=Math.cos(a),z=Math.sin(a);for(const y of [-.5,.5])v.push(radius*x,height*y,radius*z,x,0,z,i/n,y+.5);}for(let i=0;i<n;i++){const k=i*2;idx.push(k,k+1,k+2,k+1,k+3,k+2);}for(const sign of [-1,1]){const center=v.length/8;v.push(0,sign*height*.5,0,0,sign,0,.5,.5);for(let i=0;i<=n;i++){const a=i/n*Math.PI*2;v.push(radius*Math.cos(a),sign*height*.5,radius*Math.sin(a),0,sign,0,.5+.5*Math.cos(a),.5+.5*Math.sin(a));}for(let i=0;i<n;i++)if(sign===1)idx.push(center,center+i+2,center+i+1);else idx.push(center,center+i+1,center+i+2);}return this.mesh(v,idx);}
  private ellipseRing(radius:number,thickness:number,n:number){const v:number[]=[],idx:number[]=[];for(let i=0;i<=n;i++){const a=i/n*Math.PI*2;for(const r of [radius-thickness,radius+thickness])v.push(r*Math.cos(a),0,r*Math.sin(a),0,1,0,i/n,r);}for(let i=0;i<n;i++){const k=i*2;idx.push(k,k+2,k+1,k+1,k+2,k+3);}return this.mesh(v,idx);}
  private blade(length:number,width:number){const v:number[]=[],idx:number[]=[],rows=40,cols=16;for(let y=0;y<=rows;y++)for(let x=0;x<=cols;x++){const t=y/rows,s=x/cols*2-1,w=Math.pow(Math.sin(Math.PI*t),.72)*width;v.push(s*w,length*t,1.1*Math.sin(Math.PI*t)+1.5*s*s*Math.sin(Math.PI*t)-.9*t*t,-s*.3,0,1,x/cols,t);}for(let y=0;y<rows;y++)for(let x=0;x<cols;x++){const i=y*(cols+1)+x;idx.push(i,i+1,i+cols+1,i+1,i+cols+2,i+cols+1);}return this.mesh(v,idx);}
}
