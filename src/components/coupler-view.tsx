"use client";
import { useEffect, useRef, useState } from "react";
import * as THREE from "three";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";
import { RoomEnvironment } from "three/addons/environments/RoomEnvironment.js";
import { evaluateCouplerPoint, type LoopCandidate, type LoopInput, type LoopVerification } from "@/domain/loop";
import type { Vec2 } from "@/domain";
type Props = { input: LoopInput; candidate: LoopCandidate; phase: number; reveal: boolean; front: boolean; witness?: LoopVerification["collisionWitness"]; fitWitness?: LoopVerification["fitWitness"] };
export function CouplerView(props: Props) {
  const host = useRef<HTMLDivElement>(null), latest = useRef(props), [unavailable, setUnavailable] = useState(false);
  useEffect(() => { latest.current = props; }, [props]);
  useEffect(() => {
    const container = host.current; if (!container) return;
    let renderer: THREE.WebGLRenderer; try { renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false }); } catch { setUnavailable(true); return; }
    renderer.setPixelRatio(Math.min(devicePixelRatio, 2)); renderer.outputColorSpace = THREE.SRGBColorSpace; renderer.toneMapping = THREE.ACESFilmicToneMapping; renderer.toneMappingExposure = 1.18;
    renderer.shadowMap.enabled = true; renderer.shadowMap.type = THREE.PCFShadowMap;
    renderer.domElement.setAttribute("role", "img"); renderer.domElement.setAttribute("aria-label", "Coupler mechanism and physical tracing point. Blue is the drawing; green is the actual linkage trace. Drag to orbit."); container.appendChild(renderer.domElement);
    const scene = new THREE.Scene(); scene.background = new THREE.Color("#eeede6");
    const camera = new THREE.PerspectiveCamera(32, 1, .1, 200), controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true; controls.enablePan = false; controls.minDistance = 13; controls.maxDistance = 65; controls.maxPolarAngle = Math.PI * .8;
    const pmrem = new THREE.PMREMGenerator(renderer), room = new RoomEnvironment(), environment = pmrem.fromScene(room, .04); scene.environment = environment.texture; room.dispose(); pmrem.dispose();
    scene.add(new THREE.HemisphereLight(0xfff9e8, 0x879c8c, 2.8));
    const sun = new THREE.DirectionalLight(0xfff3d8, 3.4); sun.position.set(-6, 12, 15); sun.castShadow = true; sun.shadow.mapSize.set(2048, 2048); Object.assign(sun.shadow.camera, { left: -20, right: 20, top: 20, bottom: -20 }); sun.shadow.normalBias = .015; scene.add(sun);
    const rim = new THREE.DirectionalLight(0xe2fff0, 2); rim.position.set(12, -3, 5); scene.add(rim);
    const material = {
      brass: new THREE.MeshStandardMaterial({ color: 0xb79a5e, metalness: .84, roughness: .24 }),
      pale: new THREE.MeshStandardMaterial({ color: 0x8b9d78, metalness: .56, roughness: .32 }),
      dark: new THREE.MeshStandardMaterial({ color: 0x2e4437, metalness: .6, roughness: .3 }),
      board: new THREE.MeshStandardMaterial({ color: 0xe2e5d8, roughness: .8 }),
      edge: new THREE.MeshStandardMaterial({ color: 0x687c64, metalness: .38, roughness: .48 }),
      tip: new THREE.MeshStandardMaterial({ color: 0x367e58, emissive: 0x286843, emissiveIntensity: .7, metalness: .25, roughness: .3 }),
      trace: new THREE.MeshBasicMaterial({ color: 0x468764 }),
      desired: new THREE.LineDashedMaterial({ color: 0x5e8fa3, dashSize: .11, gapSize: .08 }),
      obstacle: new THREE.MeshStandardMaterial({ color: 0xcb7258, transparent: true, opacity: .5, roughness: .45 }),
      witness: new THREE.MeshBasicMaterial({ color: 0xbf583d, transparent: true, opacity: .8 }),
    };
    const board = new THREE.Mesh(new THREE.BoxGeometry(1, 1, .18), material.board); board.position.z = -.85; board.receiveShadow = true; scene.add(board);
    const edge = new THREE.Mesh(new THREE.BoxGeometry(1, 1, .26), material.edge); edge.position.z = -1.04; scene.add(edge);
    const hardware = new THREE.Group(); scene.add(hardware);
    const links = Array.from({ length: 6 }, (_, i) => { const mesh = new THREE.Mesh(new THREE.CylinderGeometry(1, 1, 1, 20), i > 3 ? material.pale : material.brass); mesh.castShadow = true; hardware.add(mesh); return mesh; });
    const joints = Array.from({ length: 4 }, () => { const group = new THREE.Group(); const ring = new THREE.Mesh(new THREE.CylinderGeometry(.17, .17, .13, 24), material.dark), pin = new THREE.Mesh(new THREE.CylinderGeometry(.095, .095, .18, 24), material.brass); ring.rotation.x = pin.rotation.x = Math.PI / 2; group.add(ring, pin); hardware.add(group); return group; });
    const mounts = Array.from({ length: 2 }, () => { const mesh = new THREE.Mesh(new THREE.CylinderGeometry(.37, .42, .25, 32), material.dark); mesh.rotation.x = Math.PI / 2; scene.add(mesh); return mesh; });
    const point = new THREE.Mesh(new THREE.SphereGeometry(.13, 24, 16), material.tip); scene.add(point);
    const halo = new THREE.Mesh(new THREE.RingGeometry(.24, .28, 32), new THREE.MeshBasicMaterial({ color: 0x3f8760, transparent: true, opacity: .45, side: THREE.DoubleSide, depthWrite: false })); scene.add(halo);
    const witness = new THREE.Mesh(new THREE.RingGeometry(.22, .30, 32), material.witness); scene.add(witness);
    const fitLine = new THREE.Line(new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(), new THREE.Vector3()]), new THREE.LineBasicMaterial({ color: 0xb56345 })); fitLine.frustumCulled = false; scene.add(fitLine);
    const fitRings = [0x4c879f, 0xba6a4e].map(color => { const m = new THREE.Mesh(new THREE.RingGeometry(.18, .23, 32), new THREE.MeshBasicMaterial({ color, side: THREE.DoubleSide, depthWrite: false })); scene.add(m); return m; });
    let actual: THREE.Mesh | undefined, desired: THREE.Line | undefined, obstacles: THREE.Mesh[] = [], oldInput = "", oldParameters = "", oldView: boolean | null = null, center = new THREE.Vector3(4, 2, 0), extent = 15;
    const direction = new THREE.Vector3(), up = new THREE.Vector3(0, 1, 0);
    const connect = (mesh: THREE.Mesh, a: Vec2, b: Vec2, z: number, r: number) => { direction.set(b.x - a.x, b.y - a.y, 0); const length = direction.length(); mesh.visible = length > .0001; mesh.position.set((a.x + b.x) / 2, (a.y + b.y) / 2, z); mesh.scale.set(r, length, r); mesh.quaternion.setFromUnitVectors(up, direction.normalize()); };
    const setCamera = (front: boolean) => { const d = Math.max(extent / camera.aspect, extent * .7) / (2 * Math.tan(camera.fov * Math.PI / 360)); camera.position.copy(center).add(front ? new THREE.Vector3(0, 0, d) : new THREE.Vector3(d * .22, d * .11, d)); controls.target.copy(center); camera.lookAt(center); };
    const resize = new ResizeObserver(() => { const w = container.clientWidth, h = container.clientHeight; if (w && h) { renderer.setSize(w, h); camera.aspect = w / h; camera.updateProjectionMatrix(); setCamera(latest.current.front); } }); resize.observe(container);
    let frame = 0;
    const draw = () => {
      frame = requestAnimationFrame(draw); const s = latest.current, p = s.candidate.parameters, pose = evaluateCouplerPoint(p, s.phase); if (!pose) return;
      const layers = s.input.linkLayers ?? { crank: 0, coupler: .4, rocker: 0, ground: -.4 }, r = s.input.linkRadiusCm;
      connect(links[0], pose.A, pose.B, layers.crank, r); connect(links[1], pose.B, pose.C, layers.coupler, r); connect(links[2], pose.D, pose.C, layers.rocker, r); connect(links[3], pose.A, pose.D, layers.ground, r); connect(links[4], pose.B, pose.point, layers.coupler, r); connect(links[5], pose.C, pose.point, layers.coupler, r);
      hardware.visible = s.reveal; [pose.A, pose.B, pose.C, pose.D].forEach((q, i) => joints[i].position.set(q.x, q.y, .52)); mounts[0].position.set(0, 0, -.55); mounts[1].position.set(p.groundCm, 0, -.55);
      point.position.set(pose.point.x, pose.point.y, layers.coupler + .12); halo.position.set(pose.point.x, pose.point.y, layers.coupler + .3);
      witness.visible = !!s.witness; if (s.witness) witness.position.set(s.witness.location.x, s.witness.location.y, .8);
      fitLine.visible = !!s.fitWitness; fitRings.forEach(m => m.visible = !!s.fitWitness); if (s.fitWitness) { const w = s.fitWitness, position = fitLine.geometry.getAttribute("position") as THREE.BufferAttribute; position.setXYZ(0, w.desired.x, w.desired.y, 1.05); position.setXYZ(1, w.actual.x, w.actual.y, 1.05); position.needsUpdate = true; fitRings[0].position.set(w.desired.x, w.desired.y, 1.06); fitRings[1].position.set(w.actual.x, w.actual.y, 1.06); }
      const ph = JSON.stringify(p); if (ph !== oldParameters) { oldParameters = ph; if (actual) { scene.remove(actual); actual.geometry.dispose(); } const curve = new THREE.CurvePath<THREE.Vector3>(), pts = Array.from({ length: 361 }, (_, i) => { const q = evaluateCouplerPoint(p, p.startingPhaseRad + p.driveDirection * i * Math.PI / 180)!.point; return new THREE.Vector3(q.x, q.y, .65); }); for (let i = 1; i < pts.length; i++) curve.add(new THREE.LineCurve3(pts[i - 1], pts[i])); actual = new THREE.Mesh(new THREE.TubeGeometry(curve, 360, .022, 6, true), material.trace); scene.add(actual); }
      const ih = JSON.stringify([s.input.stroke, s.input.obstacles]); if (ih !== oldInput) { oldInput = ih; if (desired) { scene.remove(desired); desired.geometry.dispose(); } desired = new THREE.Line(new THREE.BufferGeometry().setFromPoints([...s.input.stroke, s.input.stroke[0]].map(q => new THREE.Vector3(q.x, q.y, .7))), material.desired); desired.computeLineDistances(); scene.add(desired); obstacles.forEach(o => { scene.remove(o); o.geometry.dispose(); }); obstacles = s.input.obstacles.map(o => { const mesh = new THREE.Mesh(new THREE.CylinderGeometry(o.radiusCm, o.radiusCm, o.depthCm ?? 1.1, 48), material.obstacle); mesh.rotation.x = Math.PI / 2; mesh.position.set(o.center.x, o.center.y, o.layerZCm ?? .15); scene.add(mesh); return mesh; }); const all = [...s.input.stroke, { x: -p.crankCm, y: -p.crankCm }, { x: p.groundCm + .5, y: p.crankCm }]; const minX = Math.min(...all.map(q => q.x)), maxX = Math.max(...all.map(q => q.x)), minY = Math.min(...all.map(q => q.y)), maxY = Math.max(...all.map(q => q.y)); center = new THREE.Vector3((minX + maxX) / 2, (minY + maxY) / 2, 0); extent = Math.max(11, maxX - minX + 3, maxY - minY + 3); board.scale.set(extent + 1, extent * .83 + 1, 1); edge.scale.set(extent + 1.1, extent * .83 + 1.1, 1); board.position.x = edge.position.x = center.x; board.position.y = edge.position.y = center.y; setCamera(s.front); }
      if (oldView !== s.front) { oldView = s.front; setCamera(s.front); }
      controls.update(); renderer.render(scene, camera);
    }; draw();
    return () => { cancelAnimationFrame(frame); resize.disconnect(); controls.dispose(); scene.traverse(o => { if (o instanceof THREE.Mesh || o instanceof THREE.Line) { o.geometry.dispose(); const ms = Array.isArray(o.material) ? o.material : [o.material]; ms.forEach(m => m.dispose()); } }); environment.texture.dispose(); renderer.dispose(); container.replaceChildren(); };
  }, []);
  return <div ref={host} className="mechanism-canvas">{unavailable && <div className="webgl-fallback"><b>3D requires WebGL.</b><p>Draw, solve and export still work in this browser.</p></div>}</div>;
}
