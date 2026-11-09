import SIK from "SpectaclesInteractionKit.lspkg/SIK";
import WorldCameraFinderProvider from "SpectaclesInteractionKit.lspkg/Providers/CameraProvider/WorldCameraFinderProvider";
import {RoundedRectangleVisual} from "SpectaclesUIKit.lspkg/Scripts/Visuals/RoundedRectangle/RoundedRectangleVisual";
import {LoopAssembly} from "./LoopAssembly";
import {LoopWorkshopUI} from "./LoopWorkshopUI";
import {LoopInput,LoopParameters,LoopVerification,evaluateCouplerPoint} from "./LoopDomain";
import {annotationPlate,applyWorkbenchText} from "./WorkbenchStyle";
import {DistanceBand,distanceBand,fadeTowards} from "./WorkbenchPresentation";
import {capsuleMesh} from "./WorkbenchGeometry";
import {ScreenBox,ScreenLine,ProjectedSubject,bounds,boxesOverlap,insideViewport,subjectHitsBox,labelCandidateAllowed,segmentHitsBox,linesCross,projectedOcclusion,cameraChanged,vector3Data,rotationData} from "./WorkbenchLayout";

type Label={root:SceneObject;text:Text;plate:RoundedRectangleVisual;leader:SceneObject;dot:SceneObject;edge?:SceneObject;opacity:number;wanted:boolean;width:number;height:number;maxWidth:number;calibrated:boolean;measuredText:string;target:vec3|null;point:vec3|null;line:ScreenLine|null;box:ScreenBox|null;reason:string};
type AttachedControl={width:number;height:number;leader:SceneObject;dot:SceneObject;point:vec3|null;target:vec3|null;line:ScreenLine|null;box:ScreenBox|null;reason:string};
export type LabelFrame={drawing:boolean;drawMode:string;strokeLengthCm:number;fresh:boolean;matched:boolean;solving:boolean;message:string;messageUntil:number;firstUse:boolean;hover:string;editing:string;showFit:boolean;showContact:boolean;isEditor:boolean;parameters:LoopParameters;phase:number;placing:boolean;placementText:string;placementPoint:vec3;pendingHints:{[key:string]:boolean}};

