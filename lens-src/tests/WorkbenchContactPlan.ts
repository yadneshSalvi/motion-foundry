/** Test-input planning for the declared circular mug and a full-turn crank.
 * This returns only a real gesture destination. It never changes product state,
 * supplies solver output, or relaxes a verification threshold. */
export function planCrankContactPlacement(crankCm:number,linkRadiusCm:number,
  center:{x:number;y:number},mugRadiusCm:number){
  const distance=Math.hypot(center.x,center.y);
  if(![crankCm,linkRadiusCm,center.x,center.y,mugRadiusCm,distance].every(Number.isFinite)||
    Math.min(crankCm,linkRadiusCm,mugRadiusCm,distance)<=0)throw Error("Finite positive crank/mug dimensions required");
  const physicalGapCm=distance-crankCm-linkRadiusCm-mugRadiusCm;
  // Four tenths of a millimetre is actual overlap, not the clearance buffer.
  // Bound the manual placement correction; an unsuitable case must fail.
  const inwardCm=Math.max(0,Math.ceil((physicalGapCm+.04)*100)/100);
  if(inwardCm>.2)throw Error("This actual mechanism needs a different visible mug placement, outside the bounded contact gesture");
  const round=(v:number)=>Math.round(v*1000)/1000;
  return{center:{x:round(center.x*(distance-inwardCm)/distance),y:round(center.y*(distance-inwardCm)/distance)},
    inwardCm,initialPhysicalGapCm:physicalGapCm,requestedOverlapCm:.04};
}
