import {IncrementalTraceTube} from "./WorkbenchTrace";

/** Uses only the installed public Lens API; invoke inside Lens, not in portable tests. */
export function createNativeTraceTube(radius=.22,sides=6,maxSegments=4096):{tube:IncrementalTraceTube;mesh:RenderMesh} {
  const builder=new MeshBuilder([{name:'position',components:3},{name:'normal',components:3},{name:'texture0',components:2}]);
  builder.topology=MeshTopology.Triangles;builder.indexType=MeshIndexType.UInt16;
  // A zero-area triangle is invisible but gives the native mesh a valid nonempty
  // backing store before getMesh(), and after every explicit trace reset.
  builder.appendVerticesInterleaved([0,0,0,0,0,1,0,0, 0,0,0,0,0,1,0,0, 0,0,0,0,0,1,0,0]);
  builder.appendIndices([0,1,2]);
  if(!builder.isValid())throw Error('Native trace seed mesh is invalid');
  builder.updateMesh();
  return {tube:new IncrementalTraceTube(builder,radius,sides,maxSegments),mesh:builder.getMesh()};
}