/** All plates and controls use the same current-camera exclusion geometry. */
export class WorkbenchLabels {
  private camera=WorldCameraFinderProvider.getInstance();
  private labels:{[key:string]:Label}={};
  private openedAt=getTime();
  private band:DistanceBand|undefined;
  private uiOpacity=1;
  private occupied:ScreenBox[]=[];
  private leaders:ScreenLine[]=[];
  private subjects:ProjectedSubject[]=[];
  private gestureOccluders:{id:string;box:ScreenBox}[]=[];
  private drawingSamples:{x:number;y:number;depth:number}[]=[];
  private cameraState:Parameters<typeof cameraChanged>[0]=null;
  private invalidateLayout=true;
  private layoutPasses=0;
  private reusedPlacements=0;
  private dockPoint:vec3|null=null;
  private dockSafe=false;
  private dockKey="";
  private controls:ReturnType<LoopWorkshopUI["getProjectedTargets"]>=[];
  private surfaceY=-Infinity;
  private frameTimes:number[]=[];
  private nearFrames=0;
  private color:Material;
  private undo:AttachedControl;
  constructor(private parent:SceneObject,private assembly:LoopAssembly,light:Material){
    this.color=light.clone();this.color.mainPass.baseColor=new vec4(.77,.84,.86,1);
    for(const key of ["status","hint","fit","contact","mount","dial","scope","far","obstacle","rod0","rod1","rod2","rod3","rod4","rod5"])this.labels[key]=this.make(key);
    const leader=this.meshVisual(parent,"Undo leader to edited part",capsuleMesh(1,.025,.025),this.color);
    const dot=this.meshVisual(parent,"Undo three millimetre anchor dot",capsuleMesh(0,.15,.1),this.color);
    leader.enabled=dot.enabled=false;
    this.undo={width:6.2,height:4,leader,dot,point:null,target:null,line:null,box:null,reason:"not-requested"};
  }
  public getBand(){return this.band||"middle";}
  public controlsOpacity(){return this.uiOpacity;}
  public rotation(_point:vec3){return this.camera.getTransform().getWorldRotation();}
  private cameraSnapshot(){return{position:vector3Data(this.camera.getWorldPosition()),rotation:rotationData(this.camera.getTransform().getWorldRotation())};}
  private project(p:vec3){const s=this.camera.worldSpaceToScreenSpace(p.x,p.y,p.z);return{x:s.x,y:s.y,depth:Math.abs(this.camera.getInvertedWorldTransform().multiplyPoint(p).z)};}
  private box(point:vec3,width:number,height:number,rotation=this.rotation(point),padding=.004):ScreenBox{
    const right=rotation.multiplyVec3(vec3.right()).uniformScale(width/2),up=rotation.multiplyVec3(vec3.up()).uniformScale(height/2);
    return bounds([point.add(right).add(up),point.sub(right).add(up),point.add(right).sub(up),point.sub(right).sub(up)].map(p=>this.project(p)),padding);
  }
  /** Called before moving the dock. Only six rods, a few hardware envelopes and the 64-point input are projected. */
  public prepare(input:LoopInput,p:LoopParameters,phase:number,drawing:boolean,extra:{id:string;points:vec3[]}[]=[]){
    const current=this.cameraSnapshot();this.invalidateLayout=cameraChanged(this.cameraState,current);
    if(this.invalidateLayout)this.cameraState=current;
    this.subjects=[];this.drawingSamples=[];
    this.surfaceY=this.assembly.worldPoint({x:8,y:5},.3).y;
    const addBox=(id:string,points:vec3[])=>{const ps=points.map(p=>this.project(p));this.subjects.push({id,box:bounds(ps,.003),depthNear:Math.min(...ps.map(p=>p.depth))});};
    const cube=(id:string,at:vec3,r:number)=>{const corners:vec3[]=[];for(const x of [-r,r])for(const y of [-r,r])for(const z of [-r,r])corners.push(at.add(new vec3(x,y,z)));addBox(id,corners);};
    const layers=input.linkLayers||{ground:.6,crank:1.8,rocker:3,coupler:4.2},depth=input.linkDepthCm||.7;
    if(!drawing){
      cube("grip",this.assembly.crankHandle.getTransform().getWorldPosition(),.95);
      cube("nib",this.assembly.worldPoint(this.assembly.currentPoint,.65),.38);
      cube("mount",this.assembly.mountHandle.getTransform().getWorldPosition(),1.4);
      cube("dial",this.assembly.fitHandle.getTransform().getWorldPosition(),3.1);
      if(this.assembly.keepOutSizeHandle.enabled)cube("mug-size",this.assembly.keepOutSizeHandle.getTransform().getWorldPosition(),1.05);
      const pose=evaluateCouplerPoint(p,phase);
      if(pose){
        const rows=[[pose.A,pose.B,layers.crank],[pose.B,pose.C,layers.coupler],[pose.D,pose.C,layers.rocker],[pose.A,pose.D,layers.ground],[pose.B,pose.point,layers.coupler],[pose.C,pose.point,layers.coupler]] as const;
        for(let i=0;i<rows.length;i++){
          const [a,b,z]=rows[i],aw=this.assembly.worldPoint(a,z),bw=this.assembly.worldPoint(b,z),as=this.project(aw),bs=this.project(bw);
          const edge=aw.add(this.camera.getTransform().right.uniformScale(Math.max(input.linkRadiusCm,depth/2)+.08)),es=this.project(edge);
          this.subjects.push({id:"rod"+i,line:{a:as,b:bs,radius:Math.max(.002,Math.hypot(es.x-as.x,es.y-as.y))},depthNear:Math.min(as.depth,bs.depth)});
        }
      }
    }
    const mug=input.obstacles[0];
    if(mug&&!drawing){const points:vec3[]=[];for(const x of [-mug.radiusCm,mug.radiusCm])for(const y of [-mug.radiusCm,mug.radiusCm])for(const z of [(mug.layerZCm??2)-(mug.depthCm??4)/2,(mug.layerZCm??2)+(mug.depthCm??4)/2])points.push(this.assembly.worldPoint({x:mug.center.x+x,y:mug.center.y+y},z));addBox("mug",points);}
    if(!drawing){
      const samples=input.stroke.map(p=>this.project(this.assembly.worldPoint(p,.55)));
      this.drawingSamples=samples;
      for(let i=0;i<samples.length;i++)this.subjects.push({id:"drawing"+i,line:{a:samples[i],b:samples[(i+1)%samples.length],radius:.003},depthNear:Math.min(samples[i].depth,samples[(i+1)%samples.length].depth)});
    }else{
      addBox("drawing-board",[{x:-7,y:-7},{x:23,y:-7},{x:23,y:17},{x:-7,y:17}].map(p=>this.assembly.worldPoint(p,.1)));
    }
    for(const item of extra)if(item.points.length)addBox(item.id,item.points);
  }
  /** Object-attached dock; it moves only on meaningful camera/state changes or a genuine overlap. */
  public placeDock(rack:SceneObject,ui:LoopWorkshopUI,preferred:vec3,placementFootprint?:vec3[]){
    const geometry=placementFootprint?.length?(()=>{const ps=placementFootprint.map(p=>this.project(p));return[{id:"placement-footprint",box:bounds(ps,.012),depthNear:Math.min(...ps.map(p=>p.depth))}];})():placementFootprint?[]:this.subjects;
    if(placementFootprint){this.subjects=geometry;this.surfaceY=placementFootprint.length?Math.min(...placementFootprint.map(p=>p.y))+.12:-Infinity;}
    const size=ui.footprint(),rotation=this.rotation(preferred);
    const key=ui.getPage()+":"+size.width+":"+!!placementFootprint;
    const aboveSurface=(p:vec3)=>p.y-Math.abs(rotation.multiplyVec3(vec3.up()).y)*size.height/2>=this.surfaceY;
    const safe=(p:vec3)=>{const box=this.box(p,size.width,size.height,rotation,.01);return aboveSurface(p)&&insideViewport(box)&&!geometry.some(s=>subjectHitsBox(s,box));};
    let point=this.dockPoint;
    if(this.invalidateLayout||key!==this.dockKey||!point||!safe(point)){
      this.layoutPasses++;this.dockKey=key;
      const candidates=[preferred];
      const preferredScreen=this.project(preferred),depth=preferredScreen.depth;
      const model=geometry.flatMap(s=>s.box?[{x:s.box.left,y:s.box.top},{x:s.box.right,y:s.box.bottom}]:s.line?[s.line.a,s.line.b]:[]);
      const modelBounds=model.length?bounds(model):{left:.35,right:.65,top:.3,bottom:.6};
      // Preserve physical button dimensions while trying real, farther UI depths.
      // Every candidate is reprojected before it can become a visible control.
      for(const at of Array.from(new Set([depth,...[35,40,45,50,55,65,75].map(d=>Math.max(depth,d))]))){
        const centre=this.camera.screenSpaceToWorldSpace(.5,.5,at),b=this.box(centre,size.width,size.height,rotation),halfH=(b.bottom-b.top)/2,halfW=(b.right-b.left)/2;
        for(const gap of [.025,.045]){
          const y=modelBounds.bottom+halfH+gap,x=Math.max(halfW+.035,Math.min(1-halfW-.035,(modelBounds.left+modelBounds.right)/2));
          candidates.push(this.camera.screenSpaceToWorldSpace(x,y,at));
          candidates.push(this.camera.screenSpaceToWorldSpace(modelBounds.right+halfW+gap,Math.max(halfH+.035,Math.min(1-halfH-.035,preferredScreen.y)),at));
          candidates.push(this.camera.screenSpaceToWorldSpace(modelBounds.left-halfW-gap,Math.max(halfH+.035,Math.min(1-halfH-.035,preferredScreen.y)),at));
          candidates.push(this.camera.screenSpaceToWorldSpace(x,modelBounds.top-halfH-gap,at));
        }
      }
      // A close view of the side tag can leave a safe pocket inside the combined
      // model bounds. Try a bounded grid only in this state; never cover the QR.
      if(geometry.some(s=>s.id==="share-qr"))for(const at of [35,45,55,65,75])
        for(const y of [.18,.35,.5,.65,.82])for(const x of [.15,.32,.5,.68,.85])
          candidates.push(this.camera.screenSpaceToWorldSpace(x,y,Math.max(depth,at)));
      const visible=candidates.find(safe);
      point=visible||candidates.find(p=>aboveSurface(p)&&!geometry.some(s=>subjectHitsBox(s,this.box(p,size.width,size.height,rotation,.01))))||null;this.dockSafe=!!visible;
      if(point)this.dockPoint=point;
    }else{this.reusedPlacements++;this.dockSafe=true;}
    // If the whole workbench cannot fit at this angle, keep a nonoverlapping dock
    // attached below its near edge so looking down can recover it. Report that
    // framing as unsatisfied; never hide Back merely to claim layout success.
    rack.enabled=!!point;
    if(point){rack.getTransform().setWorldPosition(point);rack.getTransform().setWorldRotation(rotation);}
    this.controls=ui.getProjectedTargets(this.camera,false);
    this.occupied=this.controls.filter(c=>c.opacity>.005).map(c=>c.box);this.leaders=[];
    const request=ui.undoRequest();
    const placement=request?this.nearPlacement(this.undo.width,this.undo.height,request.anchor,true,this.undo.point):null;
    ui.placeUndo(placement?.point||null,rotation);
    this.undo.reason=request?placement?"visible":"no-safe-position":"not-requested";
    this.undo.target=request?.anchor||null;this.undo.box=placement?.box||null;this.undo.line=placement?.line||null;
    this.undo.leader.enabled=this.undo.dot.enabled=false;
    if(placement&&request){
      this.undo.point=placement.point;
      this.aimLeader(this.undo,placement.point,request.anchor,ui.undoVisible()&&ui.getProjectedTargets(this.camera).some(c=>c.id==="undo"&&c.opacity>.005));
      if(placement.line)this.leaders.push(placement.line);
    }
    this.controls=ui.getProjectedTargets(this.camera);
    this.occupied=this.controls.filter(c=>c.opacity>.005).map(c=>c.box);
  }
  public tick(input:LoopInput,audit:LoopVerification,frame:LabelFrame){
    for(const label of Object.values(this.labels)){label.wanted=false;label.reason="not-requested";}
    this.gestureOccluders=[];
    // Reserve the currently tracked hand for the live mount readout. Controls
    // keep their stable pose; only annotation candidates avoid this envelope.
    // Joint bounds are a conservative layout aid, not pixel-visibility proof.
    if(frame.editing==="mount")for(const type of ["left","right"] as const){
      const hand=SIK.HandInputData.getHand(type);if(!hand.isTracked())continue;
      const points=hand.points.map(p=>this.project(p.position));
      if(points.length)this.gestureOccluders.push({id:"hand:"+type,box:bounds(points,.012)});
    }
    const center=this.assembly.worldPoint({x:8,y:5},2),distance=center.distance(this.camera.getWorldPosition());
    this.band=distanceBand(distance,this.band);
    const handNear=(["left","right"] as const).some(type=>{const hand=SIK.HandInputData.getHand(type);return hand.isTracked()&&!!this.dockPoint&&hand.indexTip.position.distance(this.dockPoint)<15;});
    const opacity=frame.placing?1:this.band==="far"?0:this.band==="near"&&!handNear?.4:1;
    this.uiOpacity=fadeTowards(this.uiOpacity,opacity,getDeltaTime());
    if(this.band==="near"){this.nearFrames++;this.frameTimes.push(getDeltaTime()*1000);if(this.frameTimes.length>600)this.frameTimes.shift();}
    if(frame.placing){this.show("status",frame.placementText,frame.placementPoint,false);this.fadeLabels();return;}
    const focus=frame.editing||frame.hover,manipulating=["mount","fit","obstacle","obstacleSize"].includes(focus);
    if(manipulating)for(const key of ["status","fit","contact","scope"])this.hideNow(key);
    const base=this.assembly.worldPoint({x:input.fixedMounts.groundCm/2,y:0},.6);
    if(this.band==="far"){
      const text=frame.solving?"…":frame.matched&&frame.fresh?"✓":audit.collisionWitness?"✕":"";
      if(text)this.show("far",text,this.assembly.worldPoint({x:8,y:5},6),false);
    }else{
      // The computed error is the near inspection's primary readout. Allocate it
      // before optional status text, rather than letting a duplicate success chip
      // consume its only safe location.
      if(!manipulating&&frame.showFit&&audit.fitWitness)this.show("fit","Widest gap\n"+this.mm(audit.fitWitness.errorCm)+" mm",this.assembly.worldPoint(audit.fitWitness.actual,.65),true);
      if(!manipulating){
        if(frame.solving)this.show("status","Finding a machine…",base,false);
        else if(frame.message&&getTime()<frame.messageUntil&&!frame.drawing)this.show("status",frame.message,base,false);
        else if(frame.matched&&frame.fresh&&!frame.drawing&&this.band!=="near")this.show("status","✓ Matches your\ndrawing",base,false);
        // A stale drawing is already explained by Make it / Avoid mug in the dock.
      }
      if(frame.drawing){
        const text=frame.drawMode==="open"?"Continue from the\nbright end":frame.drawMode==="armed"?"Pinch & draw":frame.strokeLengthCm>10?"Return to the ring":"";
        if(text)this.show("hint",text,this.assembly.worldPoint({x:8,y:17},.2),false);
      }
      if(!manipulating&&frame.showContact&&audit.collisionWitness){
        const o=input.obstacles.find(o=>o.id===audit.collisionWitness!.obstacleId);
        if(o)this.show("contact","Hits the mug",this.assembly.worldPoint(audit.collisionWitness.location,(o.layerZCm??2)+(o.depthCm??4)/2),true);
      }
      if(!frame.drawing)this.show("dial","Close enough\n"+this.mm(input.tolerances.fitCm)+" mm",this.assembly.fitHandle.getTransform().getWorldPosition(),true);
      if(focus==="mount")this.show("mount","Mounts\n"+input.fixedMounts.groundCm.toFixed(1)+" cm apart",this.assembly.mountHandle.getTransform().getWorldPosition(),true);
      if(focus==="obstacle"||focus==="obstacleSize"){
        const o=input.obstacles[0],target=o?this.assembly.keepOutSizeHandle:this.assembly.keepOutHandle;
        this.show("obstacle",o?"Mug\n"+(o.radiusCm*2).toFixed(1)+" cm across":"Add a mug",target.getTransform().getWorldPosition(),true);
      }
      if(!manipulating&&input.obstacles[0]&&frame.isEditor&&!frame.showContact){const o=input.obstacles[0];this.show("scope","Mug (stand-in)",this.assembly.worldPoint(o.center,(o.layerZCm??2)+(o.depthCm??4)/2),false);}
      else if(!manipulating&&frame.isEditor&&getTime()-this.openedAt<1.4&&!frame.drawing)this.show("scope","Preview spot",this.assembly.worldPoint({x:8,y:17},.3),false);
      const cue=frame.hover||(!frame.showFit&&frame.firstUse?"crank":"");
      if(getTime()-this.openedAt>=1.8&&!frame.drawing&&!frame.editing&&!frame.solving&&frame.pendingHints[cue]){
        const object=cue==="fit"?this.assembly.fitHandle:cue==="mount"?this.assembly.mountHandle:cue==="obstacleSize"?this.assembly.keepOutSizeHandle:cue==="obstacle"?this.assembly.keepOutHandle:this.assembly.crankHandle;
        const text=cue==="fit"?"Turn the dial":cue==="mount"?"Pinch & slide":cue==="obstacleSize"?"Pinch & size":cue==="obstacle"?"Move to your mug":"Pinch & turn";
        this.show("hint",text,object.getTransform().getWorldPosition(),false);
      }
    }
    if(this.band==="near"&&!frame.drawing&&!frame.solving&&!manipulating)this.rodLengths(frame.parameters,input,frame.phase);
    this.fadeLabels();
  }
  private mm(cm:number){const n=cm*10;return n<1?n.toFixed(1):Number.isInteger(n)?n.toFixed(0):n.toFixed(1);}
  private hideNow(key:string){const label=this.labels[key];label.wanted=false;label.opacity=0;label.root.enabled=false;}
  private fitText(label:Label,value:string){
    if(label.measuredText===value&&label.calibrated)return;
    if(!label.calibrated){
      // Point size alone is not a centimetre cap-height measurement.
      label.text.text="M";
      let measured=0;try{measured=label.text.getBoundingBox(0,1).getSize().y;}catch{}
      if(Number.isFinite(measured)&&measured>.001){label.text.getTransform().setLocalScale(vec3.one().uniformScale(.9/measured));label.calibrated=true;}
    }
    const scale=label.text.getTransform().getLocalScale().y;
    label.text.layoutRect=Rect.create(-(label.maxWidth-.8)/(2*scale),(label.maxWidth-.8)/(2*scale),-4/scale,4/scale);
    label.text.text=value;
    let width=0,height=0;try{const measured=label.text.getBoundingBox().getSize();width=measured.x*scale;height=measured.y*scale;}catch{}
    if(Number.isFinite(width)&&Number.isFinite(height)&&width>0&&height>0){
      label.width=Math.max(4.2,Math.min(label.maxWidth,width+.8));label.height=Math.max(1.65,Math.min(4.2,height+.6));
      label.plate.size=new vec3(label.width,label.height,.12);
      if(label.edge){label.edge.getTransform().setLocalPosition(new vec3(-label.width/2+.15,0,.13));label.edge.getTransform().setLocalScale(new vec3(Math.max(.1,label.height-.5)/2.8,1,1));}
    }
    label.measuredText=value;
  }
  private show(key:string,value:string,target:vec3,leader:boolean){
    const label=this.labels[key];
    if(key==="far"){
      // A distant status is intentionally a large glyph, not a text readout.
      if(label.text.text!==value)label.text.text=value;
    }else this.fitText(label,value);
    label.reason="no-safe-position";
    const placement=this.nearPlacement(label.width,label.height,target,leader,label.point);
    if(placement){
      const {point,box,line}=placement;
      if(point===label.point)this.reusedPlacements++;else this.layoutPasses++;
      label.point=point;label.target=target;label.box=box;label.line=line;label.reason="visible";label.wanted=true;
      label.root.getTransform().setWorldPosition(point);label.root.getTransform().setWorldRotation(this.rotation(point));
      this.occupied.push(box);if(line)this.leaders.push(line);
      this.aimLeader(label,point,target,leader);return true;
    }
    // No unsafe fallback for critical plates. Native acceptance reports any
    // missing readout and the actual camera/subject rectangles for repair.
    this.hideNow(key);return false;
  }
  /** Actual controls and all annotations share this bounded candidate policy. */
  private nearPlacement(width:number,height:number,target:vec3,leader:boolean,cached:vec3|null):{point:vec3;box:ScreenBox;line:ScreenLine|null}|null{
    const camera=this.camera.getWorldPosition(),toward=camera.sub(target).normalize(),right=this.camera.right(),up=this.camera.up();
    const candidates:vec3[]=[];
    if(!this.invalidateLayout&&cached)candidates.push(cached);
    // All candidates remain on the camera side and within ten centimetres of
    // the actual part, including fixed status, dial and contact plates.
    for(const [side,vertical,front] of [[0,-4,1.5],[0,4,1.5],[7,0,1.5],[-7,0,1.5],[5.5,-4.5,1.5],[-5.5,-4.5,1.5],[5.5,4.5,1.5],[-5.5,4.5,1.5],[0,-7,1.5],[0,7,1.5],[9,0,1],[-9,0,1],[7,-5,1],[-7,-5,1],[7,5,1],[-7,5,1],[0,-9,1],[0,9,1],[3,8,1],[-3,8,1],[3,-8,1],[-3,-8,1],[8,3,1],[-8,3,1],[8,-3,1],[-8,-3,1]])
      candidates.push(target.add(toward.uniformScale(front)).add(right.uniformScale(side)).add(up.uniformScale(vertical)));
    for(const point of candidates){
      const delta=point.sub(target);if(delta.length>10.0001||delta.dot(toward)<0||!this.camera.inFoV(point))continue;
      if(point.y-Math.abs(up.y)*height/2<this.surfaceY)continue;
      const box=this.box(point,width,height);
      if(!labelCandidateAllowed(box,this.subjects,this.occupied,this.leaders))continue;
      if(this.gestureOccluders.some(h=>boxesOverlap(h.box,box)))continue;
      const line=leader?this.leaderLine({width,height},point,target):null;
      if(line){
        // The closed drawing is one object, not sixty-four separate objects.
        // Permit the anchor object plus at most one other crossed object.
        const crossed=new Set(this.subjects.filter(s=>s.box?segmentHitsBox(line,s.box):s.line?linesCross(line,s.line):false).map(s=>s.id.startsWith("drawing")?"drawing":s.id));
        if(this.occupied.some(b=>segmentHitsBox(line,b))||this.leaders.some(l=>linesCross(line,l))||crossed.size>2)continue;
      }
      return{point,box,line};
    }
    return null;
  }
  private leaderLine(label:Pick<Label,"width"|"height">,point:vec3,target:vec3):ScreenLine|null{
    const delta=target.sub(point),unit=delta.normalize(),right=this.camera.right(),up=this.camera.up();
    const edge=Math.min((label.width/2+.15)/Math.max(.001,Math.abs(unit.dot(right))),(label.height/2+.15)/Math.max(.001,Math.abs(unit.dot(up))));
    if(edge>=delta.length-.15)return null;
    return{a:this.project(point.add(unit.uniformScale(edge))),b:this.project(target),radius:.0008};
  }
  private aimLeader(label:Pick<Label,"width"|"height"|"leader"|"dot">,point:vec3,target:vec3,show:boolean){
    const delta=target.sub(point),unit=delta.normalize(),right=this.camera.right(),up=this.camera.up();
    const edge=Math.min((label.width/2+.15)/Math.max(.001,Math.abs(unit.dot(right))),(label.height/2+.15)/Math.max(.001,Math.abs(unit.dot(up)))),length=delta.length-edge;
    label.leader.enabled=show&&length>.15;label.dot.enabled=show&&length>.15;
    if(label.leader.enabled){const t=label.leader.getTransform();t.setWorldPosition(point.add(unit.uniformScale(edge+length/2)));t.setWorldRotation(quat.rotationFromTo(vec3.right(),unit));t.setLocalScale(new vec3(length,1,1));label.dot.getTransform().setWorldPosition(target);}
  }
  private rodLengths(p:LoopParameters,input:LoopInput,phase:number){
    const pose=evaluateCouplerPoint(p,phase);if(!pose)return;
    const l=input.linkLayers||{ground:.6,crank:1.8,rocker:3,coupler:4.2};
    const rows=[[pose.A,pose.B,p.crankCm,l.crank],[pose.B,pose.C,p.couplerCm,l.coupler],[pose.D,pose.C,p.rockerCm,l.rocker],[pose.A,pose.D,p.groundCm,l.ground],[pose.B,pose.point,Math.hypot(p.attachmentAlongCm,p.attachmentAcrossCm),l.coupler],[pose.C,pose.point,Math.hypot(p.couplerCm-p.attachmentAlongCm,p.attachmentAcrossCm),l.coupler]] as const;
    let shown=0;
    for(let i=0;i<rows.length&&shown<3;i++){const [a,b,length,z]=rows[i];if(this.show("rod"+i,length.toFixed(1)+" cm",this.assembly.worldPoint({x:(a.x+b.x)/2,y:(a.y+b.y)/2},z),true))shown++;}
  }
  private fadeLabels(){
    for(const label of Object.values(this.labels)){
      const old=label.opacity;
      const unsafe=!label.wanted&&label.box&&(this.subjects.some(s=>subjectHitsBox(s,label.box!))||this.occupied.some(o=>boxesOverlap(o,label.box!))||this.gestureOccluders.some(h=>boxesOverlap(h.box,label.box!)));
      label.opacity=unsafe?0:fadeTowards(old,label.wanted?1:0,getDeltaTime());
      if(label.root.enabled!==(label.opacity>.005))label.root.enabled=label.opacity>.005;
      if(Math.abs(old-label.opacity)>.001){label.plate.opacity=label.opacity;label.text.textFill.color=new vec4(1,1,1,label.opacity);}
    }
  }
  private meshVisual(parent:SceneObject,name:string,mesh:ReturnType<typeof capsuleMesh>,material:Material){
    const object=global.scene.createSceneObject(name);object.setParent(parent);
    const builder=new MeshBuilder([{name:"position",components:3},{name:"normal",components:3},{name:"texture0",components:2}]);builder.topology=MeshTopology.Triangles;builder.indexType=MeshIndexType.UInt16;
    builder.appendVerticesInterleaved(mesh.vertices);builder.appendIndices(mesh.indices);builder.updateMesh();const v=object.createComponent("Component.RenderMeshVisual") as RenderMeshVisual;v.mesh=builder.getMesh();v.mainMaterial=material;return object;
  }
  private make(name:string):Label{
    const root=global.scene.createSceneObject("Workbench "+name+" annotation");root.setParent(this.parent);root.createComponent("Component.Canvas");
    const width=name==="status"?13.5:name==="dial"?10:name==="hint"?12:name.startsWith("rod")?6.3:name==="far"?5:name==="fit"?10.5:name==="scope"?10.8:name==="mount"?10.4:name==="obstacle"?10.8:11.5;
    const height=name==="far"?5:3.3;
    const backing=global.scene.createSceneObject("Annotation rounded plate");backing.setParent(root);const plate=annotationPlate(backing,width,height);
    const textRoot=global.scene.createSceneObject("Annotation text");textRoot.setParent(root);textRoot.getTransform().setLocalPosition(new vec3(0,0,.17));
    const text=textRoot.createComponent("Component.Text") as Text;applyWorkbenchText(text,name==="far"?"glyph":"label");text.horizontalAlignment=HorizontalAlignment.Center;text.verticalAlignment=VerticalAlignment.Center;
    text.horizontalOverflow=HorizontalOverflow.Wrap;text.verticalOverflow=VerticalOverflow.Overflow;text.layoutRect=Rect.create(-(width-.6)/2,(width-.6)/2,-height/2+.2,height/2-.2);
    const leader=this.meshVisual(root,"Annotation leader ending on part",capsuleMesh(1,.025,.025),this.color),dot=this.meshVisual(root,"Three millimetre anchor dot",capsuleMesh(0,.15,.1),this.color);leader.enabled=dot.enabled=false;
    let edge:SceneObject|undefined;
    if(name.startsWith("rod")){const colors=[[.37,.9,1],[.66,.64,1],[1,.63,.77],[.55,.61,.61],[.68,.91,1],[.68,.91,1]],c=colors[Number(name.slice(3))],m=this.color.clone();m.mainPass.baseColor=new vec4(c[0],c[1],c[2],1);edge=this.meshVisual(root,"Rod-colour three millimetre edge",capsuleMesh(height-.5,.15,.10),m);edge.getTransform().setLocalPosition(new vec3(-width/2+.15,0,.13));edge.getTransform().setLocalRotation(quat.angleAxis(Math.PI/2,vec3.forward()));}
    root.enabled=false;return{root,text,plate,leader,dot,edge,opacity:0,wanted:false,width,height,maxWidth:width,calibrated:false,measuredText:"",target:null,point:null,line:null,box:null,reason:"not-requested"};
  }
  /** Read-only native acceptance payload. Does not move the camera or force product state. */
  public snapshot(){
    const labels=Object.entries(this.labels).filter(([,l])=>l.root.isEnabledInHierarchy).map(([id,l])=>{
      const uppercase=l.text.text.search(/[A-Z0-9]/);let capHeightCm:number|null=null;
      if(uppercase>=0){try{capHeightCm=l.text.getBoundingBox(uppercase,uppercase+1).getSize().y*l.text.getTransform().getWorldScale().y;}catch{}}
      return{id,text:l.text.text,opacity:l.opacity,box:l.box,worldPosition:l.point?vector3Data(l.point):null,depth:l.point?this.project(l.point).depth:0,anchor:l.target?vector3Data(l.target):null,anchorDistanceCm:l.point&&l.target?l.point.distance(l.target):null,leader:l.line,capHeightCm,capTargetCm:id==="far"?null:.9,capCalibrated:l.calibrated,capMethod:id==="far"?"Uncalibrated distant status glyph":"Text.getBoundingBox(first uppercase glyph or numeral), calibrated using M; confirm native image",overlaps:l.box?[...this.subjects.filter(s=>subjectHitsBox(s,l.box!)).map(s=>s.id),...this.gestureOccluders.filter(h=>boxesOverlap(h.box,l.box!)).map(h=>h.id)]:[]};
    });
    const overlays:ProjectedSubject[]=[...labels.filter(l=>l.box).map(l=>({id:"label:"+l.id,box:l.box!,depthNear:l.depth})),...this.controls.filter(c=>c.opacity>.005).map(c=>({id:"control:"+c.id,box:c.box,depthNear:this.project(c.worldPosition).depth}))];
    const occluders=[...this.subjects.filter(s=>!s.id.startsWith("drawing")),...overlays];
    const samples=this.frameTimes.slice().sort((a,b)=>a-b),mean=samples.length?samples.reduce((a,b)=>a+b,0)/samples.length:0;
    return{camera:this.cameraSnapshot(),band:this.getBand(),subjects:this.subjects,gestureOccluders:this.gestureOccluders,drawing:this.drawingSamples,labels,controls:this.controls.map(c=>({...c,worldPosition:vector3Data(c.worldPosition)})),
      undo:{reason:this.undo.reason,box:this.undo.box,leader:this.undo.line,anchor:this.undo.target?vector3Data(this.undo.target):null,
        worldPosition:this.undo.point?vector3Data(this.undo.point):null,anchorDistanceCm:this.undo.point&&this.undo.target?this.undo.point.distance(this.undo.target):null},
      dockSafe:this.dockSafe,dockPoint:this.dockPoint?vector3Data(this.dockPoint):null,dockOverlaps:this.controls.filter(c=>c.opacity>.005).map(c=>({id:c.id,overlaps:this.subjects.filter(s=>subjectHitsBox(s,c.box)).map(s=>s.id)})),
      leaders:this.leaders,drawingOcclusionFraction:projectedOcclusion(this.drawingSamples,occluders),drawingOccluders:occluders.map(s=>({id:s.id,fraction:projectedOcclusion(this.drawingSamples,[s])})).filter(s=>s.fraction>0),occlusionMethod:"Conservative current-depth projected sample coverage, including rod/hardware envelopes. Per-part fractions overlap and must not be added; final pixels and hands require independent image review.",layoutPasses:this.layoutPasses,reusedPlacements:this.reusedPlacements,
      unavailable:Object.entries(this.labels).filter(([,l])=>l.reason==="no-safe-position").map(([id])=>id),nearFrameTiming:{count:samples.length,totalNearFrames:this.nearFrames,meanMs:mean,p95Ms:samples[Math.min(samples.length-1,Math.floor(samples.length*.95))]||0,maxMs:samples[samples.length-1]||0,scope:"Observed native UpdateEvent interval; not hardware performance"}};
  }
}
