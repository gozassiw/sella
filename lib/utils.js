export function formatNaira(amount) {
  return "₦" + Number(amount || 0).toLocaleString("en-NG", { maximumFractionDigits: 0 });
}

export function slugify(text) {
  return String(text || "")
    .toLowerCase()
    .replace(/&/g, "and")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 40);
}

// Turns 0803 123 4567 into https://wa.me/2348031234567
export function whatsappLink(number, message) {
  let digits = String(number || "").replace(/\D/g, "");
  if (!digits) return "";
  if (digits.startsWith("0")) digits = "234" + digits.slice(1);
  else if (!digits.startsWith("234")) digits = "234" + digits;
  return `https://wa.me/${digits}${message ? `?text=${encodeURIComponent(message)}` : ""}`;
}

export function storeUrl(siteUrl, slug) {
  return `${siteUrl}/s/${slug}`;
}
