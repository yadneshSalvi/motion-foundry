import {LoopInput,LoopParameters,LoopVerification,evaluateCouplerPoint} from "./LoopDomain";
import {Vec2} from "./MotionDomain";
import {capsuleMesh,WorkbenchMesh,dialAngleFromFit} from "./WorkbenchGeometry";
import {WORKBENCH_PROFILE,kinematicInkSegment} from "./WorkbenchProfile";

type Frame={draft?:Vec2[];drawing:boolean;closed:boolean;fresh:boolean;showFit:boolean;showContact:boolean;reveal:boolean};
type Obstacle=LoopInput["obstacles"][number];

/** XY mechanism coordinates rotate onto the measured table. One Lens unit is one centimetre. */
export class LoopAssembly {
  readonly root:SceneObject;
  readonly boardTarget:SceneObject;
  readonly crankHandle:SceneObject;
  readonly mountHandle:SceneObject;
  readonly keepOutHandle:SceneObject;
  readonly fitHandle:SceneObject;
  readonly bounds={...WORKBENCH_PROFILE.bounds};
  readonly fitCenter:Vec2={x:21,y:-4.4};
  displayZ=5.1;
  crankHeight=6.7;
  currentPoint:Vec2={x:0,y:0};
  crankPoint:Vec2={x:0,y:0};
  private links:RenderMeshVisual[]=[];
  private linkMaterials:Material[]=[];
  private axles:SceneObject[]=[];
  private clamps:SceneObject[]=[];
  private axleVisuals:RenderMeshVisual[]=[];
  private nib:SceneObject;
  private nibStem:SceneObject;
  private knobPost:SceneObject;
  private fitPointer:SceneObject;
  private ink:RenderMeshVisual;
  private desired:RenderMeshVisual;
  private fitTarget:SceneObject;
  private fitActual:SceneObject;
  private fitLine:RenderMeshVisual;
  private collisionMark:SceneObject;
  private keepOutVisual:RenderMeshVisual;
  private keepOutCollider:ColliderComponent;
  private marker:SceneObject;
  private inkPoints:Vec2[]=[];
  private inkDirty=false;
  private lastInkFrame=0;
  private lastGeometry="";
  private lastDrawing="";
  private lastObstacle="";
  private lastFit="";
  private lastWitness="";
  private metal:Material;
  private amber:Material;
  private white:Material;
  private faint:Material;
  private contact:Material;

