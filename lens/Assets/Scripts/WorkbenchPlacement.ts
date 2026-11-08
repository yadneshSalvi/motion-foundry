import SIK from "SpectaclesInteractionKit.lspkg/SIK";
import {Interactor,InteractorInputType} from "SpectaclesInteractionKit.lspkg/Core/Interactor/Interactor";
import WorldCameraFinderProvider from "SpectaclesInteractionKit.lspkg/Providers/CameraProvider/WorldCameraFinderProvider";

/** Explicit one-shot placement. Manual placement remains usable when scene depth is unavailable. */
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
  private source="Provided measurements · placed by hand";
  constructor(private owner:BaseScriptComponent,private table:SceneObject,material:Material,private status:(value:string)=>void,private placed:()=>void){
    this.cursor=global.scene.createSceneObject("Workbench surface placement outline");
    const mesh=new MeshBuilder([{name:"position",components:3},{name:"normal",components:3},{name:"texture0",components:2}]);
    const vertices:number[]=[],indices:number[]=[];
    for(let i=0;i<64;i++){const a=i*Math.PI/32,b=(i+1)*Math.PI/32,k=vertices.length/8;for(const [r,t] of [[4.9,a],[5.1,a],[5.1,b],[4.9,b]])vertices.push(r*Math.cos(t),0,r*Math.sin(t),0,1,0,0,0);indices.push(k,k+2,k+1,k,k+3,k+2);}
    mesh.topology=MeshTopology.Triangles;mesh.indexType=MeshIndexType.UInt16;mesh.appendVerticesInterleaved(vertices);mesh.appendIndices(indices);mesh.updateMesh();
    const v=this.cursor.createComponent("Component.RenderMeshVisual") as RenderMeshVisual;v.mesh=mesh.getMesh();v.mainMaterial=material;this.cursor.enabled=false;
    owner.createEvent("OnDestroyEvent").bind(()=>{this.session?.stop();this.cursor.destroy();});
  }
  public begin(){
    this.generation++;this.hit=null;this.normal=null;this.pending=false;
    try{
      if(!this.session)this.session=(require("LensStudio:WorldQueryModule") as WorldQueryModule).createHitTestSession();
      this.session.start();this.mode="placing";this.status("Aim at a table, then pinch");
    }catch{this.mode="manual";this.source="Provided measurements · placed by hand";this.status("Surface unavailable. Using the placed table.");}
  }
  public cancel(){this.generation++;this.pending=false;this.session?.stop();this.cursor.enabled=false;this.mode=this.source==="Surface placed with WorldQuery"?"surface":"manual";}
  public tick(){
    for(const interactor of SIK.InteractionManager.getInteractorsByType(InteractorInputType.All)){
      if(this.bound.has(interactor))continue;
      this.bound.add(interactor);
      interactor.onTriggerStart.add(target=>{if(this.mode==="placing"&&!target)this.query(interactor,true);});
    }
    if(this.mode!=="placing"||this.pending||getTime()-this.lastQuery<.16)return;
    const active=Array.from(this.bound).find(i=>i.enabled&&i.isActive()&&i.startPoint&&i.direction);
    if(active)this.query(active,false);
  }
  private query(interactor:Interactor,commit:boolean){
    const start=interactor.startPoint,direction=interactor.direction;
    if(!start||!direction||!this.session||this.mode!=="placing")return;
    const generation=this.generation;
    this.pending=true;this.lastQuery=getTime();
    this.session.hitTest(start,start.add(direction.uniformScale(500)),result=>{
      if(generation!==this.generation||this.mode!=="placing")return;
      this.pending=false;
      if(!result||result.normal.y<.92){this.cursor.enabled=false;this.hit=null;if(commit)this.status("Choose a horizontal table surface");return;}
      this.hit=result.position;this.normal=result.normal;
      this.cursor.enabled=true;this.cursor.getTransform().setWorldPosition(result.position.add(new vec3(0,.18,0)));
      if(!commit)return;
      // Owner remains unit scale; yaw faces its near edge toward the wearer. No following after this point.
      const camera=this.camera.getWorldPosition(),dx=camera.x-result.position.x,dz=camera.z-result.position.z;
      const t=this.table.getTransform();t.setWorldPosition(result.position.add(new vec3(0,.5,0)));t.setWorldRotation(quat.fromEulerAngles(0,Math.atan2(dx,dz),0));t.setLocalScale(vec3.one());
      this.source="Surface placed with WorldQuery";this.mode="surface";this.generation++;this.pending=false;
      this.session!.stop();this.cursor.enabled=false;this.status("Placed on the table");this.placed();
    });
  }
  public description(){return this.source;}
  public snapshot(){return{mode:this.mode,source:this.source,hit:this.hit?{x:this.hit.x,y:this.hit.y,z:this.hit.z}:null,normal:this.normal?{x:this.normal.x,y:this.normal.y,z:this.normal.z}:null};}
}
