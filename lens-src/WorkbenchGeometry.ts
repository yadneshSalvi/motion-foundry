/** Mesh data independent of Lens Studio, so the drawn physical envelope can be tested. */
export type WorkbenchMesh = {vertices:number[]; indices:number[]};
export type Point3 = {x:number; y:number; z:number};

/** An XY capsule extruded through exactly `depth`, with endpoints ±length/2 on X. */
export function capsuleMesh(length:number, radius:number, depth:number, arcSegments=20):WorkbenchMesh {
  if (!(length>=0 && radius>0 && depth>0) || ![length,radius,depth].every(Number.isFinite)) throw Error("Invalid bar dimensions");
  const boundary:{x:number;y:number;nx:number;ny:number}[]=[];
  for(let side=0;side<2;side++) for(let i=0;i<=arcSegments;i++) {
    const angle=-Math.PI/2+side*Math.PI+i*Math.PI/arcSegments;
    const nx=Math.cos(angle),ny=Math.sin(angle);
    boundary.push({x:(side===0?length/2:-length/2)+radius*nx,y:radius*ny,nx,ny});
  }
  const vertices:number[]=[],indices:number[]=[];
  const add=(x:number,y:number,z:number,nx:number,ny:number,nz:number)=>{
    const index=vertices.length/8;
    vertices.push(x,y,z,nx,ny,nz,(x+length/2+radius)/(length+2*radius),(y+radius)/(2*radius));
    return index;
  };
  for(const sign of [1,-1]) {
    const center=add(0,0,sign*depth/2,0,0,sign),first=vertices.length/8;
    for(const p of boundary)add(p.x,p.y,sign*depth/2,0,0,sign);
    for(let i=0;i<boundary.length;i++) {
      const a=first+i,b=first+(i+1)%boundary.length;
      if(sign>0)indices.push(center,a,b);else indices.push(center,b,a);
    }
  }
  for(let i=0;i<boundary.length;i++) {
    const a=boundary[i],b=boundary[(i+1)%boundary.length];
    if(Math.hypot(a.x-b.x,a.y-b.y)<1e-10)continue;
    const base=vertices.length/8;
    add(a.x,a.y,-depth/2,a.nx,a.ny,0);add(b.x,b.y,-depth/2,b.nx,b.ny,0);
    add(b.x,b.y,depth/2,b.nx,b.ny,0);add(a.x,a.y,depth/2,a.nx,a.ny,0);
    indices.push(base,base+1,base+2,base,base+2,base+3);
  }
  return {vertices,indices};
}

/** A ray and a plane expressed in the SAME local coordinate frame. */
export function intersectBoardRay(origin:Point3,direction:Point3,height:number):Point3|null {
  if(![origin.x,origin.y,origin.z,direction.x,direction.y,direction.z,height].every(Number.isFinite))return null;
  if(Math.abs(direction.z)<1e-7)return null;
  const t=(height-origin.z)/direction.z;
  if(t<0)return null;
  return {x:origin.x+direction.x*t,y:origin.y+direction.y*t,z:height};
}

/** Keep the fit dial's 270-degree useful arc monotonic, including its end stops. */
export function fitFromDialAngle(angle:number):number {
  const t=Math.max(0,Math.min(1,(angle+3*Math.PI/4)/(3*Math.PI/2)));
  return Math.round((.1+.4*t)*1000)/1000;
}
export function dialAngleFromFit(cm:number):number {
  return -3*Math.PI/4+Math.max(0,Math.min(1,(cm-.1)/.4))*3*Math.PI/2;
}