  constructor(parent:SceneObject,metal:Material,porcelain:Material,mint:Material,sky:Material,coral:Material){
    // Board centre (8,5) maps to the authored table-frame origin. Local Z becomes world up.
    this.root=this.object(parent,"Tabletop linkage",new vec3(-8,.12,5));
    this.root.getTransform().setLocalRotation(quat.fromEulerAngles(-Math.PI/2,0,0));
    this.metal=this.tint(metal,.81,.84,.83);
    this.amber=this.tint(mint,1,.75,.32);
    this.white=this.tint(mint,1,.94,.72);
    this.faint=this.tint(sky,.43,.62,.69);
    this.contact=this.tint(coral,1,.37,.18);
    const edge=this.tint(mint,.37,.58,.49),grid=this.tint(porcelain,.28,.39,.35);
    const border=[{x:-7,y:-7},{x:23,y:-7},{x:23,y:17},{x:-7,y:17},{x:-7,y:-7}];
    this.path("Drawing card edge",[border],.055,.04,edge);
    const lines:Vec2[][]=[];
    for(let x=-6;x<23;x+=2)lines.push([{x,y:-7},{x,y:17}]);
    for(let y=-6;y<17;y+=2)lines.push([{x:-7,y},{x:23,y}]);
    this.path("Quiet two centimetre grid",lines,.012,.035,grid);
    this.boardTarget=this.object(this.root,"Workbench drawing surface",new vec3(8,5,.08));
    this.boxCollider(this.boardTarget,new vec3(30,24,.25));

    const colors=[[1,.58,.26],[.48,.77,.98],[.74,.64,.98],[.86,.82,.66],[.45,.91,.73],[.45,.91,.73]];
    const names=["crank","coupler","rocker","ground","attachment-B","attachment-C"];
    for(let i=0;i<names.length;i++){
      const c=colors[i],material=this.tint(metal,c[0],c[1],c[2]);this.linkMaterials.push(material);
      this.links.push(this.visual(this.root,"Verified "+names[i]+" bar",capsuleMesh(1,.45,.7),material));
    }
    for(let i=0;i<4;i++){
      const root=this.object(this.root,"Through axle "+"ABCD"[i],vec3.zero());
      this.axles.push(root);this.axleVisuals.push(this.visual(root,"Axle shaft",capsuleMesh(0,.22,1),this.metal));
      this.visual(root,"Axle cap",capsuleMesh(0,.40,.16),this.white).getSceneObject().getTransform().setLocalPosition(new vec3(0,0,.5));
    }
    for(let i=0;i<2;i++){
      const clamp=this.object(this.root,i?"Workbench movable mount":"Workbench fixed mount",vec3.zero());
      this.visual(clamp,"Mount clamp foot",capsuleMesh(1.8,1,.36),this.metal);
      const bridge=this.visual(clamp,"Clamp saddle",capsuleMesh(.6,.65,.65),this.faint).getSceneObject();
      bridge.getTransform().setLocalPosition(new vec3(0,0,.5));
      this.clamps.push(clamp);
    }
    this.mountHandle=this.clamps[1];this.boxCollider(this.mountHandle,new vec3(4.2,3.1,2));
    this.knobPost=this.visual(this.root,"Decorative crank post",capsuleMesh(0,.28,1),this.metal).getSceneObject();
    this.crankHandle=this.object(this.root,"Workbench crank knob",vec3.zero());
    this.visual(this.crankHandle,"Graspable crank grip",this.sphere(1.8,12,24),this.amber);
    this.visual(this.crankHandle,"Grip inset",capsuleMesh(0,.58,.16),this.white).getSceneObject().getTransform().setLocalPosition(new vec3(0,0,1.65));
    const sphere=Shape.createSphereShape();sphere.radius=2.1;
    (this.crankHandle.createComponent("Physics.ColliderComponent") as ColliderComponent).shape=sphere;

    this.nib=this.object(this.root,"Decorative tracing nib",vec3.zero());
    this.visual(this.nib,"Pen tip",this.cone(.36,.8,20),this.amber);
    this.nibStem=this.visual(this.root,"Decorative pen stem",capsuleMesh(0,.18,1),this.metal).getSceneObject();
    this.marker=this.visual(this.root,"Coupler attachment cap",capsuleMesh(0,.48,.24),this.white).getSceneObject();
    this.ink=this.path("Ink drawn by actual coupler",[],.065,.16,this.white);
    this.desired=this.path("Requested loop",[],.032,.12,this.faint);

    this.keepOutHandle=this.object(this.root,"Workbench measured keep-out",vec3.zero());
    this.keepOutVisual=this.visual(this.keepOutHandle,"Measured keep-out outline",this.mesh([],[]),this.contact);
    this.keepOutCollider=this.keepOutHandle.createComponent("Physics.ColliderComponent") as ColliderComponent;
    this.keepOutHandle.enabled=false;
    this.collisionMark=this.visual(this.root,"Computed contact ring",this.ring(.65,.075,.1),this.contact).getSceneObject();
    this.collisionMark.enabled=false;
    this.fitTarget=this.visual(this.root,"Desired error ring",this.ring(.36,.04,0),this.faint).getSceneObject();
    this.fitActual=this.visual(this.root,"Actual error ring",this.ring(.25,.045,0),this.contact).getSceneObject();
    this.fitLine=this.path("Computed error segment",[],.038,.22,this.contact);
    for(const o of [this.fitTarget,this.fitActual,this.fitLine.getSceneObject()])o.enabled=false;

    this.fitHandle=this.object(this.root,"Workbench fit dial",new vec3(this.fitCenter.x,this.fitCenter.y,.65));
    this.visual(this.fitHandle,"Fit dial body",capsuleMesh(0,1.8,.7),this.metal);
    this.visual(this.fitHandle,"Fit dial face",capsuleMesh(0,1.5,.12),this.faint).getSceneObject().getTransform().setLocalPosition(new vec3(0,0,.39));
    this.fitPointer=this.path("Fit dial pointer",[[{x:0,y:0},{x:1.2,y:0}]],.08,.50,this.white,this.fitHandle).getSceneObject();
    this.boxCollider(this.fitHandle,new vec3(4.1,4.1,1.7));
  }

