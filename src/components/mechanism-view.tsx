"use client";
import { useEffect, useRef, useState } from "react";
import * as THREE from "three";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";
import { RoomEnvironment } from "three/addons/environments/RoomEnvironment.js";
import { evaluateMechanism, type Candidate, type DesignInput, type Vec2 } from "@/domain";

type Props = { candidate: Candidate; input: DesignInput; phase: number; reveal: boolean; showTargets: boolean; view: "perspective" | "front"; onPoseAngle: (index: number, angle: number) => void; onSelectTarget: (index: number) => void };

function petalGeometry(length: number, width: number) {
  const positions: number[] = [], uvs: number[] = [], indices: number[] = [];
  const rows = 48, cols = 18;
  for (let y = 0; y <= rows; y++) for (let x = 0; x <= cols; x++) {
    const t=y/rows, s=x/cols*2-1, halfWidth=Math.pow(Math.sin(Math.PI*t), .72)*width;
    positions.push(.55*Math.sin(Math.PI*t) + .75*s*s*Math.sin(Math.PI*t) - .45*t*t, length*t, s*halfWidth);
    uvs.push(x/cols,t);
  }
  for(let y=0;y<rows;y++)for(let x=0;x<cols;x++){const i=y*(cols+1)+x;indices.push(i,i+1,i+cols+1,i+1,i+cols+2,i+cols+1);}
  const g=new THREE.BufferGeometry(); g.setAttribute("position",new THREE.Float32BufferAttribute(positions,3));g.setAttribute("uv",new THREE.Float32BufferAttribute(uvs,2));g.setIndex(indices);g.computeVertexNormals();return g;
}

