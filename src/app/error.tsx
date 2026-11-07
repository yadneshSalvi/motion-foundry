"use client";
export default function ErrorPage({ reset }: { reset: () => void }) { return <main className="error-page"><p className="eyebrow">MOTION FOUNDRY</p><h1>The workshop needs a moment.</h1><p>Your saved design stays in this browser. Reload the view to continue.</p><button className="primary-button" onClick={reset}>Reopen workshop</button></main>; }
