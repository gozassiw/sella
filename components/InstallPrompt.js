"use client";

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
  const isIosChrome = /CriOS/i.test(ua);
  const isIosOtherBrowser = /FxiOS|EdgiOS|OPiOS/i.test(ua);
  const isIosSafari = isAppleMobile && !isInAppBrowser && !isIosChrome && !isIosOtherBrowser && /Safari/i.test(ua);

  if (isAndroid) return "android";
  if (isAppleMobile && isInAppBrowser) return "ios-in-app";
  if (isAppleMobile && isIosChrome) return "ios-chrome";
  if (isAppleMobile && (isIosOtherBrowser || !isIosSafari)) return "ios-other";
  if (isIosSafari) return "ios-safari";
  return "other";
}

function CloseIcon() {
  return <svg aria-hidden="true" viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2"><path strokeLinecap="round" d="m6 6 12 12M18 6 6 18" /></svg>;
}

function ShareIcon() {
  return <svg aria-hidden="true" viewBox="0 0 24 24" className="h-6 w-6" fill="none" stroke="currentColor" strokeWidth="1.8"><path strokeLinecap="round" strokeLinejoin="round" d="M12 16V3m0 0L7.5 7.5M12 3l4.5 4.5M5 12v7a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-7" /></svg>;
}

function InstallIcon() {
  return <svg aria-hidden="true" viewBox="0 0 24 24" className="h-6 w-6" fill="none" stroke="currentColor" strokeWidth="1.8"><path strokeLinecap="round" strokeLinejoin="round" d="M12 3v12m0 0 4-4m-4 4-4-4M5 21h14a2 2 0 0 0 2-2v-3M3 16v3a2 2 0 0 0 2 2" /></svg>;
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

    if (detectedPlatform !== "android" || readStorage(ANDROID_DISMISSED)) return;
    const fallbackTimer = window.setTimeout(() => setVisible(true), 1500);

    function handleBeforeInstallPrompt(event) {
      event.preventDefault();
      window.clearTimeout(fallbackTimer);
      setDeferredPrompt(event);
      setVisible(true);
    }

    function handleAppInstalled() {
      writeStorage(ANDROID_DISMISSED);
      setDeferredPrompt(null);
      setVisible(false);
    }

    window.addEventListener("beforeinstallprompt", handleBeforeInstallPrompt);
    window.addEventListener("appinstalled", handleAppInstalled);
    return () => {
      window.clearTimeout(fallbackTimer);
      window.removeEventListener("beforeinstallprompt", handleBeforeInstallPrompt);
      window.removeEventListener("appinstalled", handleAppInstalled);
    };
  }, []);

  function dismiss() {
    if (platform === "android") writeStorage(ANDROID_DISMISSED);
    setVisible(false);
  }

  async function installAndroid() {
    if (!deferredPrompt) return dismiss();
    deferredPrompt.prompt();
    const result = await deferredPrompt.userChoice.catch(() => ({ outcome: "dismissed" }));
    setDeferredPrompt(null);
    writeStorage(ANDROID_DISMISSED);
    setVisible(false);
    return result;
  }

  if (!visible) return null;

  const isAndroid = platform === "android";
  const isNativeAndroidPrompt = isAndroid && Boolean(deferredPrompt);
  const isIosChrome = platform === "ios-chrome";
  const isSafari = platform === "ios-safari";
  const isIosOther = platform === "ios-in-app" || platform === "ios-other";
  const title = isNativeAndroidPrompt ? "Install Sella" : isAndroid ? "Install Sella on Android Device As An App" : isIosChrome || isSafari ? "Install Sella on iPhone As An App" : "Open Sella in Safari";
  const message = isNativeAndroidPrompt
    ? "Install Sella for faster access from your phone."
    : isAndroid
      ? "Tap the Share button, scroll down and choose Install and create shortcut or Add to Home screen, then wait 1 minute; it will be installed automatically."
      : isIosChrome || isSafari
        ? "Tap the Share icon, tap View More, then click 'Add to Home Screen.'"
      : isIosOther
        ? "To install Sella, open this page in Safari. Then tap the Share icon, tap View More, then 'Add to Home Screen.'"
        : "";

  return (
    <div className="fixed inset-0 z-[70] grid place-items-center bg-ink/35 px-5 py-6" role="presentation">
      <aside className="w-full max-w-sm rounded-[26px] border border-line bg-white p-6 shadow-[var(--shadow-float)]" role="dialog" aria-modal="true" aria-labelledby="sella-install-title">
        <div className="flex items-start justify-between gap-4">
          <span className="grid h-12 w-12 shrink-0 place-items-center rounded-2xl bg-kola-light text-kola">{isNativeAndroidPrompt ? <InstallIcon /> : <ShareIcon />}</span>
          <button type="button" onClick={dismiss} className="rounded-xl p-2 text-muted hover:bg-surface hover:text-ink" aria-label="Dismiss install instructions"><CloseIcon /></button>
        </div>
        <h2 id="sella-install-title" className="display mt-5 text-xl">{title}</h2>
        <p className="mt-3 text-sm leading-6 text-muted">{message}</p>
        {isNativeAndroidPrompt && <button type="button" onClick={installAndroid} className="btn-primary mt-5 w-full">Install Sella</button>}
        {!isNativeAndroidPrompt && <button type="button" onClick={dismiss} className="btn-secondary mt-5 w-full">Got it</button>}
      </aside>
    </div>
  );
}
