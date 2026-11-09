import {LoopInput,LoopParameters,LoopVerification,evaluateCouplerPoint} from "./LoopDomain";
import {Vec2} from "./MotionDomain";
import {capsuleMesh,WorkbenchMesh,dialAngleFromFit,mugStandInMeshes} from "./WorkbenchGeometry";
import {WORKBENCH_PROFILE,WORKBENCH_KEEP_OUT} from "./WorkbenchProfile";
import {OrderedTraceMatch,dashedStroke,WORKBENCH_PRESENTATION} from "./WorkbenchPresentation";
import {PersistentOrderedTrace,TraceState,IncrementalTraceTube} from "./WorkbenchTrace";
import {createNativeTraceTube} from "./WorkbenchTraceMesh";
import {applyWorkbenchText} from "./WorkbenchStyle";

type Frame={draft?:Vec2[];draftVersion:number;drawing:boolean;closed:boolean;fresh:boolean;showFit:boolean;showContact:boolean;reveal:boolean;solving:boolean;hover:string;editing:string;isEditor:boolean};
type Obstacle=LoopInput["obstacles"][number];

/** XY mechanism coordinates rotate onto the measured table. One Lens unit is one centimetre. */
export class LoopAssembly {
  readonly root:SceneObject;
  readonly boardTarget:SceneObject;
  readonly crankHandle:SceneObject;
  readonly mountHandle:SceneObject;
  readonly keepOutHandle:SceneObject;
  readonly keepOutSizeHandle:SceneObject;
  readonly fitHandle:SceneObject;
  readonly bounds={...WORKBENCH_PROFILE.bounds};
  readonly fitCenter:Vec2={x:21,y:-6.5};
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
  private trace=new PersistentOrderedTrace(360);
  private traceState:TraceState=this.trace.state();
  private inkTube:IncrementalTraceTube;
  private matchTube:IncrementalTraceTube;
  private failureTube:IncrementalTraceTube;
  private failure:RenderMeshVisual;
  private inputVersion=-1;
  private candidateKey="";
  private parameterSource:LoopParameters|null=null;
  private drawingVersion=-1;
  private previousDrawing=false;
  private lastGeometry="";
  private lastObstacle="";
  private lastFit="";
  private lastWitness="";
  private metal:Material;
  private white:Material;
  private faint:Material;
  private pale:Material;
  private contact:Material;
  private accent:Material;
  private bright:Material;
  private drawingNib:SceneObject;
  private closeRing:SceneObject;
  private fitLimitRing:SceneObject;
  private matched:RenderMeshVisual;
  private pending:SceneObject[]=[];
  private knobMaterial:Material;
  private knobOpacity=-1;
  private rodOpacity=-1;
  private linkColors:number[][]=[];
  private linkLengths:number[]=[];
  private mug:SceneObject;
  private mugParts:RenderMeshVisual[]=[];
  private glow:{[key:string]:SceneObject}={};
  private matchMap:OrderedTraceMatch|null=null;
  private radiusKey="";

