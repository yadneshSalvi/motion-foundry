/** A cyclic starting-point choice for a genuinely closed, ordered test gesture.
 * Every point and edge is retained exactly; this never invents, reverses, scales
 * or interpolates the input outline. The caller explicitly repeats point zero. */
export function visibleClosedPath<T>(closed:T[],project:(point:T)=>{x:number;y:number}){
  if(closed.length<4||closed[0]!==closed[closed.length-1])throw Error("Explicitly close the ordered gesture before choosing its start");
  const points=closed.slice(0,-1),screen=points.map(project);
  if(screen.some(p=>!Number.isFinite(p.x)||!Number.isFinite(p.y)))throw Error("Drawing projection must be finite");
  let startIndex=0;
  for(let i=1;i<screen.length;i++)if(screen[i].y>screen[startIndex].y+1e-6||
    (Math.abs(screen[i].y-screen[startIndex].y)<=1e-6&&screen[i].x<screen[startIndex].x))startIndex=i;
  const rotated=[...points.slice(startIndex),...points.slice(0,startIndex)];
  return{points:[...rotated,rotated[0]],startIndex};
}
