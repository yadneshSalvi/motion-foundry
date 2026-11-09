import WorldCameraFinderProvider from "SpectaclesInteractionKit.lspkg/Providers/CameraProvider/WorldCameraFinderProvider";
import {RoundedRectangleVisual} from "SpectaclesUIKit.lspkg/Scripts/Visuals/RoundedRectangle/RoundedRectangleVisual";
import {LoopAssembly} from "./LoopAssembly";
import {LoopInput,LoopParameters,LoopVerification,evaluateCouplerPoint} from "./LoopDomain";
import {annotationPlate,applyWorkbenchText} from "./WorkbenchStyle";
import {DistanceBand,distanceBand,fadeTowards} from "./WorkbenchPresentation";
import {capsuleMesh} from "./WorkbenchGeometry";

type ScreenBox={left:number;right:number;top:number;bottom:number};
type ScreenSegment={a:vec2;b:vec2;radius:number};
type Label={root:SceneObject;text:Text;plate:RoundedRectangleVisual;leader?:SceneObject;opacity:number;wanted:boolean;optional:boolean;width:number;height:number};
export type LabelFrame={drawing:boolean;drawMode:string;fresh:boolean;solving:boolean;message:string;messageUntil:number;firstUse:boolean;hover:string;editing:string;showFit:boolean;showContact:boolean;isEditor:boolean;parameters:LoopParameters;phase:number;placing:boolean;placementText:string;placementPoint:vec3;pendingHints:{[key:string]:boolean}};

