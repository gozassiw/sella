"use client";
import ReportButton from "@/components/ReportButton";

export default function ReportForm({ storeId, productId = null, orderId = null, type = "order", triggerLabel = "Report" }) {
  return <ReportButton storeId={storeId} productId={productId} orderId={orderId} type={type} triggerLabel={triggerLabel} />;
}