  constructor(parent:SceneObject,mint:Material){
    // Board centre (8,5) maps to the authored table-frame origin. Local Z becomes world up.
    this.root=this.object(parent,"Tabletop linkage",new vec3(-8,.12,5));
    this.root.getTransform().setLocalRotation(quat.fromEulerAngles(-Math.PI/2,0,0));
    // Mint is the existing unlit asset. Bright rods/ink must not depend on room lighting.
    this.metal=this.tint(mint,.21,.24,.25);
    this.white=this.tint(mint,1,1,1);
    this.faint=this.tint(mint,.22,.24,.25);
    this.pale=this.tint(mint,.78,.84,.86);
    this.contact=this.tint(mint,1,.61,.09);
    this.accent=this.tint(mint,.91,.24,1);
    this.bright=this.tint(mint,.2,1,.63);
    const edge=this.tint(mint,.21,.24,.25),grid=this.tint(mint,.12,.15,.16);
    const border=[{x:-7,y:-7},{x:23,y:-7},{x:23,y:17},{x:-7,y:17},{x:-7,y:-7}];
    this.path("Drawing card edge",[border],.055,.04,edge);
    const lines:Vec2[][]=[];
    for(let x=-6;x<23;x+=2)lines.push([{x,y:-7},{x,y:17}]);
    for(let y=-6;y<17;y+=2)lines.push([{x:-7,y},{x:23,y}]);
    this.path("Quiet two centimetre grid",lines,.012,.035,grid);
    this.boardTarget=this.object(this.root,"Workbench drawing surface",new vec3(8,5,.08));
    this.boxCollider(this.boardTarget,new vec3(30,24,.25));

    const colors=[[.37,.9,1],[.66,.64,1],[1,.63,.77],[.55,.61,.61],[.68,.91,1],[.68,.91,1]];this.linkColors=colors;
    const names=["crank","coupler","rocker","ground","attachment-B","attachment-C"];
    for(let i=0;i<names.length;i++){
      const c=colors[i],material=this.tint(mint,c[0],c[1],c[2]);this.linkMaterials.push(material);
      this.links.push(this.visual(this.root,"Verified "+names[i]+" bar",capsuleMesh(1,.45,.7),material));
      const shimmer=this.visual(this.links[i].getSceneObject(),"Pending shimmer on previous actual rod",capsuleMesh(.75,.035,.025),this.pale).getSceneObject();shimmer.enabled=false;this.pending.push(shimmer);
    }
    for(let i=0;i<4;i++){
      const root=this.object(this.root,"Through axle "+"ABCD"[i],vec3.zero());
      this.axles.push(root);this.axleVisuals.push(this.visual(root,"Axle shaft",capsuleMesh(0,.22,1),this.metal));
      this.visual(root,"Axle cap",capsuleMesh(0,.40,.16),this.pale).getSceneObject().getTransform().setLocalPosition(new vec3(0,0,.5));
    }
    for(let i=0;i<2;i++){
      const clamp=this.object(this.root,i?"Workbench movable mount":"Workbench fixed mount",vec3.zero());
      this.visual(clamp,"Mount clamp foot",capsuleMesh(1.8,1,.36),this.metal);
      const bridge=this.visual(clamp,"Clamp saddle",capsuleMesh(.6,.65,.65),this.faint).getSceneObject();
      bridge.getTransform().setLocalPosition(new vec3(0,0,.5));
      this.clamps.push(clamp);
    }
    this.mountHandle=this.clamps[1];this.boxCollider(this.mountHandle,new vec3(4.5,4.5,2));
    this.glow.mount=this.visual(this.mountHandle,"Mount hover outline",this.ring(2.05,.16,.72),this.pale).getSceneObject();
    this.knobPost=this.visual(this.root,"Decorative crank post",capsuleMesh(0,.12,1),this.metal).getSceneObject();
    this.crankHandle=this.object(this.root,"Workbench crank knob",vec3.zero());
    this.knobMaterial=this.tint(mint,.72,.84,.9);this.knobMaterial.mainPass.blendMode=BlendMode.Normal;this.knobMaterial.mainPass.depthWrite=false;
    this.visual(this.crankHandle,"1.6 centimetre crank knob",this.sphere(.8,10,20),this.knobMaterial);
    this.glow.crank=this.visual(this.crankHandle,"Crank hover halo",this.ring(.95,.12,0),this.pale).getSceneObject();
    const sphere=Shape.createSphereShape();sphere.radius=2.1;
    (this.crankHandle.createComponent("Physics.ColliderComponent") as ColliderComponent).shape=sphere;

    this.nib=this.object(this.root,"Decorative tracing nib",vec3.zero());
    this.visual(this.nib,"Pen tip",this.cone(.3,.5,20),this.white);
    this.nibStem=this.visual(this.root,"Decorative pen stem",capsuleMesh(0,.08,1),this.metal).getSceneObject();
    this.marker=this.visual(this.root,"Coupler attachment cap",capsuleMesh(0,.22,.14),this.pale).getSceneObject();
    const ink=createNativeTraceTube(.22,6,4096),match=createNativeTraceTube(.10,6,1200),failure=createNativeTraceTube(.06,6,720);
    this.inkTube=ink.tube;this.matchTube=match.tube;this.failureTube=failure.tube;
    this.ink=this.visual(this.root,"Ink drawn only by actual coupler",ink.mesh,this.accent);
    this.desired=this.path("Requested dashed drawing",[],WORKBENCH_PRESENTATION.drawingRadiusCm,.55,this.white);
    this.matched=this.visual(this.root,"Persistently matched ordered drawing",match.mesh,this.bright);
    this.failure=this.visual(this.root,"Inspected drawing segments beyond the limit",failure.mesh,this.contact);
    this.drawingNib=this.object(this.root,"Pinch drawing nib",vec3.zero());
    this.visual(this.drawingNib,"Drawing fingertip dot",this.sphere(.3,8,16),this.white);
    this.closeRing=this.visual(this.root,"Snap close target",this.ring(WORKBENCH_PRESENTATION.closeDistanceCm,.12,.19),this.white).getSceneObject();
    this.fitLimitRing=this.visual(this.root,"Chosen fit distance",this.ring(.3,.045,.24),this.white).getSceneObject();

    this.keepOutHandle=this.object(this.root,"Workbench measured keep-out",vec3.zero());
    this.keepOutVisual=this.visual(this.keepOutHandle,"Measured keep-out outline",this.mesh([],[]),this.white);
    this.keepOutCollider=this.keepOutHandle.createComponent("Physics.ColliderComponent") as ColliderComponent;
    this.keepOutSizeHandle=this.object(this.root,"Workbench mug size handle",vec3.zero());
    this.visual(this.keepOutSizeHandle,"Pinchable mug rim handle",this.sphere(.95,8,16),this.white);
    this.boxCollider(this.keepOutSizeHandle,new vec3(4.5,4.5,3));
    this.glow.obstacleSize=this.visual(this.keepOutSizeHandle,"Mug size hover halo",this.ring(1.15,.15,0),this.pale).getSceneObject();
    this.mug=this.object(this.keepOutHandle,"Preview mug stand-in",vec3.zero());
    for(const name of ["Mug bowl","Mug handle","Mug rim"]){
      this.mugParts.push(this.visual(this.mug,name,this.mesh([],[]),name==="Mug bowl"?this.tint(mint,.22,.25,.25):this.white));
    }
    this.glow.obstacle=this.visual(this.keepOutHandle,"Mug move hover halo",this.ring(1,.16,0),this.pale).getSceneObject();
    this.collisionMark=this.visual(this.root,"Computed contact ring",this.ring(.65,.075,.1),this.contact).getSceneObject();
    this.collisionMark.enabled=false;
    this.fitTarget=this.visual(this.root,"Desired error ring",this.ring(.36,.065,0),this.white).getSceneObject();
    this.fitActual=this.visual(this.root,"Actual error ring",this.ring(.25,.075,0),this.white).getSceneObject();
    this.fitLine=this.path("Computed error segment",[],.038,.22,this.white);
    for(const o of [this.fitTarget,this.fitActual,this.fitLine.getSceneObject()])o.enabled=false;

    this.fitHandle=this.object(this.root,"Workbench fit dial",new vec3(this.fitCenter.x,this.fitCenter.y,.65));
    this.visual(this.fitHandle,"Fit dial body",capsuleMesh(0,1.8,.7),this.metal);
    this.visual(this.fitHandle,"Fit dial face",capsuleMesh(0,1.5,.12),this.faint).getSceneObject().getTransform().setLocalPosition(new vec3(0,0,.39));
    this.fitPointer=this.path("Fit dial pointer",[[{x:0,y:0},{x:1.2,y:0}]],.08,.50,this.white,this.fitHandle).getSceneObject();
    this.boxCollider(this.fitHandle,new vec3(4.5,4.5,1.7));
    this.glow.fit=this.visual(this.fitHandle,"Fit dial hover halo",this.ring(1.9,.14,.48),this.pale).getSceneObject();
    for(let mm=1;mm<=5;mm++){
      const angle=dialAngleFromFit(mm/10),a={x:1.45*Math.cos(angle),y:1.45*Math.sin(angle)},b={x:1.8*Math.cos(angle),y:1.8*Math.sin(angle)};
      this.path("Fit dial "+mm+" mm tick",[[a,b]],.10,.53,this.white,this.fitHandle);
      const o=this.object(this.fitHandle,"Fit dial "+mm+" mm numeral",new vec3(2.5*Math.cos(angle),2.5*Math.sin(angle),.52));
      const text=o.createComponent("Component.Text") as Text;applyWorkbenchText(text,"detail");text.text=String(mm);
      text.horizontalAlignment=HorizontalAlignment.Center;text.verticalAlignment=VerticalAlignment.Center;text.layoutRect=Rect.create(-.7,.7,-.6,.6);
    }
  }