export function MechanismView(props: Props) {
  const container = useRef<HTMLDivElement>(null), latest = useRef(props), [unavailable, setUnavailable] = useState(false);
  useEffect(() => { latest.current = props; }, [props]);
  useEffect(() => {
    const host=container.current; if(!host)return;
    let renderer: THREE.WebGLRenderer;
    try { renderer=new THREE.WebGLRenderer({antialias:true,alpha:false,powerPreference:"high-performance"}); } catch { setUnavailable(true);return; }
    renderer.setPixelRatio(Math.min(window.devicePixelRatio,2));renderer.outputColorSpace=THREE.SRGBColorSpace;renderer.toneMapping=THREE.ACESFilmicToneMapping;renderer.toneMappingExposure=1.2;renderer.shadowMap.enabled=true;renderer.shadowMap.type=THREE.PCFShadowMap;
    renderer.domElement.setAttribute("aria-label","Interactive four-bar mechanism. Drag to orbit, scroll to zoom. In target mode, drag a blue handle to change its desired angle.");renderer.domElement.setAttribute("role","img");host.appendChild(renderer.domElement);
    const scene=new THREE.Scene();scene.background=new THREE.Color("#edece5");scene.fog=new THREE.Fog("#edece5",55,100);
    const camera=new THREE.PerspectiveCamera(32,1,.1,150);camera.position.set(18,12.5,24);
    const controls=new OrbitControls(camera,renderer.domElement);controls.target.set(3.5,3.7,0);controls.enableDamping=true;controls.dampingFactor=.08;controls.minDistance=15;controls.maxDistance=48;controls.maxPolarAngle=Math.PI*.52;controls.enablePan=false;
    const pmrem=new THREE.PMREMGenerator(renderer), room=new RoomEnvironment(), env=pmrem.fromScene(room,.04);scene.environment=env.texture;room.dispose();pmrem.dispose();
    const ambient=new THREE.HemisphereLight(0xfffaf0,0xb5b8aa,2.2);scene.add(ambient);
    const sun=new THREE.DirectionalLight(0xfff4dd,3.2);sun.position.set(-8,20,10);sun.castShadow=true;sun.shadow.mapSize.set(2048,2048);sun.shadow.camera.left=-16;sun.shadow.camera.right=16;sun.shadow.camera.top=18;sun.shadow.camera.bottom=-12;sun.shadow.normalBias=.025;scene.add(sun);
    const rim=new THREE.DirectionalLight(0xf4fffc,2);rim.position.set(8,8,-12);scene.add(rim);
    const materials={
      brass:new THREE.MeshStandardMaterial({color:0xbda064,metalness:.84,roughness:.25}),
      steel:new THREE.MeshStandardMaterial({color:0xc9cdc5,metalness:.88,roughness:.22}),
      dark:new THREE.MeshStandardMaterial({color:0x3f493f,metalness:.7,roughness:.32}),
      ceramic:new THREE.MeshPhysicalMaterial({color:0xfff4dc,metalness:0,roughness:.3,clearcoat:.65,clearcoatRoughness:.25,side:THREE.DoubleSide,transparent:true}),
      petalSide:new THREE.MeshPhysicalMaterial({color:0xe4d7bb,metalness:.05,roughness:.38,clearcoat:.4,side:THREE.DoubleSide,transparent:true}),
      base:new THREE.MeshStandardMaterial({color:0x637364,metalness:.38,roughness:.48}),
      floor:new THREE.MeshStandardMaterial({color:0xe8e8de,roughness:.95}),
      obstacle:new THREE.MeshStandardMaterial({color:0xd17860,transparent:true,opacity:.38,roughness:.5,depthWrite:false}),
      sky:new THREE.MeshBasicMaterial({color:0x6a9faa}), mint:new THREE.LineBasicMaterial({color:0x529d81,transparent:true,opacity:.7}),
    };
    const floor=new THREE.Mesh(new THREE.PlaneGeometry(200,200),materials.floor);floor.rotation.x=-Math.PI/2;floor.position.y=-1.15;floor.receiveShadow=true;scene.add(floor);
    const base=new THREE.Mesh(new THREE.CylinderGeometry(11.2,11.6,.5,96),materials.base);base.scale.z=.62;base.position.set(4,-.85,0);base.receiveShadow=true;base.castShadow=true;scene.add(base);
    const top=new THREE.Mesh(new THREE.CylinderGeometry(10.95,10.95,.06,96),new THREE.MeshStandardMaterial({color:0x7c8979,roughness:.6,metalness:.3}));top.scale.z=.62;top.position.set(4,-.565,0);scene.add(top);
    const rings=new THREE.Group();for(let i=0;i<4;i++){const ring=new THREE.Mesh(new THREE.TorusGeometry(7.5+i,.012,6,96),materials.brass);ring.rotation.x=-Math.PI/2;ring.scale.y=.62;ring.position.set(4,-.525,0);rings.add(ring);}scene.add(rings);
    const model=new THREE.Group();scene.add(model);
    const links=Array.from({length:4},()=>{const m=new THREE.Mesh(new THREE.CylinderGeometry(1,1,1,20),materials.brass);m.castShadow=true;model.add(m);return m;});
    const jointMeshes=Array.from({length:4},()=>{const group=new THREE.Group(), ring=new THREE.Mesh(new THREE.CylinderGeometry(.17,.17,.13,24),materials.dark),cap=new THREE.Mesh(new THREE.CylinderGeometry(.095,.095,.17,24),materials.brass);ring.rotation.x=Math.PI/2;cap.rotation.x=Math.PI/2;group.add(ring,cap);model.add(group);return group;});
    const pedestals=Array.from({length:2},()=>{const group=new THREE.Group();const pad=new THREE.Mesh(new THREE.CylinderGeometry(.5,.58,.2,32),materials.brass);pad.position.y=-.4;const stand=new THREE.Mesh(new THREE.BoxGeometry(.25,.52,.45),materials.dark);stand.position.y=-.18;group.add(pad,stand);scene.add(group);return group;});
    const handle=new THREE.Group(), shaft=new THREE.Mesh(new THREE.CylinderGeometry(.1,.1,1.25,20),materials.steel),grip=new THREE.Mesh(new THREE.CylinderGeometry(.22,.25,.75,32),materials.dark);shaft.rotation.x=Math.PI/2;shaft.position.z=1.1;grip.rotation.x=Math.PI/2;grip.position.z=1.6;handle.add(shaft,grip);model.add(handle);
    const petals=new THREE.Group(), main=new THREE.Mesh(petalGeometry(10.4,2.55),materials.ceramic);main.castShadow=true;main.receiveShadow=true;petals.add(main);
    for(const side of [-1,1]){const blade=new THREE.Mesh(petalGeometry(8.2,1.7),materials.petalSide);blade.rotation.y=side*.58;blade.rotation.x=side*.22;blade.position.z=side*.55;blade.castShadow=true;petals.add(blade);}
    // All petals belong to this rigid output group: there is exactly one mechanical degree of freedom.
    const veinPoints=Array.from({length:50},(_,i)=>{const t=i/49;return new THREE.Vector3(.55*Math.sin(Math.PI*t)-.45*t*t+.025,10.4*t,0);});petals.add(new THREE.Line(new THREE.BufferGeometry().setFromPoints(veinPoints),new THREE.LineBasicMaterial({color:0xba9d60,transparent:true,opacity:.42})));scene.add(petals);
    let trace:THREE.Line|undefined, obstacleHash="", parameterHash="", view="", obstacleMeshes:THREE.Mesh[]=[];
    const targetGroup=new THREE.Group();scene.add(targetGroup);const handles:THREE.Mesh[]=[];for(let i=0;i<16;i++){const m=new THREE.Mesh(new THREE.SphereGeometry(.19,18,12),materials.sky);m.userData.index=i;targetGroup.add(m);handles.push(m);}
    const desiredRay=new THREE.Line(new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(),new THREE.Vector3()]),new THREE.LineDashedMaterial({color:0x7aa4b4,dashSize:.22,gapSize:.12}));scene.add(desiredRay);
    const raycaster=new THREE.Raycaster(),pointer=new THREE.Vector2(),plane=new THREE.Plane(new THREE.Vector3(0,0,1),-.8),intersection=new THREE.Vector3();let dragging:number|null=null;
    const pointerPosition=(event:PointerEvent)=>{const r=renderer.domElement.getBoundingClientRect();pointer.set((event.clientX-r.left)/r.width*2-1,-(event.clientY-r.top)/r.height*2+1);raycaster.setFromCamera(pointer,camera);};
    const down=(event:PointerEvent)=>{if(!latest.current.showTargets)return;pointerPosition(event);raycaster.params.Points={threshold:.4};const hits=raycaster.intersectObjects(handles.filter(m=>m.visible));if(hits.length){dragging=hits[0].object.userData.index;controls.enabled=false;renderer.domElement.setPointerCapture(event.pointerId);latest.current.onSelectTarget(dragging!);event.stopPropagation();}};
    const move=(event:PointerEvent)=>{if(dragging===null)return;pointerPosition(event);if(raycaster.ray.intersectPlane(plane,intersection)){const p=latest.current.candidate.parameters;const angle=Math.atan2(intersection.y,intersection.x-p.groundCm);latest.current.onPoseAngle(dragging,Math.max(20*Math.PI/180,Math.min(170*Math.PI/180,angle)));}};
    const up=()=>{dragging=null;controls.enabled=true;};
    renderer.domElement.addEventListener("pointerdown",down,true);renderer.domElement.addEventListener("pointermove",move);renderer.domElement.addEventListener("pointerup",up);renderer.domElement.addEventListener("pointercancel",up);
    const resize=new ResizeObserver(()=>{const w=host.clientWidth,h=host.clientHeight;if(w&&h){renderer.setSize(w,h);camera.aspect=w/h;camera.updateProjectionMatrix();}});resize.observe(host);
    const upAxis=new THREE.Vector3(0,1,0),direction=new THREE.Vector3();
    function connect(mesh:THREE.Mesh,a:Vec2,b:Vec2,z:number,radius:number){direction.set(b.x-a.x,b.y-a.y,0);const length=direction.length();mesh.position.set((a.x+b.x)/2,(a.y+b.y)/2,z);mesh.scale.set(radius,length,radius);mesh.quaternion.setFromUnitVectors(upAxis,direction.normalize());}
    let frame=0, revealValue=0;
    const draw=()=>{
      frame=requestAnimationFrame(draw);const s=latest.current,p=s.candidate.parameters,pose=evaluateMechanism(p,s.phase);if(!pose)return;
      const layers=s.input.linkLayers??{crank:0,coupler:.4,rocker:0,ground:-.4};
      connect(links[0],pose.A,pose.B,layers.crank,s.input.linkRadiusCm);connect(links[1],pose.B,pose.C,layers.coupler,s.input.linkRadiusCm);connect(links[2],pose.D,pose.C,layers.rocker,s.input.linkRadiusCm);connect(links[3],pose.A,pose.D,layers.ground,s.input.linkRadiusCm);
      [pose.A,pose.B,pose.C,pose.D].forEach((q,i)=>jointMeshes[i].position.set(q.x,q.y,.48));pedestals[0].position.x=0;pedestals[1].position.x=p.groundCm;handle.position.set(pose.B.x,pose.B.y,0);
      revealValue+=(Number(s.reveal)-revealValue)*.1;petals.position.set(pose.D.x,pose.D.y,-.35-revealValue*1.25);petals.rotation.z=pose.outputAngleRad-Math.PI/2;materials.ceramic.opacity=1-revealValue*.87;materials.petalSide.opacity=1-revealValue*.94;petals.visible=revealValue<.99;
      const nextHash=JSON.stringify(p);if(parameterHash!==nextHash){parameterHash=nextHash;if(trace){scene.remove(trace);trace.geometry.dispose();}const points=Array.from({length:181},(_,i)=>{const q=evaluateMechanism(p,i*Math.PI/90)!.C;return new THREE.Vector3(q.x,q.y,.7);});trace=new THREE.Line(new THREE.BufferGeometry().setFromPoints(points),materials.mint);scene.add(trace);}
      if(trace)trace.visible=s.showTargets||s.reveal;
      handles.forEach((m,i)=>{const t=s.input.targetPoses[i];m.visible=s.showTargets&&!!t;if(t)m.position.set(p.groundCm+p.rockerCm*Math.cos(t.outputAngleRad),p.rockerCm*Math.sin(t.outputAngleRad),.8);});
      desiredRay.visible=s.showTargets;if(s.showTargets){const nearest=s.input.targetPoses.reduce((a,b)=>Math.abs(b.phaseRad-s.phase)<Math.abs(a.phaseRad-s.phase)?b:a);const attr=desiredRay.geometry.getAttribute("position") as THREE.BufferAttribute;attr.setXYZ(0,p.groundCm,0,.8);attr.setXYZ(1,p.groundCm+p.rockerCm*Math.cos(nearest.outputAngleRad),p.rockerCm*Math.sin(nearest.outputAngleRad),.8);attr.needsUpdate=true;desiredRay.computeLineDistances();}
      const nextObstacles=JSON.stringify(s.input.obstacles);if(obstacleHash!==nextObstacles){obstacleHash=nextObstacles;obstacleMeshes.forEach(m=>{scene.remove(m);m.geometry.dispose();});obstacleMeshes=s.input.obstacles.map(o=>{const mesh=new THREE.Mesh(new THREE.CylinderGeometry(o.radiusCm,o.radiusCm,o.depthCm??3,48),materials.obstacle);mesh.rotation.x=Math.PI/2;mesh.position.set(o.center.x,o.center.y,o.layerZCm??0);scene.add(mesh);return mesh;});}
      if(view!==s.view){view=s.view;if(view==="front")camera.position.set(4,4,28);else camera.position.set(18,12.5,24);controls.target.set(3.5,3.7,0);}
      controls.update();renderer.render(scene,camera);
    };draw();
    return()=>{cancelAnimationFrame(frame);resize.disconnect();controls.dispose();renderer.domElement.removeEventListener("pointerdown",down,true);renderer.domElement.removeEventListener("pointermove",move);renderer.domElement.removeEventListener("pointerup",up);renderer.domElement.removeEventListener("pointercancel",up);scene.traverse(obj=>{if(obj instanceof THREE.Mesh||obj instanceof THREE.Line){obj.geometry.dispose();const ms=Array.isArray(obj.material)?obj.material:[obj.material];ms.forEach(m=>m.dispose());}});env.texture.dispose();renderer.dispose();host.replaceChildren();};
  },[]);
  return <div className="mechanism-canvas" ref={container}>{unavailable&&<div className="webgl-fallback"><strong>The 3D view needs WebGL.</strong><p>The motion controls, numerical solve and export still work. Try a browser with hardware acceleration.</p></div>}</div>;
}
