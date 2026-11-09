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
  constructor(private owner:BaseScriptComponent,private table:SceneObject,material:Material,private status:(value:string)=>void,private placed:()=>void,readonly isEditor:boolean){
    this.cursor=global.scene.createSceneObject("Workbench surface placement outline");
    const mesh=new MeshBuilder([{name:"position",components:3},{name:"normal",components:3},{name:"texture0",components:2}]);
    const vertices:number[]=[],indices:number[]=[];
    for(let i=0;i<64;i++){const a=i*Math.PI/32,b=(i+1)*Math.PI/32,k=vertices.length/8;for(const [r,t] of [[4.85,a],[5.15,a],[5.15,b],[4.85,b]])vertices.push(r*Math.cos(t),0,r*Math.sin(t),0,1,0,0,0);indices.push(k,k+2,k+1,k,k+3,k+2);}
    mesh.topology=MeshTopology.Triangles;mesh.indexType=MeshIndexType.UInt16;mesh.appendVerticesInterleaved(vertices);mesh.appendIndices(indices);mesh.updateMesh();
    const v=this.cursor.createComponent("Component.RenderMeshVisual") as RenderMeshVisual;v.mesh=mesh.getMesh();v.mainMaterial=material;this.cursor.enabled=false;
    owner.createEvent("OnDestroyEvent").bind(()=>{this.session?.stop();this.cursor.destroy();});
  }
  public begin(){
    this.generation++;this.hit=null;this.normal=null;this.pending=false;this.mode="placing";this.hint="Look at a table";
    try{
      if(!this.session)this.session=(require("LensStudio:WorldQueryModule") as WorldQueryModule).createHitTestSession();
      this.session.start();this.status("Look at a table, then pinch");
    }catch{
      this.hint="Table depth unavailable. Look at another surface.";this.status(this.hint);
      print("[MotionFoundry placement] "+JSON.stringify({event:"session-unavailable",isEditor:this.isEditor}));
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
    // Follow the actual view, a little below its centre. LoopController supplies
    // the existing damped follow; a flattened heading can leave a downward view.
    const gaze=transform.forward.uniformScale(-1).normalize();
    return camera.add(gaze.uniformScale(61)).add(new vec3(0,-3.5,0));
  }
  public tick(){
    for(const interactor of SIK.InteractionManager.getInteractorsByType(InteractorInputType.All)){
      if(this.bound.has(interactor))continue;
      this.bound.add(interactor);
      // Free-space SIK pinch works with either the SDK hand or MouseInteractor. No parallel raw gesture handler.
      interactor.onTriggerStart.add(target=>{if(this.mode==="placing"&&!target)this.commitHit();});
    }
    if(this.pending&&getTime()-this.lastQuery>.8){this.generation++;this.pending=false;this.hit=null;this.cursor.enabled=false;}
    if(this.mode!=="placing"||this.pending||getTime()-this.lastQuery<.2||!this.session)return;
    const start=this.camera.getWorldPosition();
    // Query the surface the person is looking at, including camera pitch.
    // Only the actual result below can provide a point to confirm.
    const direction=this.camera.getTransform().forward.uniformScale(-1).normalize(),generation=this.generation;
    this.pending=true;this.lastQuery=getTime();
    this.session.hitTest(start,start.add(direction.uniformScale(220)),result=>{
      if(generation!==this.generation||this.mode!=="placing")return;
      this.pending=false;
      if(!result||result.normal.y<.92){this.cursor.enabled=false;this.hit=null;this.hint="Look at a flat table";return;}
      const distance=result.position.distance(start);
      if(distance<35||distance>160){this.cursor.enabled=false;this.hit=null;this.hint="Move closer to the table";return;}
      this.hit=result.position;this.normal=result.normal;this.hitAt=getTime();this.hint="Pinch to place here";
      this.cursor.enabled=true;this.cursor.getTransform().setWorldPosition(result.position.add(new vec3(0,.18,0)));
    });
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
  public snapshot(){return{mode:this.mode,source:this.source,isEditor:this.isEditor,commits:this.commits,hit:this.hit?{x:this.hit.x,y:this.hit.y,z:this.hit.z}:null,normal:this.normal?{x:this.normal.x,y:this.normal.y,z:this.normal.z}:null};}
}