  private tint(source:Material,r:number,g:number,b:number){const m=source.clone();m.mainPass.baseColor=new vec4(r,g,b,1);return m;}
  public worldPoint(p:Vec2,z=0){return this.root.getTransform().getWorldTransform().multiplyPoint(new vec3(p.x,p.y,z));}
  public boundedPoint(point:{x:number;y:number}):Vec2{return{x:Math.round(Math.max(this.bounds.minX,Math.min(this.bounds.maxX,point.x))*1000)/1000,y:Math.round(Math.max(this.bounds.minY,Math.min(this.bounds.maxY,point.y))*1000)/1000};}
  /** Called only when the input version or selected candidate changes. */
  public configure(input:LoopInput,p:LoopParameters,id:string,version:number,phase:number){
    if(this.inputVersion===version&&this.candidateKey===id&&this.parameterSource===p)return;
    this.inputVersion=version;this.candidateKey=id;this.parameterSource=p;
    this.trace.configure(input,p,id);this.matchMap=new OrderedTraceMatch(input,p);this.resetInk(p,phase);
    this.lastGeometry="";this.drawingVersion=-1;
  }
  public resetInk(_p:LoopParameters,phase:number){
    this.trace.restart(phase);this.traceState=this.trace.state();
    this.inkTube.reset();this.matchTube.reset();this.failureTube.reset();
  }
  public advanceInk(_p:LoopParameters,_from:number,to:number){
    const result=this.trace.advance(to);if(result.breakInk)this.inkTube.breakStroke();
    this.inkTube.append(result.ink.map(p=>({...p,z:.30})));
    if(result.changed.length){
      this.traceState=this.trace.state();
      for(const index of result.changed){const cell=this.traceState.cells[index];
        if(cell.matched){this.matchTube.breakStroke();this.matchTube.append(cell.path.map(p=>({...p,z:.58})));}
        else{const witness=this.traceState.failureTicks.find(w=>w.index===index);if(!witness)continue;
          const dx=witness.actual.x-witness.desired.x,dy=witness.actual.y-witness.desired.y,n=Math.hypot(dx,dy)||1;
          this.failureTube.breakStroke();this.failureTube.append([{x:witness.desired.x-dy/n*.2,y:witness.desired.y+dx/n*.2,z:.67},{x:witness.desired.x+dy/n*.2,y:witness.desired.y-dx/n*.2,z:.67}]);
        }
      }
    }
  }
  public inkPointCount(){return this.inkTube.segmentCount+Number(this.inkTube.segmentCount>0);}
  public currentMatch(phase:number){return this.matchMap?.at(phase)||null;}
  public matchProgress(){return{ready:this.traceState.ready,complete:this.traceState.complete,inspected:this.traceState.inspected,matched:this.traceState.matched,total:this.traceState.total,inkCapacityReached:this.inkTube.full};}

