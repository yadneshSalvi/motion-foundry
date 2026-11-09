import {vector3Data} from "./WorkbenchLayout";
import SIK from "SpectaclesInteractionKit.lspkg/SIK";
import {Interactor,InteractorInputType} from "SpectaclesInteractionKit.lspkg/Core/Interactor/Interactor";
import WorldCameraFinderProvider from "SpectaclesInteractionKit.lspkg/Providers/CameraProvider/WorldCameraFinderProvider";

/** Explicit one-shot placement. Only a genuine horizontal WorldQuery hit can move the table. */
export class WorkbenchPlacement {
  public mode:"manual"|"placing"|"surface"="manual";
  private session:HitTestSession|null=null;
  private generation=0;
  private pending=false;
  private lastQuery=0;
  private bound=new Set<Interactor>();
  private cursor:SceneObject;
  private camera=WorldCameraFinderProvider.getInstance();
  private hit:vec3|null=null;
  private normal:vec3|null=null;
  private hitAt=0;
  private committed=false;
  private commits=0;
  private source="Preview saved spot";
  private hint="Look at a table";
  private queryCount=0;
  private diagnosticKey="";
  private diagnostics:Record<string,unknown>[]=[];
  private diagnosticCounts:Record<string,number>={};
  private lastRay:{from:{x:number;y:number;z:number};to:{x:number;y:number;z:number}}|null=null;
  constructor(private owner:BaseScriptComponent,private table:SceneObject,material:Material,private status:(value:string)=>void,private placed:()=>void,readonly isEditor:boolean){
    this.cursor=global.scene.createSceneObject("Workbench surface placement outline");
    const mesh=new MeshBuilder([{name:"position",components:3},{name:"normal",components:3},{name:"texture0",components:2}]);
    const vertices:number[]=[],indices:number[]=[];
    const segment=(ax:number,az:number,bx:number,bz:number,width=.12)=>{const length=Math.hypot(bx-ax,bz-az),nx=-(bz-az)/length*width/2,nz=(bx-ax)/length*width/2,k=vertices.length/8;for(const [x,z] of [[ax+nx,az+nz],[bx+nx,bz+nz],[bx-nx,bz-nz],[ax-nx,az-nz]])vertices.push(x,0,z,0,1,0,0,0);indices.push(k,k+1,k+2,k,k+2,k+3);};
    for(let i=0;i<48;i++){const a=i*Math.PI/24,b=(i+1)*Math.PI/24;segment(1.8*Math.cos(a),1.8*Math.sin(a),1.8*Math.cos(b),1.8*Math.sin(b),.16);}
    // True 30 × 24 cm board footprint, centred on the actual hit.
    for(const [ax,az,bx,bz] of [[-15,-12,15,-12],[15,-12,15,12],[15,12,-15,12],[-15,12,-15,-12]]){
      const length=Math.hypot(bx-ax,bz-az);for(let at=0;at<length;at+=1.5){const end=Math.min(length,at+.9);segment(ax+(bx-ax)*at/length,az+(bz-az)*at/length,ax+(bx-ax)*end/length,az+(bz-az)*end/length);}
    }
    mesh.topology=MeshTopology.Triangles;mesh.indexType=MeshIndexType.UInt16;mesh.appendVerticesInterleaved(vertices);mesh.appendIndices(indices);mesh.updateMesh();
    const neutral=material.clone();neutral.mainPass.baseColor=new vec4(.82,.9,.94,1);
    const v=this.cursor.createComponent("Component.RenderMeshVisual") as RenderMeshVisual;v.mesh=mesh.getMesh();v.mainMaterial=neutral;this.cursor.enabled=false;
    owner.createEvent("OnDestroyEvent").bind(()=>{this.session?.stop();this.cursor.destroy();});
  }
  public begin(){
    this.generation++;this.hit=null;this.normal=null;this.pending=false;this.mode="placing";this.hint="Look at a table";
    this.queryCount=0;this.diagnosticKey="";this.diagnostics=[];this.diagnosticCounts={};
    try{
      if(!this.session){
        // Preview's normal filter blends nearby surfaces on this console. Keep
        // the measured normal and retain the existing strict horizontal gate.
        const options=HitTestSessionOptions.create();options.filter=false;
        this.session=(require("LensStudio:WorldQueryModule") as WorldQueryModule).createHitTestSessionWithOptions(options);
      }
      this.session.start();this.status("Look at a table, then pinch");
      this.diagnostic("session","started",{filter:false});
    }catch{
      this.hint="Can't place here. Try another table.";this.status(this.hint);
      this.diagnostic("session","unavailable");
    }
  }
  public cancel(){
    if(!this.isEditor&&!this.committed)return;
    this.generation++;this.pending=false;this.session?.stop();this.cursor.enabled=false;this.mode=this.committed?"surface":"manual";
  }
  public canCancel(){return this.isEditor||this.committed;}
  public hasHit(){return!!this.hit&&getTime()-this.hitAt<=.7;}
  public controlsPoint(){
    const transform=this.camera.getTransform(),camera=this.camera.getWorldPosition();
    if(this.hasHit())return this.hit!.add(this.nearDirection().uniformScale(19)).add(new vec3(0,2,0));
    // Follow the actual view, a little below its centre. LoopController supplies
    // the existing damped follow; a flattened heading can leave a downward view.
    const gaze=transform.forward.uniformScale(-1).normalize();
    return camera.add(gaze.uniformScale(61)).add(new vec3(0,-3.5,0));
  }
  private nearDirection(){const d=this.camera.getWorldPosition().sub(this.hit!);return new vec3(d.x,0,d.z).normalize();}
  public footprint(){
    if(!this.hasHit())return [];
    const near=this.nearDirection(),right=new vec3(near.z,0,-near.x),points:vec3[]=[];
    for(const x of [-15,15])for(const z of [-12,12])points.push(this.hit!.add(right.uniformScale(x)).add(near.uniformScale(z)).add(new vec3(0,.18,0)));
    return points;
  }
  public labelPoint(){return this.hasHit()?this.hit!.add(this.nearDirection().uniformScale(13)).add(new vec3(0,1,0)):this.controlsPoint().add(new vec3(0,5,0));}
  public tick(){
    for(const interactor of SIK.InteractionManager.getInteractorsByType(InteractorInputType.All)){
      if(this.bound.has(interactor))continue;
      this.bound.add(interactor);
      // Free-space SIK pinch works with either the SDK hand or MouseInteractor. No parallel raw gesture handler.
      interactor.onTriggerStart.add(target=>{if(this.mode==="placing"&&!target)this.commitHit();});
    }
    if(this.pending&&getTime()-this.lastQuery>.8){this.diagnostic("query","timeout",{ageMs:(getTime()-this.lastQuery)*1000,ray:this.lastRay});this.generation++;this.pending=false;this.hit=null;this.cursor.enabled=false;}
    if(this.mode!=="placing"||this.pending||getTime()-this.lastQuery<.2||!this.session)return;
    const start=this.camera.getWorldPosition();
    // Query the surface the person is looking at, including camera pitch.
    // Only the actual result below can provide a point to confirm.
    const direction=this.camera.getTransform().forward.uniformScale(-1).normalize(),generation=this.generation;
    const end=start.add(direction.uniformScale(220)),requestedAt=getTime(),query=++this.queryCount;
    const ray={from:vector3Data(start),to:vector3Data(end)};this.lastRay=ray;
    this.pending=true;this.lastQuery=requestedAt;
    try{this.session.hitTest(start,end,result=>{
      const detail={query,requestGeneration:generation,ageMs:(getTime()-requestedAt)*1000,ray,target:result?{position:vector3Data(result.position),normal:vector3Data(result.normal)}:null};
      if(generation!==this.generation||this.mode!=="placing"){this.diagnostic("query","stale-callback",detail);return;}
      this.pending=false;
      if(!result||result.normal.y<.92){this.cursor.enabled=false;this.hit=null;this.hint="Look at a flat table";this.diagnostic("rejected",result?"normal":"no-hit",detail);return;}
      const distance=result.position.distance(start);
      if(distance<35||distance>160){this.cursor.enabled=false;this.hit=null;this.hint="Move closer to the table";this.diagnostic("rejected","distance",{...detail,distanceCm:distance});return;}
      this.hit=result.position;this.normal=result.normal;this.hitAt=getTime();this.hint="Pinch to place here";
      this.cursor.enabled=true;this.cursor.getTransform().setWorldPosition(result.position.add(new vec3(0,.18,0)));
      const camera=this.camera.getWorldPosition();this.cursor.getTransform().setWorldRotation(quat.fromEulerAngles(0,Math.atan2(camera.x-result.position.x,camera.z-result.position.z),0));
      this.diagnostic("accepted","horizontal-hit",{...detail,distanceCm:distance});
    });}catch{
      this.pending=false;this.hit=null;this.cursor.enabled=false;this.hint="Can't place here. Try another table.";
      this.diagnostic("query","exception",{query,requestGeneration:generation,ray});
    }
  }
  public commitHit(){
    if(this.mode!=="placing"||!this.hit||!this.normal||getTime()-this.hitAt>.7){this.status(this.hint);return false;}
    const camera=this.camera.getWorldPosition(),point=this.hit,dx=camera.x-point.x,dz=camera.z-point.z;
    const t=this.table.getTransform();t.setWorldPosition(point.add(new vec3(0,.5,0)));t.setWorldRotation(quat.fromEulerAngles(0,Math.atan2(dx,dz),0));t.setLocalScale(vec3.one());
    this.source="WorldQuery table placement";this.mode="surface";this.committed=true;this.commits++;this.generation++;this.pending=false;
    this.session?.stop();this.cursor.enabled=false;this.status("Placed on your table");
    print("[MotionFoundry placement] "+JSON.stringify({event:"surface-committed",isEditor:this.isEditor,position:{x:point.x,y:point.y,z:point.z},normal:{x:this.normal.x,y:this.normal.y,z:this.normal.z},commits:this.commits}));
    this.placed();return true;
  }
  public description(){return this.mode==="placing"?this.hint:this.source;}
  private diagnostic(event:string,reason:string,detail:Record<string,unknown>={}){
    const category=event+":"+reason;this.diagnosticCounts[category]=(this.diagnosticCounts[category]||0)+1;
    const coarseRay=this.lastRay?Object.values(this.lastRay).map(p=>[p.x,p.y,p.z].map(v=>Math.round(v/2))):null;
    const key=category+":"+this.generation+":"+JSON.stringify(coarseRay);
    if(key===this.diagnosticKey)return;this.diagnosticKey=key;
    if(this.diagnostics.length>=32)return;
    const record={event,reason,generation:this.generation,mode:this.mode,isEditor:this.isEditor,runtimeSeconds:getTime(),wallEpochMs:Date.now(),...detail};
    this.diagnostics.push(record);print("[MotionFoundry placement diagnostic] "+JSON.stringify(record));
  }
  public snapshot(){return{mode:this.mode,source:this.source,isEditor:this.isEditor,commits:this.commits,hit:this.hit?{x:this.hit.x,y:this.hit.y,z:this.hit.z}:null,normal:this.normal?{x:this.normal.x,y:this.normal.y,z:this.normal.z}:null,footprintCm:{width:30,depth:24},footprint:this.footprint().map(vector3Data),queryDiagnostics:{queryCount:this.queryCount,counts:{...this.diagnosticCounts},records:this.diagnostics.slice(),recordLimit:32}};}
}
