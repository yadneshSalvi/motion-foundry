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
  return Math.round((.05+1.15*t)*1000)/1000;
}
export function dialAngleFromFit(cm:number):number {
  return -3*Math.PI/4+Math.max(0,Math.min(1,(cm-.05)/1.15))*3*Math.PI/2;
}