  private tint(source:Material,r:number,g:number,b:number){const m=source.clone();m.mainPass.baseColor=new vec4(r,g,b,1);return m;}
  public worldPoint(p:Vec2,z=0){return this.root.getTransform().getWorldTransform().multiplyPoint(new vec3(p.x,p.y,z));}
  public boundedPoint(point:{x:number;y:number}):Vec2{return{x:Math.round(Math.max(this.bounds.minX,Math.min(this.bounds.maxX,point.x))*1000)/1000,y:Math.round(Math.max(this.bounds.minY,Math.min(this.bounds.maxY,point.y))*1000)/1000};}
  public resetInk(p:LoopParameters,phase:number){this.inkPoints=kinematicInkSegment(p,phase,phase).slice(0,1);this.inkDirty=true;}
  public advanceInk(p:LoopParameters,from:number,to:number){
    if(Math.abs(to-from)<1e-6)return;
    const points=kinematicInkSegment(p,from,to);this.inkPoints.push(...points.slice(1));
    // Bounded history contains only visited poses, including when the hand reverses direction.
    if(this.inkPoints.length>1441)this.inkPoints.splice(0,this.inkPoints.length-1441);
    this.inkDirty=true;
  }
  public inkPointCount(){return this.inkPoints.length;}

  public update(p:LoopParameters,input:LoopInput,phase:number,frame:Frame,audit:LoopVerification){
    const pose=evaluateCouplerPoint(p,phase);if(!pose)return;
    const layers=input.linkLayers||{ground:.6,crank:1.8,rocker:3,coupler:4.2},depth=input.linkDepthCm||.7;
    this.displayZ=Math.max(layers.crank,layers.coupler,layers.rocker,layers.ground)+depth/2+.4;
    this.crankHeight=this.displayZ+1.8;
    const geometry=JSON.stringify([p,input.linkRadiusCm,depth,layers]);
    if(geometry!==this.lastGeometry){
      this.lastGeometry=geometry;
      const lengths=[p.crankCm,p.couplerCm,p.rockerCm,p.groundCm,Math.hypot(p.attachmentAlongCm,p.attachmentAcrossCm),Math.hypot(p.couplerCm-p.attachmentAlongCm,p.attachmentAcrossCm)];
      this.links.forEach((visual,i)=>visual.mesh=this.meshData(capsuleMesh(lengths[i],input.linkRadiusCm,depth)));
    }
    const segments:[[Vec2,Vec2],number][]=[[[pose.A,pose.B],layers.crank],[[pose.B,pose.C],layers.coupler],[[pose.D,pose.C],layers.rocker],[[pose.A,pose.D],layers.ground],[[pose.B,pose.point],layers.coupler],[[pose.C,pose.point],layers.coupler]];
    segments.forEach(([ends,z],i)=>this.link(this.links[i].getSceneObject(),ends[0],ends[1],z));
    this.links.forEach(o=>o.getSceneObject().enabled=frame.reveal&&!frame.drawing);
    const levels=[[layers.ground,layers.crank],[layers.crank,layers.coupler],[layers.rocker,layers.coupler],[layers.ground,layers.rocker]];
    [pose.A,pose.B,pose.C,pose.D].forEach((q,i)=>{
      const low=Math.min(...levels[i])-depth/2,high=Math.max(...levels[i])+depth/2+.18;
      const axis=this.axles[i],length=high-low;
      axis.enabled=frame.reveal&&!frame.drawing;axis.getTransform().setLocalPosition(new vec3(q.x,q.y,(low+high)/2));
      this.axleVisuals[i].getSceneObject().getTransform().setLocalScale(new vec3(1,1,length));
      axis.getChild(1).getTransform().setLocalPosition(new vec3(0,0,length/2));
    });
    this.clamps[0].getTransform().setLocalPosition(new vec3(0,0,.20));
    this.clamps[1].getTransform().setLocalPosition(new vec3(input.fixedMounts.groundCm,0,.20));
    this.clamps.forEach(o=>o.enabled=!frame.drawing);
    this.crankPoint=pose.B;this.currentPoint=pose.point;
    this.crankHandle.enabled=this.knobPost.enabled=frame.reveal&&!frame.drawing;
    this.crankHandle.getTransform().setLocalPosition(new vec3(pose.B.x,pose.B.y,this.crankHeight));
    const postLow=layers.crank+depth/2,postHigh=this.crankHeight;
    this.knobPost.getTransform().setLocalPosition(new vec3(pose.B.x,pose.B.y,(postLow+postHigh)/2));
    this.knobPost.getTransform().setLocalScale(new vec3(1,1,postHigh-postLow));
    this.nib.enabled=this.nibStem.enabled=this.marker.enabled=frame.reveal&&!frame.drawing;
    this.nib.getTransform().setLocalPosition(new vec3(pose.point.x,pose.point.y,.17));
    const nibTop=layers.coupler+depth/2+.22;
    this.nibStem.getTransform().setLocalPosition(new vec3(pose.point.x,pose.point.y,(nibTop+.8)/2));
    this.nibStem.getTransform().setLocalScale(new vec3(1,1,nibTop-.8));
    this.marker.getTransform().setLocalPosition(new vec3(pose.point.x,pose.point.y,nibTop));
    this.fitHandle.enabled=!frame.drawing;
    this.fitPointer.getTransform().setLocalRotation(quat.fromEulerAngles(0,0,dialAngleFromFit(input.tolerances.fitCm)));

    const drawing=frame.draft||input.stroke,key=JSON.stringify([drawing,frame.closed,frame.drawing]);
    if(key!==this.lastDrawing){
      this.lastDrawing=key;
      const paths=frame.closed&&drawing.length>1?[[...drawing,drawing[0]]]:[drawing];
      this.desired.mesh=this.tube(paths,frame.drawing?.055:.025,.12);
      this.desired.mainMaterial=frame.drawing?this.white:this.faint;
    }
    this.ink.getSceneObject().enabled=!frame.drawing;
    if(this.inkDirty&&getTime()-this.lastInkFrame>.03){this.ink.mesh=this.tube([this.inkPoints],.055,.17);this.inkDirty=false;this.lastInkFrame=getTime();}
    this.updateObstacle(input.obstacles[0]);
    const collision=frame.showContact?audit.collisionWitness:undefined;
    this.collisionMark.enabled=!!collision;
    if(collision)this.collisionMark.getTransform().setLocalPosition(new vec3(collision.location.x,collision.location.y,this.layerFor(collision.geometry,layers)+depth/2+.10));
    const witnessKey=collision?collision.geometry+collision.obstacleId:"";
    if(witnessKey!==this.lastWitness){
      this.lastWitness=witnessKey;
      const names=["crank","coupler","rocker","ground","attachment-B","attachment-C"];
      this.links.forEach((v,i)=>v.mainMaterial=collision&&names[i]===collision.geometry?this.contact:this.linkMaterials[i]);
      this.keepOutVisual.mainMaterial=collision?this.contact:this.amber;
    }
    const fit=frame.showFit?audit.fitWitness:undefined;
    this.fitTarget.enabled=this.fitActual.enabled=this.fitLine.getSceneObject().enabled=!!fit;
    if(fit){
      this.fitTarget.getTransform().setLocalPosition(new vec3(fit.desired.x,fit.desired.y,.24));
      this.fitActual.getTransform().setLocalPosition(new vec3(fit.actual.x,fit.actual.y,.25));
      const fitKey=JSON.stringify(fit);if(fitKey!==this.lastFit){this.lastFit=fitKey;this.fitLine.mesh=this.paths([[fit.desired,fit.actual]],.038,.23);}
    }
  }

