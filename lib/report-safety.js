export const REPORT_REASONS = Object.freeze([
  { value: "order_not_received", label: "Order not received" },
  { value: "suspected_fraud", label: "Suspected fraud" },
  { value: "product_not_as_described", label: "Product significantly different from its description" },
  { value: "counterfeit_or_prohibited", label: "Counterfeit or prohibited products" },
  { value: "refund_problem", label: "Refund problems" },
  { value: "other_concern", label: "Other concerns" },
]);

export const REPORT_REASON_VALUES = new Set(REPORT_REASONS.map((item) => item.value));
export const REPORT_STATUSES = Object.freeze(["Submitted", "Under Review", "Awaiting Seller Response", "Resolved", "Closed"]);
export const REPORT_STATUS_VALUES = new Set(REPORT_STATUSES);
export const EVIDENCE_MAX_BYTES = 2 * 1024 * 1024;
export const EVIDENCE_MAX_FILES = 3;
export const EVIDENCE_MIME_TYPES = new Set(["image/jpeg", "image/png", "image/webp", "image/gif", "application/pdf"]);

const LEGACY_REASON_MAP = new Map([
  ["suspicious or scam behaviour", "suspected_fraud"],
  ["suspected fraud", "suspected_fraud"],
  ["fake products", "counterfeit_or_prohibited"],
  ["counterfeit or prohibited products", "counterfeit_or_prohibited"],
  ["wrong or misleading information", "product_not_as_described"],
  ["product significantly different from its description", "product_not_as_described"],
  ["not responding", "other_concern"],
  ["other", "other_concern"],
]);

export function normalizeReportReason(input) {
  const value = String(input || "").trim();
  if (REPORT_REASON_VALUES.has(value)) return value;
  return LEGACY_REASON_MAP.get(value.toLowerCase()) || null;
}

export function normalizeReportStatus(input) {
  const value = String(input || "").trim();
  return REPORT_STATUS_VALUES.has(value) ? value : null;
}

export function cleanReportText(input, max = 5000) {
  return String(input || "").replace(/\u0000/g, "").trim().slice(0, max);
}

export function isUuid(value) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{12}$/i.test(String(value || ""));
}

export function getReportReasonLabel(value) {
  return REPORT_REASONS.find((item) => item.value === value)?.label || value;
}

export function getEvidenceExtension(file) {
  const original = String(file?.name || "").toLowerCase();
  const extension = original.includes(".") ? original.slice(original.lastIndexOf(".")) : "";
  const allowed = new Set([".jpg", ".jpeg", ".png", ".webp", ".gif", ".pdf"]);
  return allowed.has(extension) ? extension : ".bin";
}

export function validateEvidenceFile(file) {
  if (!file || typeof file.size !== "number") return "Evidence file is invalid.";
  if (!EVIDENCE_MIME_TYPES.has(String(file.type || "").toLowerCase())) return "Evidence must be a JPG, PNG, WEBP, GIF, or PDF.";
  if (file.size <= 0 || file.size > EVIDENCE_MAX_BYTES) return "Each evidence file must be between 1 byte and 2 MB.";
  return null;
}

export function reportPublicShape(report) {
  return {
    id: report.id,
    case_ref: report.case_ref,
    type: report.type,
    reason: report.report_reason || report.reason,
    details: report.details,
    status: report.status,
    store: report.store || report.stores || null,
    order: report.order || report.orders || null,
    created_at: report.created_at,
    updated_at: report.updated_at,
  };
}

export function isBuyerVisibleEvent(event) {
  return event?.visibility === "buyer" || event?.visibility === "seller_buyer";
}

export function isSellerVisibleEvent(event) {
  return event?.visibility === "seller" || event?.visibility === "seller_buyer";
}

export function isAdminVisibleEvent() {
  return true;
}

export function isAllowedEvidenceMime(mime) {
  return EVIDENCE_MIME_TYPES.has(String(mime || "").toLowerCase());
}

export function safeEvidenceFilename(name) {
  return String(name || "evidence").replace(/[^a-zA-Z0-9._-]/g, "_").slice(0, 120) || "evidence";
}

export function statusUpdateText(status, caseRef) {
  return `Your report ${caseRef || "case"} is now ${status}. You can review the latest update in Reports & Safety.`;
}
