"use client";
import { evaluateMechanism, type Candidate, type DesignInput } from "@/domain";
import { degrees } from "@/lib/workshop";
export function MotionChart({ candidate, input, phase }: { candidate: Candidate; input: DesignInput; phase: number }) {
  const w=304,h=112,pad=18,ys=(v:number)=>h-pad-(v-40)/140*(h-pad*2),xs=(v:number)=>pad+v/(Math.PI*2)*(w-pad*2);
  const line=Array.from({length:121},(_,i)=>{const a=i/120*Math.PI*2,p=evaluateMechanism(candidate.parameters,a);return `${i?"L":"M"}${xs(a).toFixed(2)},${ys(degrees(p?.outputAngleRad??0)).toFixed(2)}`;}).join(" ");
  return <svg className="motion-chart" viewBox={`0 0 ${w} ${h}`} role="img" aria-label="Output angle over a cycle: solid green actual curve and hollow blue target markers.">
    {[60,100,140].map(v=><g key={v}><line x1={pad} x2={w-pad} y1={ys(v)} y2={ys(v)} stroke="#d9ded4" strokeDasharray="2 4"/><text x="2" y={ys(v)+3}>{v}°</text></g>)}
    <path d={line} fill="none" stroke="#557e67" strokeWidth="2"/>{input.targetPoses.map(t=><circle key={t.id} cx={xs((t.phaseRad%(Math.PI*2)+Math.PI*2)%(Math.PI*2))} cy={ys(degrees(t.outputAngleRad))} r="3.5" fill="#f5f4ed" stroke="#7ba9ba" strokeWidth="1.8"/>)}
    <line x1={xs(phase)} x2={xs(phase)} y1="8" y2={h-10} stroke="#b89a60"/><text x={pad} y={h-1}>0°</text><text x={w-pad-16} y={h-1}>360°</text>
  </svg>;
}
