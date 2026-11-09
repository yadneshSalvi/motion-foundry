/** Read the actual saved scene. An old cleanup receipt is never a release gate. */
import {readFileSync, readdirSync, existsSync} from "node:fs";
import {join, relative, resolve} from "node:path";
import {fileURLToPath} from "node:url";
import {createHash} from "node:crypto";
import {execFileSync} from "node:child_process";

const root=fileURLToPath(new URL("..",import.meta.url));
const sha=value=>createHash("sha256").update(value).digest("hex");
const primary=text=>text.match(/^  PrimaryAsset: !<reference> ([\da-f-]{36})$/m)?.[1];

export function inspectSceneText(text, {testScriptIds, productScriptId}) {
  const entities=[...text.matchAll(/^- !<([^/>]+)\/([\da-f-]{36})>\n([\s\S]*?)(?=^- !<|$(?![\s\S]))/gm)];
  const failures=[];let productBindings=0;
  if(!entities.length)failures.push("Saved scene format could not be inspected");
  for(const [,type,id,body] of entities){
    const name=body.match(/^  Name: (.+)$/m)?.[1]??"";
    const script=body.match(/^  ScriptAsset: !<reference> ([\da-f-]{36})$/m)?.[1];
    if(script===productScriptId)productBindings++;
    if(script&&testScriptIds.has(script))failures.push(`Test script remains bound: ${name||id}`);
    if(/LEAF Plugin Bridge|MessagingBridge|LeafIndex|FilmCaptureIndex|Round[234]\b|Round[234](?:Frame|Hint|Placement|Scenario)|AiPreviewAgentInspect|Provided keep-out cylinder/i.test(name))
      failures.push(`Testing or obsolete scene entity remains: ${type} ${name}`);
  }
  if(productBindings!==1)failures.push(`Expected one MotionFoundry product binding; found ${productBindings}`);
  return {entities:entities.length,productBindings,failures};
}

function files(folder){
  if(!existsSync(folder))return [];
  return readdirSync(folder,{withFileTypes:true}).flatMap(entry=>entry.isDirectory()?files(join(folder,entry.name)):[join(folder,entry.name)]);
}

export function inspectShippingScene(projectRoot=root){
  const scene=join(projectRoot,"lens/Assets/Scene.scene"),bytes=readFileSync(scene);
  const testScriptIds=new Set();
  for(const file of files(join(projectRoot,"lens/Assets/Scripts/Tests")).filter(p=>p.endsWith(".ts.meta"))){
    const id=primary(readFileSync(file,"utf8"));if(id)testScriptIds.add(id);
  }
  // Resolve the installed bridge UUID from its archive metadata, not a guessed
  // stable UUID or the editable component name in the scene.
  const leaf=join(projectRoot,"lens/Packages/Leaf.lspkg");
  const packageMeta=readFileSync(leaf+".meta","utf8");
  const remaps=new Map([...packageMeta.matchAll(/^    ([\da-f-]{36}): !<reference> ([\da-f-]{36})$/gm)].map(m=>[m[1],m[2]]));
  const members=execFileSync("unzip",["-Z1",leaf],{encoding:"utf8"}).split("\n");
  const bridgeMetas=members.filter(name=>/(?:^|\/)MessagingBridge\.(?:ts|js)\.meta$/.test(name));
  if(!bridgeMetas.length)throw Error("Installed LEAF bridge metadata was not found; cannot certify scene hygiene");
  for(const member of bridgeMetas){
    const id=primary(execFileSync("unzip",["-p",leaf,member],{encoding:"utf8"}));
    if(!id)throw Error("Installed LEAF bridge asset ID could not be read");
    testScriptIds.add(id);
    if(remaps.has(id))testScriptIds.add(remaps.get(id));
  }
  const productScriptId=primary(readFileSync(join(projectRoot,"lens/Assets/Scripts/MotionFoundry.ts.meta"),"utf8"));
  if(!productScriptId)throw Error("Product asset ID is missing");
  const result=inspectSceneText(bytes.toString("utf8"),{testScriptIds,productScriptId});
  const temporary=files(join(projectRoot,"lens/Assets/Scripts")).filter(path=>
    !path.includes("/Tests/")&&/\/(?:Round[234]|AiPreviewAgentInspect)/.test(path));
  result.failures.push(...temporary.map(path=>"Temporary native asset remains: "+relative(projectRoot,path)));
  return {schema:"motion-foundry/shipping-scene-check@1",status:result.failures.length?"blocked":"pass",
    scene:"lens/Assets/Scene.scene",scene_sha256:sha(bytes),leaf_package_sha256:sha(readFileSync(leaf)),leaf_metadata_sha256:sha(packageMeta),
    testAssetIdsResolved:testScriptIds.size,...result,
    scope:"Actual saved scene and installed asset IDs inspected. Native save/reopen, compile and startup remain separate checks."};
}

if(process.argv[1]&&resolve(process.argv[1])===fileURLToPath(import.meta.url)){
  try{const result=inspectShippingScene();console.log(JSON.stringify(result,null,2));process.exitCode=result.status==="pass"?0:1;}
  catch(error){console.error(JSON.stringify({status:"blocked",reason:error.message}));process.exitCode=1;}
}
