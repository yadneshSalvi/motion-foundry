"use client";
import { useRef, useState } from "react";
import { Check, Undo2, X } from "lucide-react";
import { evaluateCouplerPoint, type LoopCandidate, type LoopInput } from "@/domain/loop";
import type { Vec2 } from "@/domain";
import { LOOP_BOARD, normalizeStroke } from "@/lib/loop-workshop";
type Props = { input: LoopInput; candidate: LoopCandidate; phase: number; mode: "draw" | "edit"; onStroke: (stroke: Vec2[]) => void; onDraft: (pending: boolean) => void; onMessage: (message: string) => void; onDone: () => void };
const SIZE = 680, SCALE = SIZE / (LOOP_BOARD.maxX - LOOP_BOARD.minX);
const px = (p: Vec2) => ({ x: (p.x - LOOP_BOARD.minX) * SCALE, y: (LOOP_BOARD.maxY - p.y) * SCALE });
const path = (points: Vec2[], closed = true) => points.length ? points.map((p, i) => `${i ? "L" : "M"}${px(p).x.toFixed(2)},${px(p).y.toFixed(2)}`).join(" ") + (closed ? "Z" : "") : "";
const distance = (a: Vec2, b: Vec2) => Math.hypot(a.x - b.x, a.y - b.y);
export function LoopBoard({ input, candidate, phase, mode, onStroke, onDraft, onMessage, onDone }: Props) {
  const svg = useRef<SVGSVGElement>(null), active = useRef<"stroke" | number | null>(null), points = useRef<Vec2[]>([]);
  const [draft, setDraft] = useState<Vec2[]>([]), [pending, setPending] = useState(false);
  const pose = evaluateCouplerPoint(candidate.parameters, phase), desired = draft.length ? draft : input.stroke;
  const point = (e: React.PointerEvent): Vec2 | null => { const matrix = svg.current?.getScreenCTM(); if (!matrix) return null; const p = new DOMPoint(e.clientX, e.clientY).matrixTransform(matrix.inverse()); return { x: Math.round(Math.max(LOOP_BOARD.minX, Math.min(LOOP_BOARD.maxX, p.x / SCALE + LOOP_BOARD.minX)) * 1000) / 1000, y: Math.round(Math.max(LOOP_BOARD.minY, Math.min(LOOP_BOARD.maxY, LOOP_BOARD.maxY - p.y / SCALE)) * 1000) / 1000 }; };
  const clear = () => { active.current = null; points.current = []; setDraft([]); setPending(false); onDraft(false); };
  const accept = (stroke: Vec2[], resample: boolean) => { if (stroke.length < 12) { onMessage("Draw a longer loop before closing it."); return; } try { onStroke(resample ? normalizeStroke(stroke) : stroke); clear(); onMessage("Drawing updated. Solve to check the new loop."); if (mode === "draw") onDone(); } catch { onMessage("The stroke needs a little more length."); } };
  const down = (e: React.PointerEvent<SVGSVGElement>) => { if (mode !== "draw" || pending) return; const p = point(e); if (!p) return; e.currentTarget.setPointerCapture(e.pointerId); active.current = "stroke"; points.current = [p]; setDraft([p]); onDraft(true); };
  const move = (e: React.PointerEvent<SVGSVGElement>) => { const p = point(e); if (!p || active.current === null) return; if (active.current === "stroke") { if (points.current.length < 2048 && distance(points.current.at(-1)!, p) >= .025) { points.current = [...points.current, p]; setDraft(points.current); } } else { const next = [...points.current]; next[active.current] = p; points.current = next; setDraft(next); } };
  const up = () => { if (active.current === "stroke") { active.current = null; if (points.current.length < 12) { clear(); onMessage("Draw a longer stroke; release near the starting ring to close it."); return; } if (distance(points.current[0], points.current.at(-1)!) <= .45) accept(points.current, true); else { setPending(true); onMessage("The stroke is open. Choose Close loop to add the final segment, or redraw."); } } else if (typeof active.current === "number") { active.current = null; accept(points.current, false); } };
  const beginEdit = (e: React.PointerEvent<SVGCircleElement>, i: number) => { e.stopPropagation(); svg.current?.setPointerCapture(e.pointerId); points.current = input.stroke.map(p => ({ ...p })); active.current = i; setDraft(points.current); onDraft(true); };
  const grid = Array.from({ length: 18 }, (_, i) => i * SCALE);
  return <div className={`loop-board ${mode}`}>
    <svg ref={svg} viewBox={`0 0 ${SIZE} ${SIZE}`} role="img" aria-label={mode === "draw" ? "Drawing board in centimetres. Draw a closed loop; release within 0.45 centimetres of its starting point." : "Edit the ordered loop by dragging a blue point."} onPointerDown={down} onPointerMove={move} onPointerUp={up} onPointerCancel={() => { clear(); onMessage("Drawing cancelled."); }}>
      <defs><radialGradient id="board-wash"><stop stopColor="#faf9f2"/><stop offset="1" stopColor="#e9eadd"/></radialGradient></defs><rect width={SIZE} height={SIZE} fill="url(#board-wash)"/>
      <g stroke="#697c65" strokeOpacity=".1" strokeWidth="1">{grid.map((n, i) => <g key={i}><line x1={n} x2={n} y2={SIZE}/><line y1={n} y2={n} x2={SIZE}/></g>)}</g>
      {pose && <g opacity=".32" stroke="#927846" strokeWidth="5" strokeLinecap="round" fill="none">{[[pose.A, pose.B], [pose.B, pose.C], [pose.C, pose.D], [pose.B, pose.point], [pose.C, pose.point]].map(([a, b], i) => <line key={i} x1={px(a).x} y1={px(a).y} x2={px(b).x} y2={px(b).y}/>)}</g>}
      {input.obstacles.map(o => <circle key={o.id} cx={px(o.center).x} cy={px(o.center).y} r={o.radiusCm * SCALE} fill="#ce795f" fillOpacity=".3" stroke="#b86a51" strokeWidth="2"/>)}
      {draft.length > 0 && <path d={path(input.stroke)} fill="none" stroke="#92a6ab" strokeWidth="1.5" opacity=".35" strokeDasharray="3 5"/>}
      <path d={path(desired, !draft.length || mode === "edit")} fill="none" stroke="#487f98" strokeWidth="3" strokeLinejoin="round" strokeLinecap="round"/>
      {draft.length > 0 && mode === "draw" && <><circle cx={px(draft[0]).x} cy={px(draft[0]).y} r={.45 * SCALE} fill="#539e7d" fillOpacity=".15" stroke="#519573" strokeWidth="1.5"/><circle cx={px(draft[0]).x} cy={px(draft[0]).y} r="4" fill="#33704f"/>{pending && <path d={path([draft.at(-1)!, draft[0]], false)} fill="none" stroke="#ba7d4f" strokeWidth="2" strokeDasharray="5 5"/>}</>}
      {mode === "edit" && desired.filter((_, i) => i % 4 === 0).map((p, j) => <circle key={j} cx={px(p).x} cy={px(p).y} r="7" fill="#f9faf4" stroke="#487f98" strokeWidth="2.5" className="stroke-handle" tabIndex={0} role="button" aria-label={`Drawing point ${j * 4 + 1}; arrow keys move 0.05 centimetres`} onPointerDown={e => beginEdit(e, j * 4)} onKeyDown={e => { const delta = { ArrowLeft: [-.05, 0], ArrowRight: [.05, 0], ArrowUp: [0, .05], ArrowDown: [0, -.05] }[e.key]; if (!delta) return; e.preventDefault(); const next = input.stroke.map(v => ({ ...v })); next[j * 4] = { x: Math.round((p.x + delta[0]) * 1000) / 1000, y: Math.round((p.y + delta[1]) * 1000) / 1000 }; onStroke(next); }}/>) }
      {[{ x: 0, y: 0 }, { x: input.fixedMounts.groundCm, y: 0 }].map((p, i) => <g key={i}><circle cx={px(p).x} cy={px(p).y} r="9" fill="#f5f4e9" stroke="#65735d" strokeWidth="2"/><circle cx={px(p).x} cy={px(p).y} r="3" fill="#65735d"/><text x={px(p).x} y={px(p).y + 27} textAnchor="middle" fill="#52624d" fontSize="12">{i ? "D" : "A"}</text></g>)}
      <g transform="translate(35,625)" stroke="#607256" strokeWidth="1.5"><path d="M0 -5V5M0 0H200M200 -5V5"/><text x="100" y="-9" stroke="none" fill="#607256" textAnchor="middle" fontSize="12">5 cm</text></g>
    </svg>
    <div className="board-instruction">{pending ? "Close the final segment?" : mode === "draw" ? "Draw a closed loop" : "Drag a blue point"}</div>
    {pending && <div className="board-actions"><button className="primary-button" onClick={() => accept(points.current, true)}><Check size={15}/>Close loop</button><button onClick={clear}><Undo2 size={15}/>Redraw</button></div>}
    {!pending && <button className="board-done" onClick={() => { clear(); onDone(); }}><X size={15}/>{mode === "edit" ? "Done" : "Cancel"}</button>}
  </div>;
}
