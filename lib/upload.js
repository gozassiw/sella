import { createClient } from "@/lib/supabase/client";

const MAX_BYTES = 5 * 1024 * 1024;

function safeName(file) {
  return file.name.replace(/[^a-zA-Z0-9.]/g, "").slice(-40) || "upload";
}

export async function uploadImage(file, userId, folder) {
  if (!file.type.startsWith("image/")) throw new Error(`${file.name} isn't a photo.`);
  if (file.size > MAX_BYTES) throw new Error(`${file.name} is bigger than 5 MB. Choose a smaller photo.`);
  const supabase = createClient();
  const path = `${userId}/${folder}/${crypto.randomUUID()}-${safeName(file)}`;
  const { error } = await supabase.storage.from("store-media").upload(path, file, { cacheControl: "31536000" });
  if (error) throw new Error("A photo didn't upload. Check your connection and try again.");
  return supabase.storage.from("store-media").getPublicUrl(path).data.publicUrl;
}

export async function uploadDocument(file, userId, folder) {
  const allowed = file.type === "application/pdf" || file.type.startsWith("image/");
  if (!allowed) throw new Error("Upload a PDF or image file.");
  if (file.size > MAX_BYTES) throw new Error(`${file.name} is bigger than 5 MB. Choose a smaller file.`);
  const supabase = createClient();
  const path = `${userId}/${folder}/${crypto.randomUUID()}-${safeName(file)}`;
  const { error } = await supabase.storage.from("store-media").upload(path, file, { cacheControl: "31536000", contentType: file.type });
  if (error) throw new Error("The document didn't upload. Check your connection and try again.");
  return supabase.storage.from("store-media").getPublicUrl(path).data.publicUrl;
}
