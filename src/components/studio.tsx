"use client";
import { useState } from "react";
import { Workshop } from "./workshop";
import { LoopWorkshop } from "./loop-workshop";
import type { StudioMode } from "./studio-ui";
export function Studio() {
  const [mode, setMode] = useState<StudioMode>("loop");
  return mode === "loop" ? <LoopWorkshop onMode={setMode}/> : <Workshop onMode={setMode}/>;
}
