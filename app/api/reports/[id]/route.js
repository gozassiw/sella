import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getReportForUser, safeAdminClient } from "@/lib/report-server";

export async function GET(_request, { params }) {
  const auth = createClient();
  const { data: { user } } = await auth.auth.getUser();
  if (!user) return NextResponse.json({ error: "Please log in." }, { status: 401 });
  // Include platform-admin authorization here; the old call omitted this flag,
  // so an admin could list cases but could not open the case detail/evidence.
  const access = await getReportForUser(auth, params.id, user, { includeAdmin: true });
  if (!access) return NextResponse.json({ error: "Report not found." }, { status: 404 });
  const visibility = access.admin ? ["admin", "buyer", "seller", "seller_buyer"] : access.buyer ? ["buyer", "seller_buyer"] : ["seller", "seller_buyer"];
  const [{ data: events, error: eventError }, { data: evidence, error: evidenceError }] = await Promise.all([
    auth.from("report_events").select("id,visibility,event_type,body,metadata,created_at").eq("report_id", params.id).in("visibility", visibility).order("created_at", { ascending: true }),
    auth.from("report_evidence").select("id,file_name,mime_type,byte_size,storage_path,created_at").eq("report_id", params.id).order("created_at", { ascending: true }),
  ]);
  if (eventError || evidenceError) return NextResponse.json({ error: "Report detail could not be loaded." }, { status: 400 });
  let safeEvidence = evidence || [];
  if (access.admin && safeEvidence.length) {
    try {
      const admin = await safeAdminClient();
      safeEvidence = await Promise.all(safeEvidence.map(async (file) => {
        const { data } = await admin.storage.from("report-evidence").createSignedUrl(file.storage_path, 300);
        return { ...file, signed_url: data?.signedUrl || null };
      }));
    } catch (error) {
      console.error("Report evidence signing failed", error);
      safeEvidence = safeEvidence.map((file) => ({ ...file, signed_url: null }));
    }
  } else {
    // Never expose the private bucket path to buyers or sellers.
    safeEvidence = safeEvidence.map(({ storage_path: _storagePath, ...file }) => file);
  }
  return NextResponse.json({ report: access.report, events: events || [], evidence: safeEvidence });
}