/** An ordinary tube used for decorative handles/ink; not a verified rod factory. */
export function tubeMesh3D(points:readonly Point3[],radius:number,sides=8):WorkbenchMesh{
  if(!(radius>0)||points.length<2)return{vertices:[],indices:[]};
  const vertices:number[]=[],indices:number[]=[];
  for(let i=0;i<points.length;i++){
    const before=points[Math.max(0,i-1)],after=points[Math.min(points.length-1,i+1)];
    let tx=after.x-before.x,ty=after.y-before.y,tz=after.z-before.z;
    const length=Math.hypot(tx,ty,tz)||1;tx/=length;ty/=length;tz/=length;
    const vertical=Math.abs(tz)>.8;
    let nx=vertical?-tz:-ty,ny=vertical?0:tx,nz=vertical?tx:0;
    const n=Math.hypot(nx,ny,nz)||1;nx/=n;ny/=n;nz/=n;
    const bx=ty*nz-tz*ny,by=tz*nx-tx*nz,bz=tx*ny-ty*nx;
    for(let j=0;j<sides;j++){
      const angle=j*Math.PI*2/sides,c=Math.cos(angle),s=Math.sin(angle),x=nx*c+bx*s,y=ny*c+by*s,z=nz*c+bz*s;
      vertices.push(points[i].x+x*radius,points[i].y+y*radius,points[i].z+z*radius,x,y,z,j/sides,i/(points.length-1));
    }
  }
  for(let i=0;i<points.length-1;i++)for(let j=0;j<sides;j++){
    const a=i*sides+j,b=i*sides+(j+1)%sides,c=b+sides,d=a+sides;indices.push(a,b,c,a,c,d);
  }
  return{vertices,indices};
}

/**
 * A low mug stand-in, including its handle, INSIDE the input's circular keep-out.
 * Local origin is the obstacle's vertical centre. The handle faces +X, toward the
 * crank in the starter setup, and touches (never exceeds) the checked radius.
 */
export function mugStandInMeshes(radius:number,depth:number):{body:WorkbenchMesh;handle:WorkbenchMesh;rim:WorkbenchMesh}{
  if(!(radius>0&&depth>0))throw Error("Invalid mug dimensions");
  const centerX=-.24*radius,outer=.66*radius,wall=Math.min(.22,outer*.15),inner=outer-wall;
  const bottom=-depth/2,top=depth/2,vertices:number[]=[],indices:number[]=[],sides=48;
  const addQuad=(points:Point3[],normals:Point3[])=>{
    const base=vertices.length/8;points.forEach((p,i)=>{const n=normals[i];vertices.push(p.x,p.y,p.z,n.x,n.y,n.z,i%2,Math.floor(i/2));});
    indices.push(base,base+1,base+2,base,base+2,base+3);
  };
  for(let i=0;i<sides;i++){
    const a=i*Math.PI*2/sides,b=(i+1)*Math.PI*2/sides;
    const p=(r:number,t:number,z:number)=>({x:centerX+r*Math.cos(t),y:r*Math.sin(t),z});
    const na={x:Math.cos(a),y:Math.sin(a),z:0},nb={x:Math.cos(b),y:Math.sin(b),z:0};
    addQuad([p(outer,a,bottom),p(outer,b,bottom),p(outer,b,top-.12),p(outer,a,top-.12)],[na,nb,nb,na]);
    addQuad([p(inner,b,bottom+.22),p(inner,a,bottom+.22),p(inner,a,top-.12),p(inner,b,top-.12)],[{x:-nb.x,y:-nb.y,z:0},{x:-na.x,y:-na.y,z:0},{x:-na.x,y:-na.y,z:0},{x:-nb.x,y:-nb.y,z:0}]);
    const up={x:0,y:0,z:1};
    addQuad([p(inner,a,top-.12),p(outer,a,top-.12),p(outer,b,top-.12),p(inner,b,top-.12)],[up,up,up,up]);
    const base=vertices.length/8;
    for(const q of [{x:centerX,y:0,z:bottom+.22},p(inner,a,bottom+.22),p(inner,b,bottom+.22)])vertices.push(q.x,q.y,q.z,0,0,1,0,0);
    indices.push(base,base+1,base+2);
  }
  const handleRadius=Math.min(.06*radius,.12*depth),rx=.49*radius-handleRadius,rz=depth*.36-handleRadius;
  const handlePoints=Array.from({length:65},(_,i)=>{const t=i*Math.PI/32;return{x:.51*radius+rx*Math.cos(t),y:0,z:rz*Math.sin(t)};});
  const rimRadius=Math.min(.11,depth*.08),rimPoints=Array.from({length:65},(_,i)=>{const t=i*Math.PI/32;return{x:centerX+(outer-rimRadius)*Math.cos(t),y:(outer-rimRadius)*Math.sin(t),z:top-rimRadius};});
  return{body:{vertices,indices},handle:tubeMesh3D(handlePoints,handleRadius,12),rim:tubeMesh3D(rimPoints,rimRadius,10)};
}