/** Plates face the wearer in yaw only; every annotation remains anchored to its object. */
export class WorkbenchLabels {
  private camera=WorldCameraFinderProvider.getInstance();
  private labels:{[key:string]:Label}={};
  private openedAt=getTime();
  private band:DistanceBand|undefined;
  private uiOpacity=1;
  private detailOpacity=0;
  private occupied:ScreenBox[]=[];
  private hardware:ScreenBox[]=[];
  private rods:ScreenSegment[]=[];
  constructor(private parent:SceneObject,private assembly:LoopAssembly,private light:Material){
    for(const key of ["status","hint","fit","contact","mount","dial","scope","far","obstacle","rod0","rod1","rod2","rod3","rod4","rod5"])this.labels[key]=this.make(key);
  }
  public near(point:vec3,cm=55){return point.distance(this.camera.getWorldPosition())<cm;}
  public cameraPosition(){return this.camera.getWorldPosition();}
  public getBand(){return this.band||"middle";}
  public controlsOpacity(){return this.uiOpacity;}
  public detailsOpacity(){return this.detailOpacity;}
  public rotation(point:vec3){
    const camera=this.camera.getWorldPosition(),yaw=Math.atan2(camera.x-point.x,camera.z-point.z);
    return quat.angleAxis(yaw,vec3.up());
  }
  public tick(input:LoopInput,audit:LoopVerification,frame:LabelFrame){
    this.occupied=[];
    this.hardware=[];this.rods=[];
    for(const key of Object.keys(this.labels))this.labels[key].wanted=false;
    const center=this.assembly.worldPoint({x:8,y:5},2),distance=center.distance(this.camera.getWorldPosition());
    this.band=distanceBand(distance,this.band);
    this.uiOpacity=fadeTowards(this.uiOpacity,this.band==="far"?0:1,getDeltaTime());
    this.detailOpacity=fadeTowards(this.detailOpacity,this.band==="near"?1:0,getDeltaTime());
    if(!frame.drawing&&this.assembly.crankHandle.enabled)this.protectGeometry(input,frame.parameters,frame.phase);
    if(frame.placing){
      this.show("status",frame.placementText,frame.placementPoint);
      this.fadeLabels();return;
    }
    const base=this.assembly.worldPoint({x:.5,y:-6.1},5.8),middle=this.band!=="far";
    const focus=frame.editing||frame.hover,manipulating=["mount","fit","obstacle","obstacleSize"].includes(focus);
    // One live readout takes priority over the stale-result instruction. Remove
    // the old plate immediately instead of crossfading two messages together.
    if(manipulating)for(const key of ["status","fit","contact","scope"])this.hideNow(key);
    if(!middle)this.show("far",frame.solving?"…":frame.fresh&&audit.valid?"✓":audit.collisionWitness?"✕":"?",this.assembly.worldPoint({x:8,y:5},13));
    if(middle){
      if(!manipulating){
        if(frame.solving)this.show("status","Finding a machine…",base);
        else if(frame.message&&getTime()<frame.messageUntil)this.show("status",frame.message,base);
        else if(frame.fresh&&audit.valid&&!frame.drawing&&!frame.firstUse&&this.band!=="near")this.show("status","Matches your drawing\nwithin "+this.mm(input.tolerances.fitCm)+" mm",base);
        else if(!frame.fresh&&!frame.drawing)this.show("status",audit.collisionWitness?"Make it clear the mug":"Make this drawing",base);
      }
      if(frame.drawing)this.show("hint",frame.drawMode==="open"?"Continue at bright end":frame.drawMode==="armed"?"Pinch & draw":"Return to the ring",this.assembly.worldPoint({x:8,y:15.8},2));
      if(!manipulating&&frame.showFit&&audit.fitWitness){
        const witness=audit.fitWitness;
        this.showEdit("fit",this.mm(witness.errorCm)+" mm off",this.assembly.worldPoint(witness.actual,this.assembly.displayZ));
      }
      if(!manipulating&&frame.showContact&&audit.collisionWitness){
        const o=input.obstacles.find(o=>o.id===audit.collisionWitness!.obstacleId);
        // Far side of the mug: the grip at the contact side cannot cover this plate.
        if(o)this.show("contact","Hits the mug",this.assembly.worldPoint({x:o.center.x-1,y:o.center.y+o.radiusCm+2.6},(o.layerZCm??2)+(o.depthCm??4)/2+2));
      }
      // The live limit is on the physical dial, not in a secondary page.
      this.show("dial","Close enough\n"+this.mm(input.tolerances.fitCm)+" mm",this.assembly.worldPoint({x:12.8,y:-6.1},3.6));
      if(frame.hover==="mount"||frame.editing==="mount")this.showEdit("mount","Mounts\n"+input.fixedMounts.groundCm.toFixed(1)+" cm apart",this.assembly.mountHandle.getTransform().getWorldPosition(),this.assembly.worldPoint({x:input.fixedMounts.groundCm-2,y:7.5},11.5));
      if(frame.hover==="obstacle"||frame.hover==="obstacleSize"||frame.editing.startsWith("obstacle")){
        const o=input.obstacles[0];
        const target=o?this.assembly.keepOutSizeHandle:this.assembly.keepOutHandle;
        const anchor=o?{x:o.center.x+3.3,y:o.center.y+o.radiusCm+2}:{x:-5.6,y:6.5};
        this.showEdit("obstacle",o?"Mug\n"+(o.radiusCm*2).toFixed(1)+" cm across":"Add a mug",target.getTransform().getWorldPosition(),this.assembly.worldPoint(anchor,10.5));
      }
      if(!manipulating&&input.obstacles[0]&&frame.isEditor&&!frame.showContact){
        const o=input.obstacles[0];this.show("scope","Mug (stand-in)",this.assembly.worldPoint({x:o.center.x-1,y:o.center.y+o.radiusCm+2.6},(o.layerZCm??2)+(o.depthCm??4)/2+2));
      }else if(!manipulating&&frame.isEditor&&getTime()-this.openedAt<1.4&&!frame.drawing)this.show("scope","Preview spot",this.assembly.worldPoint({x:8,y:16},4));
      const cue=frame.hover||(!frame.showFit&&frame.firstUse?"crank":"");
      if(getTime()-this.openedAt>=1.8&&!frame.drawing&&!frame.editing&&frame.pendingHints[cue]){
        const object=cue==="fit"?this.assembly.fitHandle:cue==="mount"?this.assembly.mountHandle:cue==="obstacleSize"?this.assembly.keepOutSizeHandle:cue==="obstacle"?this.assembly.keepOutHandle:this.assembly.crankHandle;
        const text=cue==="fit"?"Turn the dial":cue==="mount"?"Pinch & slide":cue==="obstacleSize"?"Pinch & size":cue==="obstacle"?"Move to your mug":"Pinch & turn";
        const origin=object.getTransform().getWorldPosition();
        // Try nearby anchors without covering moving hardware.
        for(const offset of [new vec3(0,5.6,0),new vec3(-5,4.2,0),new vec3(5,4.2,0)]){
          if(this.show("hint",text,origin.add(offset),true))break;
        }
      }
    }
    if(this.band==="near"&&!frame.drawing&&!frame.solving&&!manipulating)this.rodLengths(frame.parameters,input,frame.phase);
    this.fadeLabels();
  }
  private fadeLabels(){
    for(const label of Object.values(this.labels)){
      // Remove an unsafe old detail before another fades in. Safe distance-band
      // transitions retain their normal 300 ms fade.
      let unsafeOld=false;
      if(label.optional&&!label.wanted&&label.opacity>0){
        const box=this.screenBox(label,label.root.getTransform().getWorldPosition());
        unsafeOld=this.band==="near"||this.geometryOverlaps(box)||this.occupied.some(o=>this.overlaps(box,o));
      }
      label.opacity=unsafeOld?0:fadeTowards(label.opacity,label.wanted?1:0,getDeltaTime());
      label.root.enabled=label.opacity>.005;
      label.plate.opacity=label.opacity;label.text.textFill.color=new vec4(1,1,1,label.opacity);
    }
  }
  private rodLengths(p:LoopParameters,input:LoopInput,phase:number){
    const pose=evaluateCouplerPoint(p,phase);if(!pose)return;
    const layers=input.linkLayers||{ground:.6,crank:1.8,rocker:3,coupler:4.2};
    const rows=[
      {a:pose.A,b:pose.B,length:p.crankCm,z:layers.crank},
      {a:pose.B,b:pose.C,length:p.couplerCm,z:layers.coupler},
      {a:pose.D,b:pose.C,length:p.rockerCm,z:layers.rocker},
      {a:pose.A,b:pose.D,length:p.groundCm,z:layers.ground},
      {a:pose.B,b:pose.point,length:Math.hypot(p.attachmentAlongCm,p.attachmentAcrossCm),z:layers.coupler},
      {a:pose.C,b:pose.point,length:Math.hypot(p.couplerCm-p.attachmentAlongCm,p.attachmentAcrossCm),z:layers.coupler},
    ].map((row,i)=>{
      const point=this.assembly.worldPoint({x:(row.a.x+row.b.x)/2,y:(row.a.y+row.b.y)/2},row.z),screen=this.camera.worldSpaceToScreenSpace(point.x,point.y,point.z);
      return{...row,i,focus:Math.hypot(screen.x-.5,screen.y-.5)};
    }).sort((a,b)=>a.focus-b.focus);
    let shown=0;
    for(const row of rows){
      if(shown>=3)break;
      const length=Math.hypot(row.b.x-row.a.x,row.b.y-row.a.y)||1,nx=-(row.b.y-row.a.y)/length,ny=(row.b.x-row.a.x)/length;
      const target=this.assembly.worldPoint({x:(row.a.x+row.b.x)/2,y:(row.a.y+row.b.y)/2},row.z);
      const right=this.rotation(target).multiplyVec3(vec3.right());
      let placed=false;
      const candidates:vec3[]=[];
      // Lift the readout into the space above the moving rods first. A purely
      // planar offset can be completely hidden by the layered repaired model.
      for(const up of [5,7.5,10])for(const side of [0,-5.8,5.8])candidates.push(target.add(vec3.up().uniformScale(up)).add(right.uniformScale(side)));
      for(const offset of [3.8,5.6])for(const along of [.5,.3,.7])for(const side of [1,-1]){
        candidates.push(this.assembly.worldPoint({x:row.a.x+(row.b.x-row.a.x)*along+nx*offset*side,y:row.a.y+(row.b.y-row.a.y)*along+ny*offset*side},row.z+1.8));
      }
      for(const point of candidates){
        if(!this.show("rod"+row.i,row.length.toFixed(1)+" cm",point,true))continue;
        this.pointLeader(this.labels["rod"+row.i],target);shown++;placed=true;break;
      }
    }
  }
  private mm(cm:number){const mm=cm*10;return mm<1?mm.toFixed(1):Number.isInteger(mm)?mm.toFixed(0):mm.toFixed(1);}
  private hideNow(key:string){const label=this.labels[key];label.wanted=false;label.opacity=0;label.root.enabled=false;}
  private showEdit(key:"mount"|"obstacle"|"fit",text:string,target:vec3,anchor?:vec3){
    if(anchor){
      const label=this.labels[key];let point=anchor;
      // Critical live values have explicit elevated object-relative anchors.
      // Optional near-detail rejection must never hide an active size edit.
      for(let i=0;i<3;i++){
        const box=this.screenBox(label,point),screen=this.camera.worldSpaceToScreenSpace(point.x,point.y,point.z);
        const dx=box.left<.04?.04-box.left:box.right>.96?.96-box.right:0;
        const dy=box.top<.04?.04-box.top:box.bottom>.96?.96-box.bottom:0;
        if(Math.abs(dx)+Math.abs(dy)<.0001)break;
        const depth=Math.abs(this.camera.getInvertedWorldTransform().multiplyPoint(point).z);
        point=this.camera.screenSpaceToWorldSpace(screen.x+dx,screen.y+dy,depth);
      }
      this.show(key,text,point);this.pointLeader(label,target);return;
    }
    const right=this.rotation(target).multiplyVec3(vec3.right());
    // Stay attached to the actual target, but try readable space around it.
    // The physical mount, mug/rim and complete dial are exclusion regions.
    for(const [x,y] of [[0,6],[5.4,4.8],[-5.4,4.8],[7.2,1.8],[-7.2,1.8],[0,8],[-5.4,-4.8],[5.4,-4.8]]){
      const point=target.add(right.uniformScale(x)).add(vec3.up().uniformScale(y));
      if(!this.show(key,text,point,true))continue;
      this.pointLeader(this.labels[key],target);
      return;
    }
    // No overlapping fallback: a later viewing angle can expose the readout.
    this.hideNow(key);
  }
  private pointLeader(label:Label,target:vec3){
    const leader=label.leader;if(!leader)return;
    const point=label.root.getTransform().getWorldPosition(),right=this.rotation(point).multiplyVec3(vec3.right());
    const direction=target.sub(point),distance=direction.length,unit=direction.normalize();
    const across=Math.abs(unit.x*right.x+unit.y*right.y+unit.z*right.z);
    const edge=Math.min((label.width/2+.2)/Math.max(.001,across),(label.height/2+.2)/Math.max(.001,Math.abs(unit.y)));
    const length=Math.min(2.4,Math.max(0,distance-edge-1.2));leader.enabled=length>.1;
    if(leader.enabled){const t=leader.getTransform();t.setWorldPosition(point.add(unit.uniformScale(edge+length/2)));t.setWorldRotation(quat.rotationFromTo(vec3.right(),unit));t.setLocalScale(new vec3(length/1.1,1,1));}
  }
  private make(name:string):Label{
    const root=global.scene.createSceneObject("Workbench "+name+" annotation");root.setParent(this.parent);root.createComponent("Component.Canvas");
    const width=name==="status"?12.5:name==="dial"?9.5:name==="hint"?10.5:name.startsWith("rod")?5.6:name==="far"?5:name==="fit"?7.5:name==="scope"?10.5:name==="mount"?8.2:name==="obstacle"?8.8:11.5;
    const height=name==="far"?5:2.9;
    const backing=global.scene.createSceneObject("Annotation rounded plate");backing.setParent(root);
    const plate=annotationPlate(backing,width,height);
    const textRoot=global.scene.createSceneObject("Annotation text");textRoot.setParent(root);textRoot.getTransform().setLocalPosition(new vec3(0,0,.17));
    const text=textRoot.createComponent("Component.Text") as Text;applyWorkbenchText(text,name==="far"?"glyph":"label");
    text.horizontalAlignment=HorizontalAlignment.Center;text.verticalAlignment=VerticalAlignment.Center;
    text.horizontalOverflow=HorizontalOverflow.Wrap;text.verticalOverflow=VerticalOverflow.Overflow;text.layoutRect=Rect.create(-(width-.6)/2,(width-.6)/2,-height/2+.25,height/2-.25);
    let leader:SceneObject|undefined;
    if(!["status","far","scope","hint"].includes(name)){
      const data=capsuleMesh(1.1,.025,.025),builder=new MeshBuilder([{name:"position",components:3},{name:"normal",components:3},{name:"texture0",components:2}]);
      builder.topology=MeshTopology.Triangles;builder.indexType=MeshIndexType.UInt16;builder.appendVerticesInterleaved(data.vertices);builder.appendIndices(data.indices);builder.updateMesh();
      leader=global.scene.createSceneObject("Short annotation leader");leader.setParent(root);
      leader.getTransform().setLocalPosition(new vec3(0,-2,0));leader.getTransform().setLocalRotation(quat.fromEulerAngles(0,0,Math.PI/2));
      const visual=leader.createComponent("Component.RenderMeshVisual") as RenderMeshVisual;visual.mesh=builder.getMesh();visual.mainMaterial=this.light;
    }
    root.enabled=false;return{root,text,plate,leader,opacity:0,wanted:false,optional:false,width,height};
  }
  private overlaps(a:ScreenBox,b:ScreenBox){return a.left<b.right&&a.right>b.left&&a.top<b.bottom&&a.bottom>b.top;}
  private projectedBounds(points:vec3[],padding=.006):ScreenBox{
    const p=points.map(q=>this.camera.worldSpaceToScreenSpace(q.x,q.y,q.z));
    return{left:Math.min(...p.map(q=>q.x))-padding,right:Math.max(...p.map(q=>q.x))+padding,top:Math.min(...p.map(q=>q.y))-padding,bottom:Math.max(...p.map(q=>q.y))+padding};
  }
  private protectGeometry(input:LoopInput,p:LoopParameters,phase:number){
    const grip=this.assembly.crankHandle.getTransform().getWorldPosition(),corners:vec3[]=[];
    // Conservative display envelope includes the 2.1 cm grip and hover rim.
    for(const x of [-2.4,2.4])for(const y of [-2.4,2.4])for(const z of [-2.4,2.4])corners.push(grip.add(new vec3(x,y,z)));
    this.hardware.push(this.projectedBounds(corners));
    const layers=input.linkLayers||{ground:.6,crank:1.8,rocker:3,coupler:4.2},depth=input.linkDepthCm||.7,nib:vec3[]=[];
    for(const x of [-.7,.7])for(const y of [-.7,.7])for(const z of [.1,layers.coupler+depth/2+.7])nib.push(this.assembly.worldPoint({x:this.assembly.currentPoint.x+x,y:this.assembly.currentPoint.y+y},z));
    this.hardware.push(this.projectedBounds(nib));
    for(const [object,radius] of [[this.assembly.mountHandle,2.5],[this.assembly.fitHandle,3.3],[this.assembly.keepOutSizeHandle,1.3]] as const){
      if(!object.enabled)continue;
      const at=object.getTransform().getWorldPosition(),points:vec3[]=[];
      for(const x of [-radius,radius])for(const y of [-radius,radius])for(const z of [-radius,radius])points.push(at.add(new vec3(x,y,z)));
      this.hardware.push(this.projectedBounds(points));
    }
    const mug=input.obstacles[0];
    if(mug){const points:vec3[]=[],top=(mug.layerZCm??2)+(mug.depthCm??4)/2,bottom=(mug.layerZCm??2)-(mug.depthCm??4)/2;
      for(const x of [-mug.radiusCm,mug.radiusCm])for(const y of [-mug.radiusCm,mug.radiusCm])for(const z of [bottom,top])points.push(this.assembly.worldPoint({x:mug.center.x+x,y:mug.center.y+y},z));
      this.hardware.push(this.projectedBounds(points));
    }
    const pose=evaluateCouplerPoint(p,phase);if(!pose)return;
    const rows=[[pose.A,pose.B,layers.crank],[pose.B,pose.C,layers.coupler],[pose.D,pose.C,layers.rocker],[pose.A,pose.D,layers.ground],[pose.B,pose.point,layers.coupler],[pose.C,pose.point,layers.coupler]] as const;
    const view=this.camera.getTransform().getWorldRotation();
    for(const [a,b,z] of rows){
      const aw=this.assembly.worldPoint(a,z),bw=this.assembly.worldPoint(b,z),as=this.camera.worldSpaceToScreenSpace(aw.x,aw.y,aw.z),bs=this.camera.worldSpaceToScreenSpace(bw.x,bw.y,bw.z);
      const radius=Math.max(input.linkRadiusCm,depth/2)+.15;
      let projectedRadius=.004;
      for(const [world,screen] of [[aw,as],[bw,bs]] as const)for(const direction of [vec3.right(),vec3.up()]){
        const edge=world.add(view.multiplyVec3(direction).uniformScale(radius)),es=this.camera.worldSpaceToScreenSpace(edge.x,edge.y,edge.z);
        projectedRadius=Math.max(projectedRadius,Math.hypot(es.x-screen.x,es.y-screen.y));
      }
      this.rods.push({a:as,b:bs,radius:projectedRadius});
    }
  }
  private geometryOverlaps(box:ScreenBox){
    if(this.hardware.some(o=>this.overlaps(box,o)))return true;
    // A segment/expanded-rectangle intersection leaves the space beside a
    // diagonal rod available instead of excluding its entire bounding box.
    return this.rods.some(s=>{
      let lo=0,hi=1;const dx=s.b.x-s.a.x,dy=s.b.y-s.a.y;
      for(const [p,q] of [[-dx,s.a.x-box.left+s.radius],[dx,box.right+s.radius-s.a.x],[-dy,s.a.y-box.top+s.radius],[dy,box.bottom+s.radius-s.a.y]]){
        if(Math.abs(p)<1e-9){if(q<0)return false;continue;}
        const t=q/p;if(p<0)lo=Math.max(lo,t);else hi=Math.min(hi,t);if(lo>hi)return false;
      }
      return true;
    });
  }
  private screenBox(label:Label,point:vec3):ScreenBox{
    const rotation=this.rotation(point),right=rotation.multiplyVec3(vec3.right()).uniformScale(label.width/2),up=vec3.up().uniformScale(label.height/2);
    const corners=[point.add(right).add(up),point.sub(right).add(up),point.add(right).sub(up),point.sub(right).sub(up)].map(p=>this.camera.worldSpaceToScreenSpace(p.x,p.y,p.z));
    return{left:Math.min(...corners.map(p=>p.x))-.008,right:Math.max(...corners.map(p=>p.x))+.008,top:Math.min(...corners.map(p=>p.y))-.008,bottom:Math.max(...corners.map(p=>p.y))+.008};
  }
  private show(key:string,value:string,point:vec3,optional=false){
    const label=this.labels[key],box=this.screenBox(label,point);
    if(optional&&(!this.camera.inFoV(point)||box.left<.02||box.right>.98||box.top<.02||box.bottom>.98||this.geometryOverlaps(box)||this.occupied.some(o=>this.overlaps(box,o))))return false;
    this.occupied.push(box);
    if(label.text.text!==value)label.text.text=value;label.wanted=true;label.optional=optional;
    const t=label.root.getTransform();t.setWorldPosition(point);t.setWorldRotation(this.rotation(point));
    return true;
  }
}
