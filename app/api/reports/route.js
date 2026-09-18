import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { safeAdminClient, validateBuyerTarget, validateReportTarget, notifyReportCreated } from "@/lib/report-server";
import { EVIDENCE_MAX_FILES, safeEvidenceFilename, validateEvidenceFile } from "@/lib/report-safety";

const MAX_TOTAL_BYTES = 3 * 1024 * 1024;
function matchesFileType(bytes, type) {
  if (type === "application/pdf") return bytes.subarray(0,5).toString() === "%PDF-";
  if (type === "image/png") return bytes.subarray(0,8).equals(Buffer.from([137,80,78,71,13,10,26,10]));
  if (type === "image/jpeg") return bytes[0]===255 && bytes[1]===216 && bytes[2]===255;
  if (type === "image/webp") return bytes.subarray(0,4).toString()==="RIFF" && bytes.subarray(8,12).toString()==="WEBP";
  if (type === "image/gif") return ["GIF87a","GIF89a"].includes(bytes.subarray(0,6).toString());
  return false;
}
export async function GET() {
  const supabase = createClient(); const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Please log in." }, { status: 401 });
  const { data, error } = await supabase.from("reports").select("id,case_ref,type,store_id,order_id,reason,report_reason,details,status,created_at,updated_at,stores(id,name,slug),orders(id,order_number,total)").or(`buyer_id.eq.${user.id},reported_by.eq.${user.id}`).neq("type", "message").order("created_at", { ascending: false }).limit(100);
  if (error) return NextResponse.json({ error: "Reports could not be loaded." }, { status: 400 });
  return NextResponse.json({ reports: data || [] });
}
export async function POST(request) {
  const supabase = createClient(); const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Please log in." }, { status: 401 });
  if (Number(request.headers.get("content-length")) > MAX_TOTAL_BYTES + 65536) return NextResponse.json({error:"Keep combined evidence below 3 MB."},{status:413});
  try {
    let body,files=[];
    if ((request.headers.get("content-type") || "").includes("multipart/form-data")) {
      const form=await request.formData();
      body=Object.fromEntries(["storeId","productId","orderId","type","reason","reportReason","details"].map(key=>[key,form.get(key)]));
      files=form.getAll("evidence").filter(file=>file instanceof File && file.size>0);
    } else body=await request.json();
    const input=validateReportTarget(body);
    if(input.error) return NextResponse.json({error:input.error},{status:400});
    if(files.length>EVIDENCE_MAX_FILES || files.reduce((sum,file)=>sum+file.size,0)>MAX_TOTAL_BYTES) return NextResponse.json({error:"Upload up to 3 images/PDFs, 2 MB per file and 3 MB combined."},{status:400});
    const prepared=[];
    for(const file of files){
      const error=validateEvidenceFile(file); if(error) return NextResponse.json({error},{status:400});
      const bytes=Buffer.from(await file.arrayBuffer());
      if(!matchesFileType(bytes,file.type)) return NextResponse.json({error:"An evidence file does not match its declared image/PDF format."},{status:400});
      prepared.push({file,bytes});
    }
    const target=await validateBuyerTarget(supabase,user,input);
    if(target.error) return NextResponse.json({error:target.error},{status:403});
    const admin=await safeAdminClient();
    const {count,error:countError}=await admin.from("reports").select("id",{head:true,count:"exact"}).eq("reported_by",user.id).gte("created_at",new Date(Date.now()-60*60*1000).toISOString());
    if(countError) throw new Error("Reports are temporarily unavailable.");
    if(count>=10) return NextResponse.json({error:"You have submitted several reports recently. Please try again later."},{status:429});
    const {data:report,error}=await admin.from("reports").insert({type:input.type,store_id:target.storeId,product_id:input.productId,order_id:input.orderId,reported_by:user.id,buyer_id:user.id,reason:input.reason,report_reason:input.reason,details:input.details,status:"Submitted"}).select("id,case_ref,type,status").single();
    if(error) throw new Error("The report could not be submitted.");
    let missingEvidence=0;const evidence=[];
    for(const {file,bytes} of prepared){
      const name=safeEvidenceFilename(file.name);const storagePath=`${user.id}/${report.id}/${crypto.randomUUID()}-${name}`;
      const {error:uploadError}=await admin.storage.from("report-evidence").upload(storagePath,bytes,{contentType:file.type,cacheControl:"0",upsert:false});
      if(uploadError){missingEvidence++;continue;}
      const {data:row,error:attachError}=await admin.from("report_evidence").insert({report_id:report.id,uploaded_by:user.id,storage_path:storagePath,file_name:name,mime_type:file.type,byte_size:file.size}).select("id,file_name").single();
      if(attachError){await admin.storage.from("report-evidence").remove([storagePath]);missingEvidence++;}else evidence.push(row);
    }
    await notifyReportCreated({report,store:target.store,buyerId:user.id});
    return NextResponse.json({report,evidence,warning:missingEvidence?"Your case was saved, but some evidence could not be attached. Keep the originals and quote your case reference when contacting Sella.":null});
  }catch(error){ console.error("Report submission failed",error?.message);return NextResponse.json({error:error.message || "Unable to submit report."},{status:400}); }
}
