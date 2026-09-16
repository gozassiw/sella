import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { notifyPlatformAdmins } from "@/lib/notifications";
import { cleanReportText, isUuid } from "@/lib/report-safety";

export async function GET(_request, { params = {} } = {}) {
  const auth=createClient();const {data:{user}}=await auth.auth.getUser();
  if(!user)return NextResponse.json({error:"Seller access required."},{status:403});
  try{
    const {data:stores,error:storeError}=await auth.from("stores").select("id").eq("owner_id",user.id).limit(20);
    if(storeError)throw new Error("Seller cases could not be loaded.");
    if(!stores?.length)return NextResponse.json({reports:[]});
    const admin=createAdminClient();
    let query=admin.from("reports").select("id,case_ref,type,store_id,order_id,status,report_reason,created_at,updated_at,stores(name),orders(order_number,total)").in("store_id",stores.map(s=>s.id)).order("created_at",{ascending:false}).limit(100);
    if(params.id){if(!isUuid(params.id))return NextResponse.json({error:"Report not found."},{status:404});query=query.eq("id",params.id);}
    const {data:reports,error}=await query;if(error)throw new Error("Seller cases could not be loaded.");
    if(!reports?.length)return NextResponse.json(params.id?{error:"Report not found."}:{reports:[]},{status:params.id?404:200});
    const {data:requests,error:requestError}=await admin.from("report_events").select("report_id").in("report_id",reports.map(r=>r.id)).eq("event_type","seller_request").limit(1000);
    if(requestError)throw new Error("Seller case requests could not be loaded.");
    const requested=new Set((requests||[]).map(e=>e.report_id));const allowed=reports.filter(r=>requested.has(r.id));
    if(!params.id)return NextResponse.json({reports:allowed});
    if(!allowed.length)return NextResponse.json({error:"Report not found."},{status:404});
    const {data:events,error:eventError}=await admin.from("report_events").select("id,event_type,body,created_at").eq("report_id",params.id).in("visibility",["seller","seller_buyer"]).order("created_at",{ascending:true}).limit(250);
    if(eventError)throw new Error("Seller context could not be loaded.");
    return NextResponse.json({report:allowed[0],events:events||[]});
  }catch(error){return NextResponse.json({error:error.message},{status:400});}
}
export async function POST(request,{params={}}={}){
  const auth=createClient();const {data:{user}}=await auth.auth.getUser();
  if(!user||!isUuid(params.id))return NextResponse.json({error:"Seller access required."},{status:403});
  const body=await request.json().catch(()=>({}));const response=cleanReportText(body.body);
  if(!response)return NextResponse.json({error:"Write a response before sending."},{status:400});
  const {data,error}=await auth.rpc("report_seller_response",{p_report_id:params.id,p_body:response});
  if(error)return NextResponse.json({error:error.message || "Seller response failed."},{status:400});
  try{await notifyPlatformAdmins({type:"report",title:"Seller response received",body:"A seller has responded to a safety case awaiting review.",link:"/admin?section=reports"});}catch{}
  return NextResponse.json(data||{success:true});
}
