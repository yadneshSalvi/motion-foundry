import { deflateRawSync, inflateRawSync } from "node:zlib";
import { z } from "zod";
import { parseInput, verifyCandidate, type Candidate, type DesignInput } from "@/domain";
import { ApiError, signReceipt, verifyReceipt } from "./server";
const parametersSchema=z.object({groundCm:z.number().positive().max(10000),crankCm:z.number().positive().max(10000),couplerCm:z.number().positive().max(10000),rockerCm:z.number().positive().max(10000),branch:z.union([z.literal(1),z.literal(-1)])}).strict();
export function checkedDesign(rawInput:unknown,rawCandidate:unknown):{input:DesignInput;candidate:Candidate}{
  let input:DesignInput;try{input=parseInput(rawInput);}catch{throw new ApiError("Invalid design inputs.");}
  const c=rawCandidate as Candidate;if(!c||typeof c.id!=="string"||c.id.length>150)throw new ApiError("Invalid candidate.");
  const parsed=parametersSchema.safeParse(c.parameters);if(!parsed.success)throw new ApiError("Invalid mechanism dimensions.");
  const verification=verifyCandidate(input,parsed.data);if(!verification.valid)throw new ApiError("The selected mechanism does not pass this revision.");
  return{input,candidate:{id:c.id,family:"four-bar",parameters:parsed.data,verification,score:0,label:typeof c.label==="string"?c.label.slice(0,100):"Shared petal study"}};
}
export function createShare(input:DesignInput,candidate:Candidate){
  const payload=JSON.stringify({input,candidate:{id:candidate.id,label:candidate.label,parameters:candidate.parameters}});
  if(Buffer.byteLength(payload,"utf8")>24000)throw new ApiError("This design is too large for a share link. Download its JSON package instead.",413);
  const token=signReceipt({format:"motion-foundry/share@1",packed:deflateRawSync(payload,{level:9}).toString("base64url")});
  if(token.length>12000)throw new ApiError("This design is too large for a share link. Download its JSON package instead.",413);
  return token;
}
export function readShare(token:string){
  if(token.length>12000)throw new ApiError("The design link is too large.");const value=verifyReceipt(token) as {format?:string;packed?:string};
  if(value?.format!=="motion-foundry/share@1"||typeof value.packed!=="string")throw new ApiError("Invalid design link.");
  let data;try{data=JSON.parse(inflateRawSync(Buffer.from(value.packed,"base64url"),{maxOutputLength:24000}).toString("utf8"));}catch{throw new ApiError("Invalid design package.");}return checkedDesign(data.input,data.candidate);
}