  private layerFor(name:string,layers:NonNullable<LoopInput["linkLayers"]>){return name==="ground"?layers.ground:name==="crank"?layers.crank:name==="rocker"?layers.rocker:layers.coupler;}
  private updateObstacle(obstacle:Obstacle|undefined){
    this.keepOutHandle.enabled=!!obstacle;
    if(!obstacle)return;
    const height=obstacle.layerZCm??6,depth=obstacle.depthCm??12;
    this.keepOutHandle.getTransform().setLocalPosition(new vec3(obstacle.center.x,obstacle.center.y,height));
    const key=JSON.stringify([obstacle.radiusCm,depth,height]);
    if(key===this.lastObstacle)return;
    this.lastObstacle=key;
    const bottom=-depth/2,top=depth/2,r=obstacle.radiusCm,vertices:number[]=[],indices:number[]=[];
    const append=(data:WorkbenchMesh)=>{const base=vertices.length/8;vertices.push(...data.vertices);indices.push(...data.indices.map(i=>i+base));};
    append(this.pathData([this.circle(r)],.055,bottom+.10));
    append(this.pathData([this.circle(r)],.035,top));
    // A wire measured envelope leaves the actual room object visible; it is not a detected mesh.
    for(let i=0;i<8;i++){
      const a=i*Math.PI/4,x=Math.cos(a)*r,y=Math.sin(a)*r,rod=capsuleMesh(0,.025,depth);
      for(let j=0;j<rod.vertices.length;j+=8){rod.vertices[j]+=x;rod.vertices[j+1]+=y;}
      append(rod);
    }
    this.keepOutVisual.mesh=this.mesh(vertices,indices);
    const shape=Shape.createBoxShape();shape.size=new vec3(r*2+.6,r*2+.6,Math.max(1,depth));
    this.keepOutCollider.shape=shape;
  }
  private link(object:SceneObject,a:Vec2,b:Vec2,z:number){const t=object.getTransform();t.setLocalPosition(new vec3((a.x+b.x)/2,(a.y+b.y)/2,z));t.setLocalRotation(quat.fromEulerAngles(0,0,Math.atan2(b.y-a.y,b.x-a.x)));}
  private object(parent:SceneObject,name:string,position:vec3){const o=global.scene.createSceneObject(name);o.setParent(parent);o.getTransform().setLocalPosition(position);return o;}
  private visual(parent:SceneObject,name:string,data:WorkbenchMesh|RenderMesh,material:Material){const o=this.object(parent,name,vec3.zero()),v=o.createComponent("Component.RenderMeshVisual") as RenderMeshVisual;v.mesh="vertices" in data?this.meshData(data):data;v.mainMaterial=material;return v;}
  private boxCollider(o:SceneObject,size:vec3){const c=o.createComponent("Physics.ColliderComponent") as ColliderComponent,s=Shape.createBoxShape();s.size=size;c.shape=s;return c;}
  private meshData(data:WorkbenchMesh){return this.mesh(data.vertices,data.indices);}
  private mesh(vertices:number[],indices:number[]){const b=new MeshBuilder([{name:"position",components:3},{name:"normal",components:3},{name:"texture0",components:2}]);b.topology=MeshTopology.Triangles;b.indexType=MeshIndexType.UInt16;b.appendVerticesInterleaved(vertices.length?vertices:[0,0,0,0,0,1,0,0]);if(indices.length)b.appendIndices(indices);b.updateMesh();return b.getMesh();}
  private path(name:string,paths:Vec2[][],width:number,z:number,material:Material,parent=this.root){return this.visual(parent,name,this.paths(paths,width,z),material);}
  private paths(paths:Vec2[][],width:number,z:number){return this.meshData(this.pathData(paths,width,z));}
  private tube(paths:Vec2[][],radius:number,z:number){
    const vertices:number[]=[],indices:number[]=[],sides=8;
    for(const path of paths){
      if(path.length<2)continue;
      const start=vertices.length/8;
      for(let i=0;i<path.length;i++){
        const before=path[Math.max(0,i-1)],after=path[Math.min(path.length-1,i+1)],length=Math.hypot(after.x-before.x,after.y-before.y)||1;
        const nx=-(after.y-before.y)/length,ny=(after.x-before.x)/length;
        for(let j=0;j<sides;j++){const a=j*Math.PI*2/sides,c=Math.cos(a),s=Math.sin(a);vertices.push(path[i].x+nx*c*radius,path[i].y+ny*c*radius,z+s*radius,nx*c,ny*c,s,j/sides,i/path.length);}
      }
      for(let i=0;i<path.length-1;i++)for(let j=0;j<sides;j++){const a=start+i*sides+j,b=start+i*sides+(j+1)%sides,c=b+sides,d=a+sides;indices.push(a,b,c,a,c,d);}
    }
    return this.mesh(vertices,indices);
  }
  private pathData(paths:Vec2[][],width:number,z:number):WorkbenchMesh{const vertices:number[]=[],indices:number[]=[];for(const path of paths)for(let i=1;i<path.length;i++){const a=path[i-1],b=path[i],length=Math.hypot(b.x-a.x,b.y-a.y);if(length<1e-7)continue;const dx=(b.y-a.y)/length*width/2,dy=-(b.x-a.x)/length*width/2,n=vertices.length/8;for(const q of [[a.x-dx,a.y-dy],[a.x+dx,a.y+dy],[b.x+dx,b.y+dy],[b.x-dx,b.y-dy]])vertices.push(q[0],q[1],z,0,0,1,0,0);indices.push(n,n+1,n+2,n,n+2,n+3);}return{vertices,indices};}
  private circle(radius:number){return Array.from({length:65},(_,i)=>({x:radius*Math.cos(i*Math.PI/32),y:radius*Math.sin(i*Math.PI/32)}));}
  private ring(radius:number,width:number,z:number){return this.paths([this.circle(radius)],width,z);}
  private sphere(radius:number,rings:number,sides:number):WorkbenchMesh{const vertices:number[]=[],indices:number[]=[];for(let j=0;j<=rings;j++){const p=j*Math.PI/rings;for(let i=0;i<=sides;i++){const a=i*Math.PI*2/sides,x=Math.sin(p)*Math.cos(a),y=Math.sin(p)*Math.sin(a),z=Math.cos(p);vertices.push(x*radius,y*radius,z*radius,x,y,z,i/sides,j/rings);}}for(let j=0;j<rings;j++)for(let i=0;i<sides;i++){const a=j*(sides+1)+i,b=a+sides+1;indices.push(a,b,a+1,a+1,b,b+1);}return{vertices,indices};}
  private cone(radius:number,height:number,sides:number):WorkbenchMesh{const vertices:number[]=[],indices:number[]=[];for(let i=0;i<sides;i++){const a=i*Math.PI*2/sides,b=(i+1)*Math.PI*2/sides,n=vertices.length/8,nx=Math.cos((a+b)/2),ny=Math.sin((a+b)/2);vertices.push(0,0,0,nx,ny,-radius/height,0,0,radius*Math.cos(a),radius*Math.sin(a),height,nx,ny,-radius/height,0,1,radius*Math.cos(b),radius*Math.sin(b),height,nx,ny,-radius/height,1,1);indices.push(n,n+1,n+2);}return{vertices,indices};}
}
