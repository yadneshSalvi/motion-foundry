import QRCode from "qrcode";
import { buildInputHash, type SolveResult } from "@/domain";
import { checkedDesign, createShare } from "@/lib/share";
import { ApiError, apiError, rateLimit, readJson, verifyReceipt } from "@/lib/server";
export const runtime="nodejs";
export async function POST(request:Request){try{
  rateLimit(request,"solve",24);const body=await readJson(request,90000) as {receipt?:string;candidateId?:string;input?:unknown;candidate?:unknown};
  if(!body||typeof body!=="object"||Array.isArray(body))throw new ApiError("A selected design is required.");let rawInput=body.input,rawCandidate=body.candidate;
  if(body.receipt!==undefined){if(typeof body.receipt!=="string"||typeof body.candidateId!=="string")throw new ApiError("Invalid receipt or selected candidate.");const payload=verifyReceipt(body.receipt) as {format?:string;input:unknown;result:SolveResult};if(payload?.format!=="motion-foundry/receipt@1.0")throw new ApiError("A solve receipt is required.");rawInput=payload.input;rawCandidate=payload.result?.candidates?.find(c=>c.id===body.candidateId);}
  const {input,candidate}=checkedDesign(rawInput,rawCandidate),token=createShare(input,candidate),origin=process.env.BACKEND_BASE_URL||new URL(request.url).origin;
  const url=`${origin.replace(/\/$/,"")}/design/${token}`,qr=url.length<2800?QRCode.create(url,{errorCorrectionLevel:"L"}):null;
  return Response.json({url,code:buildInputHash(input).slice(-8),revision:input.revision,qr:qr?{size:qr.modules.size,data:Array.from(qr.modules.data)}:null,lifetime:"No scheduled expiry. Available while this service and its signing key are maintained."},{headers:{"Cache-Control":"no-store"}});
}catch(error){return apiError(error);}}