  public update(p:LoopParameters,input:LoopInput,phase:number,frame:Frame,audit:LoopVerification){
    const pose=evaluateCouplerPoint(p,phase);if(!pose)return;
    const layers=input.linkLayers||{ground:.6,crank:1.8,rocker:3,coupler:4.2},depth=input.linkDepthCm||.7;
    this.displayZ=Math.max(layers.crank,layers.coupler,layers.rocker,layers.ground)+depth/2+.4;
    this.crankHeight=this.displayZ+1.8;
    const geometry=String(this.inputVersion)+":"+this.candidateKey;
    if(geometry!==this.lastGeometry){
      this.lastGeometry=geometry;
      const lengths=[p.crankCm,p.couplerCm,p.rockerCm,p.groundCm,Math.hypot(p.attachmentAlongCm,p.attachmentAcrossCm),Math.hypot(p.couplerCm-p.attachmentAlongCm,p.attachmentAcrossCm)];this.linkLengths=lengths;
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
    for(const key of Object.keys(this.glow))this.glow[key].enabled=frame.hover===key||frame.editing===key;
    const knobOpacity=frame.hover==="crank"?1:.6;
    if(this.knobOpacity!==knobOpacity){this.knobOpacity=knobOpacity;this.knobMaterial.mainPass.baseColor=new vec4(.72,.84,.9,knobOpacity);}
    const rodOpacity=frame.solving?.3:1;
    if(this.rodOpacity!==rodOpacity){this.rodOpacity=rodOpacity;this.linkMaterials.forEach((material,i)=>{const c=this.linkColors[i];material.mainPass.blendMode=rodOpacity<1?BlendMode.Normal:BlendMode.Disabled;material.mainPass.depthWrite=rodOpacity===1;material.mainPass.baseColor=new vec4(c[0],c[1],c[2],rodOpacity);});}
    this.pending.forEach((object,i)=>{
      object.enabled=frame.solving;
      if(frame.solving)object.getTransform().setLocalPosition(new vec3(Math.sin(getTime()*1.2+i*.4)*Math.max(0,(this.linkLengths[i]-.8)/2),0,depth/2+.03));
    });
    const drawing=frame.draft||input.stroke,drawingVersion=frame.drawing?frame.draftVersion:this.inputVersion;
    if(drawingVersion!==this.drawingVersion||frame.drawing!==this.previousDrawing){
      this.drawingVersion=drawingVersion;this.previousDrawing=frame.drawing;
      this.desired.mesh=this.tube(frame.drawing?[drawing]:dashedStroke(drawing,frame.closed),WORKBENCH_PRESENTATION.drawingRadiusCm,.55);
    }
    const last=drawing[drawing.length-1];
    this.drawingNib.enabled=frame.drawing&&!!last;
    if(last)this.drawingNib.getTransform().setLocalPosition(new vec3(last.x,last.y,.8));
    this.closeRing.enabled=frame.drawing&&drawing.length>5;
    if(drawing.length)this.closeRing.getTransform().setLocalPosition(new vec3(drawing[0].x,drawing[0].y,0));
    this.ink.getSceneObject().enabled=this.matched.getSceneObject().enabled=this.failure.getSceneObject().enabled=!frame.drawing;
    this.updateObstacle(input.obstacles[0],frame.isEditor,frame.drawing);
    const match=this.matchMap?.at(phase);
    this.fitLimitRing.enabled=frame.editing==="fit"&&!!match;
    if(match){
      this.fitLimitRing.getTransform().setLocalPosition(new vec3(match.desired.x,match.desired.y,0));
      const radiusKey=String(input.tolerances.fitCm);if(radiusKey!==this.radiusKey){this.radiusKey=radiusKey;(this.fitLimitRing.getComponent("Component.RenderMeshVisual") as RenderMeshVisual).mesh=this.ring(input.tolerances.fitCm,.045,.23);}
    }
    const collision=frame.showContact&&!frame.solving?audit.collisionWitness:undefined;
    this.collisionMark.enabled=!!collision;
    if(collision)this.collisionMark.getTransform().setLocalPosition(new vec3(collision.location.x,collision.location.y,this.layerFor(collision.geometry,layers)+depth/2+.10));
    const witnessKey=collision?collision.geometry+collision.obstacleId:"";
    if(witnessKey!==this.lastWitness){
      this.lastWitness=witnessKey;
      const names=["crank","coupler","rocker","ground","attachment-B","attachment-C"];
      this.links.forEach((v,i)=>v.mainMaterial=collision&&names[i]===collision.geometry?this.contact:this.linkMaterials[i]);
    }
    this.keepOutVisual.mainMaterial=audit.collisionWitness?this.contact:this.white;
    const fit=frame.showFit?audit.fitWitness:undefined;
    this.fitTarget.enabled=this.fitActual.enabled=this.fitLine.getSceneObject().enabled=!!fit;
    if(fit){
      this.fitTarget.getTransform().setLocalPosition(new vec3(fit.desired.x,fit.desired.y,.65));
      this.fitActual.getTransform().setLocalPosition(new vec3(fit.actual.x,fit.actual.y,.65));
      const fitKey=this.inputVersion+":"+this.candidateKey;if(fitKey!==this.lastFit){this.lastFit=fitKey;this.fitLine.mesh=this.paths([[fit.desired,fit.actual]],.038,.63);const material=fit.errorCm<=input.tolerances.fitCm?this.bright:this.white;this.fitLine.mainMaterial=material;(this.fitActual.getComponent("Component.RenderMeshVisual") as RenderMeshVisual).mainMaterial=material;}
    }
  }

  private layerFor(name:string,layers:NonNullable<LoopInput["linkLayers"]>){return name==="ground"?layers.ground:name==="crank"?layers.crank:name==="rocker"?layers.rocker:layers.coupler;}
  private updateObstacle(current:Obstacle|undefined,isEditor:boolean,drawing:boolean){
    // The empty outlined tool adds a mug without replacing the maker's drawing.
    const obstacle=current||WORKBENCH_KEEP_OUT;
    this.keepOutHandle.enabled=!drawing;
    this.keepOutSizeHandle.enabled=!!current&&!drawing;
    this.mug.enabled=!!current&&isEditor;
    const height=obstacle.layerZCm??2,depth=obstacle.depthCm??4;
    this.keepOutHandle.getTransform().setLocalPosition(new vec3(obstacle.center.x,obstacle.center.y,height));
    this.keepOutSizeHandle.getTransform().setLocalPosition(new vec3(obstacle.center.x,obstacle.center.y-obstacle.radiusCm,height+depth/2));
    const key=JSON.stringify([obstacle.radiusCm,depth,height,!!current]);
    if(key===this.lastObstacle)return;
    this.lastObstacle=key;
    const bottom=-depth/2,top=depth/2,r=obstacle.radiusCm,vertices:number[]=[],indices:number[]=[];
    const append=(data:WorkbenchMesh)=>{const base=vertices.length/8;vertices.push(...data.vertices);indices.push(...data.indices.map(i=>i+base));};
    append(this.pathData(current?[this.circle(r)]:dashedStroke(this.circle(r),false,.8,.45),current ? .16 : .08,bottom+.10));
    if(current){
      append(this.pathData([this.circle(r)],.10,top));
      for(let i=0;i<4;i++){
        const a=i*Math.PI/2,x=Math.cos(a)*r,y=Math.sin(a)*r,rod=capsuleMesh(0,.035,depth);
        for(let j=0;j<rod.vertices.length;j+=8){rod.vertices[j]+=x;rod.vertices[j+1]+=y;}
        append(rod);
      }
      const mesh=mugStandInMeshes(r,depth);
      [mesh.body,mesh.handle,mesh.rim].forEach((data,i)=>this.mugParts[i].mesh=this.meshData(data));
    }
    this.keepOutVisual.mesh=this.mesh(vertices,indices);
    (this.glow.obstacle.getComponent("Component.RenderMeshVisual") as RenderMeshVisual).mesh=this.ring(r+.08,.16,top+.04);
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
