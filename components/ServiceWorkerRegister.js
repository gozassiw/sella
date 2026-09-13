"use client";
import { useEffect } from "react";

export default function ServiceWorkerRegister() {
  useEffect(() => {
    if ("serviceWorker" in navigator) navigator.serviceWorker.register("/sw.js?v=android-push-2", { updateViaCache: "none" }).then((registration) => registration.update()).catch(() => {});
  }, []);
  return null;
}
