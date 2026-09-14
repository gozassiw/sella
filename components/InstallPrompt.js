"use client";

import { Download, Share, X } from "lucide-react";
import { useEffect, useState } from "react";

const ANDROID_DISMISSED = "sella-install-prompt-android-dismissed";
const IOS_SEEN = "sella-install-prompt-ios-seen";

function readStorage(key) {
  try { return window.localStorage.getItem(key) === "1"; } catch { return false; }
}

function writeStorage(key) {
  try { window.localStorage.setItem(key, "1"); } catch {}
}

function isStandalone() {
  return window.matchMedia?.("(display-mode: standalone)")?.matches || window.navigator.standalone === true;
}

function detectDevice() {
  const ua = window.navigator.userAgent || "";
  const isAppleMobile = /iPhone|iPad|iPod/i.test(ua) || (window.navigator.platform === "MacIntel" && window.navigator.maxTouchPoints > 1);
  const isAndroid = /Android/i.test(ua);
  const isInAppBrowser = /FBAN|FBAV|Instagram|WhatsApp|Line\/|Snapchat/i.test(ua);
  const isIosChromeOrOther = /CriOS|FxiOS|EdgiOS|OPiOS/i.test(ua);
  const isIosSafari = isAppleMobile && !isInAppBrowser && !isIosChromeOrOther && /Safari/i.test(ua);

  if (isAndroid) return "android";
  if (isAppleMobile && isInAppBrowser) return "ios-in-app";
  if (isAppleMobile && !isIosSafari) return "ios-other";
  if (isIosSafari) return "ios-safari";
  return "other";
}

export default function InstallPrompt() {
  const [platform, setPlatform] = useState("other");
  const [deferredPrompt, setDeferredPrompt] = useState(null);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (isStandalone()) return;

    const detectedPlatform = detectDevice();
    setPlatform(detectedPlatform);

    if (detectedPlatform === "ios-safari" || detectedPlatform === "ios-in-app" || detectedPlatform === "ios-other") {
      if (!readStorage(IOS_SEEN)) {
        writeStorage(IOS_SEEN);
        setVisible(true);
      }
      return;
    }

    function handleBeforeInstallPrompt(event) {
      event.preventDefault();
      if (!readStorage(ANDROID_DISMISSED)) {
        setDeferredPrompt(event);
        setVisible(true);
      }
    }

    function handleAppInstalled() {
      setDeferredPrompt(null);
      setVisible(false);
    }

    window.addEventListener("beforeinstallprompt", handleBeforeInstallPrompt);
    window.addEventListener("appinstalled", handleAppInstalled);
    return () => {
      window.removeEventListener("beforeinstallprompt", handleBeforeInstallPrompt);
      window.removeEventListener("appinstalled", handleAppInstalled);
    };
  }, []);

  function dismiss() {
    if (platform === "android") writeStorage(ANDROID_DISMISSED);
    setVisible(false);
  }

  async function installAndroid() {
    if (!deferredPrompt) return;
    deferredPrompt.prompt();
    const result = await deferredPrompt.userChoice.catch(() => ({ outcome: "dismissed" }));
    setDeferredPrompt(null);
    if (result.outcome === "accepted") writeStorage(ANDROID_DISMISSED);
    else writeStorage(ANDROID_DISMISSED);
    setVisible(false);
  }

  if (!visible) return null;

  const isAndroidPrompt = platform === "android" && deferredPrompt;
  const isSafari = platform === "ios-safari";
  const title = isAndroidPrompt ? "Install Sella" : isSafari ? "Install Sella on iPhone" : "Open Sella in Safari";
  const message = isAndroidPrompt
    ? "Install Sella for faster access from your phone."
    : isSafari
      ? "Tap the Share icon, then 'Add to Home Screen.'"
      : "To install Sella, tap the ••• menu and choose 'Open in Safari,' then follow the install steps from there.";

  return (
    <aside className="fixed inset-x-4 bottom-4 z-[70] mx-auto max-w-lg rounded-2xl border border-line bg-white p-4 shadow-[var(--shadow-float)]" role="status" aria-live="polite">
      <div className="flex items-start gap-3">
        <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-kola-light text-kola">
          {isAndroidPrompt ? <Download size={19} /> : isSafari ? <Share size={19} /> : <Download size={19} />}
        </span>
        <div className="min-w-0 flex-1">
          <div className="flex items-start justify-between gap-3">
            <p className="text-sm font-extrabold text-ink">{title}</p>
            <button type="button" onClick={dismiss} className="-mr-1 -mt-1 rounded-lg p-1 text-muted hover:bg-surface hover:text-ink" aria-label="Dismiss install message"><X size={17} /></button>
          </div>
          <p className="mt-1 text-xs leading-5 text-muted">{message}</p>
          {isAndroidPrompt && <button type="button" onClick={installAndroid} className="btn-primary mt-3 min-h-10 px-4 py-2 text-xs">Install Sella</button>}
        </div>
      </div>
    </aside>
  );
}
