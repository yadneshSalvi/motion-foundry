import {afterEach,describe,expect,it,vi} from "vitest";
import {deflateRawSync} from "node:zlib";
import {POST as solve} from "../src/app/api/solve/route";
import {POST as exportDesign} from "../src/app/api/exports/route";
import {POST as share} from "../src/app/api/shares/route";
import {POST as intent} from "../src/app/api/intent/route";
import {GET as download} from "../src/app/api/download/route";
import {makeDefaultInput,makeContradictoryInput,buildInputHash,verifyCandidate} from "../src/domain";
import {acceptsResponse,bundledRecord,revise} from "../src/lib/workshop";
import {createAssemblySvg} from "../src/lib/export";
import {readJson,signReceipt,verifyReceipt} from "../src/lib/server";
import {createShare,readShare} from "../src/lib/share";
const request=(path:string,body:unknown)=>new Request(`http://localhost:3101${path}`,{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify(body)});
afterEach(()=>vi.unstubAllEnvs());
describe("API and immutable exports",()=>{
 it("exports the selected alternative and recovers a shared design without process storage",async()=>{
  const input=makeDefaultInput();input.revision=7;const response=await solve(request("/api/solve",input));expect(response.status).toBe(200);const result=await response.json();expect(result.cached).toBe(false);expect(result.candidates.length).toBeGreaterThan(1);
  const selected=result.candidates[1],exported=await exportDesign(request("/api/exports",{receipt:result.receipt,candidateId:selected.id}));expect(exported.status).toBe(200);const manifest=await exported.json();expect(manifest.selectedCandidateId).toBe(selected.id);expect(manifest.mechanism).toEqual(selected.parameters);expect(manifest.input.revision).toBe(7);expect(manifest.units.length).toBe("centimetres");
  const shared=await share(request("/api/shares",{receipt:result.receipt,candidateId:selected.id}));expect(shared.status).toBe(200);const link=await shared.json();expect(link.qr.data).toHaveLength(link.qr.size**2);const token=new URL(link.url).pathname.split("/").at(-1)!;expect(readShare(token).candidate.parameters).toEqual(selected.parameters);const file=await download(new Request(`http://localhost:3101/api/download?token=${token}`));expect(file.status).toBe(200);expect((await file.json()).selectedCandidateId).toBe(selected.id);
 });
 it("rejects tampered receipts, unrelated candidates, and wrong token purpose",async()=>{
  const result=await(await solve(request("/api/solve",makeDefaultInput()))).json(),[body,sig]=result.receipt.split("."),bad=`${body}.${sig[0]==="a"?"b":"a"}${sig.slice(1)}`;
  expect((await exportDesign(request("/api/exports",{receipt:bad,candidateId:result.candidates[0].id}))).status).toBe(403);expect((await exportDesign(request("/api/exports",{receipt:result.receipt,candidateId:"unrelated"}))).status).toBe(400);
  const e=bundledRecord(),token=createShare(e.input,e.result.candidates[0]);expect((await exportDesign(request("/api/exports",{receipt:token,candidateId:e.selectedId}))).status).toBe(400);
 });
 it("returns client errors for null, malformed JSON, unsupported units and large input",async()=>{
  for(const route of [solve,exportDesign,share,intent])expect((await route(request("/api/test",null))).status).toBe(400);
  expect((await solve(request("/api/solve",{...makeDefaultInput(),units:"inches"}))).status).toBe(400);expect((await solve(new Request("http://localhost/api/solve",{method:"POST",headers:{"Content-Type":"application/json"},body:"{oops"}))).status).toBe(400);expect((await solve(request("/api/solve",{padding:"a".repeat(30000)}))).status).toBe(413);
  await expect(readJson(new Request("http://localhost",{method:"POST",body:"{}"}))).rejects.toMatchObject({status:415});
 });
 it("never signs an infeasible request as successful",async()=>{const result=await(await solve(request("/api/solve",makeContradictoryInput()))).json();expect(result.status).toBe("infeasible");expect(result.reason).toMatch(/same phase/);expect(result.receipt).toBeUndefined();});
 it("requires a nonpublic production key and rejects old signatures after rotation",()=>{
  vi.stubEnv("MOTION_SIGNING_SECRET","");vi.stubEnv("NODE_ENV","production");expect(()=>signReceipt({example:true})).toThrow("not configured");vi.stubEnv("MOTION_SIGNING_SECRET","test-only-key-for-signing-unit-tests-aaaaaaaa");const token=signReceipt({example:true});expect(verifyReceipt(token)).toEqual({example:true});vi.stubEnv("MOTION_SIGNING_SECRET","test-only-key-for-signing-unit-tests-bbbbbbbb");expect(()=>verifyReceipt(token)).toThrow("signature");
 });
 it("bounds decompression and verifies locally supplied shares",async()=>{
  const bomb=signReceipt({format:"motion-foundry/share@1",packed:deflateRawSync("x".repeat(30000)).toString("base64url")});expect(()=>readShare(bomb)).toThrow("Invalid design package");const r=bundledRecord();expect((await share(request("/api/shares",{input:r.input,candidate:r.result.candidates[0]}))).status).toBe(200);r.result.candidates[0].parameters.crankCm=100;expect((await share(request("/api/shares",{input:r.input,candidate:r.result.candidates[0]}))).status).toBe(400);
  const large=bundledRecord();let state=51;const unicodeId=()=>Array.from({length:100},()=>{state=(Math.imul(state,1664525)+1013904223)>>>0;return String.fromCharCode(1024+state%47000);}).join("");
  large.input.targetPoses=Array.from({length:16},(_,i)=>({...large.input.targetPoses[i%5],id:unicodeId()}));large.input.obstacles=Array.from({length:24},()=>({id:unicodeId(),center:{x:50,y:50},radiusCm:.1}));
  expect(verifyCandidate(large.input,large.result.candidates[0].parameters).valid).toBe(true);expect((await share(request("/api/shares",{input:large.input,candidate:large.result.candidates[0]}))).status).toBe(413);
 });
});
describe("revision and drawing edge cases",()=>{
 it("ignores late responses after edits, cancellation and same-input retries",()=>{const r=bundledRecord(),expected={input:r.input,generation:1};expect(acceptsResponse(expected,{input:r.input,generation:1},r.result)).toBe(true);expect(acceptsResponse(expected,{input:r.input,generation:2},r.result)).toBe(false);const edit=revise(r.input,d=>{d.fixedMounts.groundCm=9;});expect(acceptsResponse(expected,{input:edit,generation:1},r.result)).toBe(false);expect(buildInputHash(edit)).not.toBe(buildInputHash(r.input));});
 it("auto-fits accepted large dimensions and refuses invalid SVG export",()=>{const r=bundledRecord(),input=r.input,candidate=r.result.candidates[0],factor=500;input.fixedMounts.groundCm*=factor;input.linkRadiusCm*=factor;input.clearanceCm*=factor;input.linkDepthCm!*=factor;for(const k of ["crank","coupler","rocker"] as const)input.lengthBounds[k]=input.lengthBounds[k].map(v=>v*factor) as [number,number];for(const k of ["crank","coupler","rocker","ground"] as const)input.linkLayers![k]*=factor;for(const k of ["crankCm","couplerCm","rockerCm","groundCm"] as const)candidate.parameters[k]*=factor;expect(verifyCandidate(input,candidate.parameters).valid).toBe(true);const svg=createAssemblySvg(input,candidate);for(const m of svg.matchAll(/<circle cx="([\d.]+)" cy="([\d.]+)"/g)){expect(Number(m[1])).toBeGreaterThan(50);expect(Number(m[1])).toBeLessThan(600);expect(Number(m[2])).toBeGreaterThan(150);expect(Number(m[2])).toBeLessThan(350);}candidate.parameters.crankCm=0;expect(()=>createAssemblySvg(input,candidate)).toThrow("does not pass");});
});
