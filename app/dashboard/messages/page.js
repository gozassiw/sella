import { getCurrentUser } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";
import ChatInbox from "@/components/ChatInbox";

export default async function SellerMessagesPage({ searchParams }) {
  const { supabase, user } = await getCurrentUser();
  const { data: threads } = await supabase.from("chat_conversations").select("id,store_id,buyer_id,created_at,last_message_at,stores(id,name,slug,logo_url,owner_id)").order("last_message_at", { ascending: false }).limit(100);
  let profiles = [];
  try {
    const ids = [...new Set((threads || []).map((thread) => thread.buyer_id).filter(Boolean))];
    if (ids.length) {
      const admin = createAdminClient();
      const { data } = await admin.from("buyer_profiles").select("user_id,full_name").in("user_id", ids);
      profiles = data || [];
    }
  } catch {}
  const names = new Map(profiles.map((profile) => [profile.user_id, profile.full_name?.trim()]));
  const initialThreads = (threads || []).map((thread) => ({ ...thread, participant_name: names.get(thread.buyer_id) || "Buyer" }));
  return <ChatInbox initialThreads={initialThreads} userId={user.id} role="seller" />;
}
