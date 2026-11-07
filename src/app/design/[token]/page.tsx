import { readShare } from "@/lib/share";
import { maxError } from "@/lib/workshop";
import { createAssemblySvg } from "@/lib/export";
export const dynamic="force-dynamic";
export default async function DesignPage({params}:{params:Promise<{token:string}>}){
  const {token}=await params;
  try{const {input,candidate}=readShare(token),href=`/api/download?token=${encodeURIComponent(token)}`;
    const drawing=`data:image/svg+xml;charset=utf-8,${encodeURIComponent(createAssemblySvg(input,candidate))}`;
    return <main className="error-page" style={{maxWidth:1000,margin:"auto"}}><a className="eyebrow" href="/">MOTION FOUNDRY / SHARED DESIGN</a><h1>Shared design</h1><p>Revision {input.revision} · {candidate.label} · centimetres and radians</p><p>{candidate.verification.sampleCount} sampled poses, {maxError(candidate).toFixed(3)}° maximum target error. The signature and geometric checks were revalidated for this page.</p><figure className="shared-assembly"><img src={drawing} width={1000} height={680} alt={`Assembly drawing of ${candidate.label}, revision ${input.revision}. Four linked pivots, the output trajectory, link dimensions, and verification results.`}/><figcaption>The selected mechanism at 60° input phase. Download the SVG to inspect the drawing at full size.</figcaption></figure><div className="shared-downloads"><a className="primary-button" href={href}>Download design JSON</a><a className="primary-button" href={`${href}&format=svg`}>Download assembly SVG</a></div><p>One four-bar cell. Clearance is sampled; decorative petals, axle bridges, loads and fabrication are excluded.</p><p>Design links have no scheduled expiry. They remain usable while the service and its signing key are maintained.</p><a className="text-link" href="/">Open the workshop →</a></main>;
  }catch{return <main className="error-page"><p className="eyebrow">MOTION FOUNDRY</p><h1>This design link is unavailable.</h1><p>The link may be incomplete or its signing key may have changed. Export the design again from the workshop.</p><a className="primary-button" href="/">Open workshop</a></main>;}
}
