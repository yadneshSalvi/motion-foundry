import { readLoopShare } from "@/lib/loop-share";
import { createLoopSvg } from "@/lib/loop-export";
export const dynamic = "force-dynamic";
export default async function LoopDesignPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  try {
    const { input, candidate } = readLoopShare(token), report = candidate.verification;
    const href = `/api/loops/download?token=${encodeURIComponent(token)}`;
    const drawing = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(createLoopSvg(input, candidate))}`;
    return <main className="error-page" style={{ maxWidth: 1000, margin: "auto" }}><a className="text-link" href="/">Motion Foundry</a><h1>Loop design</h1><p>Revision {input.revision} · fixed {input.fixedMounts.groundCm} cm mounts</p><figure className="shared-assembly"><img src={drawing} width={1000} height={740} alt={`Four-bar coupler assembly, revision ${input.revision}, with its desired drawing, actual trace, dimensions and sampled checks.`}/></figure><p>Maximum ordered error {report.maxFitErrorCm.toFixed(4)} cm / {input.tolerances.fitCm} cm tolerance. Signature, exact input hash and {report.sampleCount} sampled poses revalidated on this page.</p><div className="shared-downloads"><a className="primary-button" href={href}>Download design JSON</a><a className="primary-button" href={`${href}&format=svg`}>Download assembly SVG</a></div><p>The crank traces the drawing through linkage geometry. Fit and clearance are sampled. Pen hardware, inter-layer axles, loads and fabrication are excluded.</p><p>No scheduled expiry; available while this service and its signing key are maintained.</p><a className="text-link" href="/">Open workshop →</a></main>;
  } catch {
    return <main className="error-page"><h1>This design link is unavailable.</h1><p>The link may be incomplete or its signing key may have changed. Create another link from the workshop.</p><a className="primary-button" href="/">Open workshop</a></main>;
  }
}
