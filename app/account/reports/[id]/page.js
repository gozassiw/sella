import Link from "next/link";
import { notFound } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { getReportForUser } from "@/lib/report-server";
import { getReportReasonLabel } from "@/lib/report-safety";
export default async function BuyerReportPage({params}){
 const {user,supabase}=await getCurrentUser();if(!user)return null;
 const access=await getReportForUser(supabase,params.id,user);if(!access?.buyer)notFound();
 const {report}=access;
 const [{data:events,error},{data:evidence}]=await Promise.all([
  supabase.from("report_events").select("id,body,event_type,created_at,metadata").eq("report_id",report.id).in("visibility",["buyer","seller_buyer"]).order("created_at",{ascending:true}).limit(250),
  supabase.from("report_evidence").select("id,file_name,created_at").eq("report_id",report.id).order("created_at",{ascending:true}).limit(3),
 ]);
 return <div className="mx-auto max-w-3xl space-y-5"><Link href="/account/reports" className="text-sm font-bold text-kola">← Reports &amp; Safety</Link><section className="panel"><p className="eyebrow text-kola">{report.case_ref}</p><h1 className="display mt-2 text-2xl">{report.stores?.name||"Store report"}</h1><p className="mt-2 text-sm text-muted">{getReportReasonLabel(report.report_reason||report.reason)}</p><span className="mt-3 inline-block rounded-full bg-kola-light px-3 py-1 text-xs font-bold text-kola">{report.status}</span>{report.orders?.order_number&&<Link href={`/account/orders/${report.order_id}`} className="ml-3 text-xs font-bold text-kola underline">Order #{report.orders.order_number}</Link>}<p className="mt-4 whitespace-pre-wrap text-sm leading-6">{report.details}</p>{evidence?.length>0&&<div className="mt-4 border-t border-line pt-3"><p className="text-xs font-bold">Your attached evidence</p>{evidence.map(file=><p key={file.id} className="mt-1 break-all text-xs text-muted">{file.file_name} · privately attached</p>)}</div>}</section><section className="panel"><h2 className="font-bold">Case updates</h2>{error?<p className="mt-3 text-sm">Updates could not be loaded. Please refresh.</p>:<div className="mt-4 space-y-4">{events?.map(event=><div key={event.id} className="border-l-2 border-kola/20 pl-4"><p className="text-xs text-muted">{new Date(event.created_at).toLocaleString("en-NG")}</p><p className="mt-1 whitespace-pre-wrap text-sm leading-6">{event.body}</p>{event.metadata?.to&&<p className="mt-1 text-xs font-bold text-kola">{event.metadata.to}</p>}</div>)}</div>}</section><p className="text-xs leading-5 text-muted">A report is a request for review, not a finding of fraud. Sella will consider the information available. Refunds and recovery are not guaranteed.</p></div>;
}
