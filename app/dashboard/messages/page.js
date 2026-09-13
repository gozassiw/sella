import { getCurrentUser } from "@/lib/auth";
import ChatInbox from "@/components/ChatInbox";

export default async function SellerMessagesPage({ searchParams }) {
  const { supabase, user } = await getCurrentUser();
  const { data: threads } = await supabase.from("chat_conversations").select("id,store_id,buyer_id,created_at,last_message_at,stores(id,name,slug,logo_url,owner_id)").order("last_message_at", { ascending: false }).limit(100);
  const initialThreads = await Promise.all((threads || []).map(async (thread) => {
    const { data: participantName } = await supabase.rpc("get_chat_participant_name", { p_conversation_id: thread.id });
    return { ...thread, participant_name: participantName || "Sella user" };
  }));
  return <ChatInbox initialThreads={initialThreads} userId={user.id} role="seller" startStoreId={searchParams?.store || null} startBuyerId={searchParams?.buyer || null} />;
}
