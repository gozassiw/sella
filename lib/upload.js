import { createClient } from "@/lib/supabase/client";

const MAX_BYTES = 5 * 1024 * 1024;

// Uploads one photo into the seller's own folder and returns its public link.
export async function uploadImage(file, userId, folder) {
  if (!file.type.startsWith("image/")) throw new Error(`${file.name} isn't a photo.`);
  if (file.size > MAX_BYTES) throw new Error(`${file.name} is bigger than 5 MB. Choose a smaller photo.`);
  const supabase = createClient();
  const safeName = file.name.replace(/[^a-zA-Z0-9.]/g, "").slice(-40) || "photo.jpg";
  const path = `${userId}/${folder}/${crypto.randomUUID()}-${safeName}`;
  const { error } = await supabase.storage.from("store-media").upload(path, file, { cacheControl: "31536000" });
  if (error) throw new Error("A photo didn't upload. Check your connection and try again.");
  return supabase.storage.from("store-media").getPublicUrl(path).data.publicUrl;
}
