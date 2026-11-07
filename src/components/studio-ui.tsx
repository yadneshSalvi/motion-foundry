"use client";
import { useEffect, useRef } from "react";
import { Flower2, Spline, X } from "lucide-react";
export type StudioMode = "loop" | "petal";
export function ModeTabs({ mode, onMode }: { mode: StudioMode; onMode: (mode: StudioMode) => void }) {
  return <div className="mode-tabs" role="tablist" aria-label="Mechanism mode"><button role="tab" aria-selected={mode === "loop"} onClick={() => onMode("loop")}><Spline size={15}/>Loop</button><button role="tab" aria-selected={mode === "petal"} onClick={() => onMode("petal")}><Flower2 size={15}/>Petal</button></div>;
}
export function QrGraphic({ qr }: { qr: { size: number; data: number[] } }) {
  const path = qr.data.flatMap((v, i) => v ? [`M${i % qr.size + 4} ${Math.floor(i / qr.size) + 4}h1v1h-1z`] : []).join(" ");
  return <svg viewBox={`0 0 ${qr.size + 8} ${qr.size + 8}`} role="img" aria-label="QR code for this verified loop design" shapeRendering="crispEdges"><rect width="100%" height="100%" fill="white"/><path d={path} fill="#172b1c"/></svg>;
}
export function StudioModal({ title, onClose, children }: { title: string; onClose: () => void; children: React.ReactNode }) {
  const box = useRef<HTMLElement>(null), close = useRef(onClose); useEffect(() => { close.current = onClose; }, [onClose]);
  useEffect(() => { const before = document.activeElement as HTMLElement | null, overflow = document.body.style.overflow; document.body.style.overflow = "hidden"; const list = () => Array.from(box.current?.querySelectorAll<HTMLElement>('button:not(:disabled),a[href],input,textarea,[tabindex="0"]') ?? []); list()[0]?.focus(); const key = (e: KeyboardEvent) => { if (e.key === "Escape") close.current(); if (e.key !== "Tab") return; const items = list(), first = items[0], last = items.at(-1); if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last?.focus(); } else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first?.focus(); } }; window.addEventListener("keydown", key); return () => { window.removeEventListener("keydown", key); document.body.style.overflow = overflow; before?.focus(); }; }, []);
  return <div className="modal-backdrop" onMouseDown={e => { if (e.target === e.currentTarget) onClose(); }}><section ref={box} className="modal" role="dialog" aria-modal="true" aria-labelledby="studio-modal-title"><button className="modal-close icon-button" onClick={onClose} aria-label="Close dialog"><X size={20}/></button><h2 id="studio-modal-title">{title}</h2>{children}</section></div>;
}
