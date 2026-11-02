/** Remembers the browser's install prompt so the More tab can offer "Install app". */
interface BeforeInstallPromptEvent extends Event { prompt: () => Promise<void>; userChoice: Promise<{ outcome: "accepted" | "dismissed" }> }
let deferred: BeforeInstallPromptEvent | null = null;
const listeners = new Set<() => void>();

export function captureInstallPrompt() {
  window.addEventListener("beforeinstallprompt", (e) => { e.preventDefault(); deferred = e as BeforeInstallPromptEvent; listeners.forEach((l) => l()); });
  window.addEventListener("appinstalled", () => { deferred = null; listeners.forEach((l) => l()); });
}
export const isStandalone = () => window.matchMedia?.("(display-mode: standalone)").matches || (navigator as Navigator & { standalone?: boolean }).standalone === true;
export const isIOS = () => /iphone|ipad|ipod/i.test(navigator.userAgent);
export const canInstall = () => !!deferred;
export async function install() { if (!deferred) return false; await deferred.prompt(); const r = await deferred.userChoice; deferred = null; listeners.forEach((l) => l()); return r.outcome === "accepted"; }
export function onInstallChange(fn: () => void) { listeners.add(fn); return () => { listeners.delete(fn); }; }
