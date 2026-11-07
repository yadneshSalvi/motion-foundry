import { readShare } from "@/lib/share";
import { createAssemblySvg, createDesignPackage } from "@/lib/export";
import { ApiError, apiError } from "@/lib/server";
export const runtime="nodejs";
export async function GET(request:Request){try{const query=new URL(request.url).searchParams,token=query.get("token");if(!token)throw new ApiError("A design link is required.");const {input,candidate}=readShare(token),svg=query.get("format")==="svg",body=svg?createAssemblySvg(input,candidate):JSON.stringify(createDesignPackage(input,candidate,"Shared geometry, signature checked and independently reverified on download."),null,2);return new Response(body,{headers:{"Content-Type":svg?"image/svg+xml":"application/json","Content-Disposition":`attachment; filename="motion-foundry-r${input.revision}.${svg?"svg":"json"}"`,"Cache-Control":"no-store"}});}catch(error){return apiError(error);}}
