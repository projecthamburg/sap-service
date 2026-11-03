if (!window.sapMapsPwaReady) {
  window.sapMapsPwaReady = true;
  window.addEventListener("beforeinstallprompt", (event) => {
    event.preventDefault();
    window.sapMapsInstallPrompt = event;
    window.dispatchEvent(new Event("sap-install-ready"));
  });
}
export const isMapsApp = () =>
  new URLSearchParams(location.search).get("workspace") === "maps" ||
  matchMedia("(display-mode: standalone)").matches;
export async function prepareMapsApp() {
  const demo = new URLSearchParams(location.search).get("demo") === "1" || document.body.classList.contains("demo-session");
  const manifest = document.querySelector('link[rel="manifest"]'), href = demo ? "./manifest-demo.webmanifest" : "./manifest.webmanifest";
  if (manifest && manifest.getAttribute("href") !== href) {
    window.sapMapsInstallPrompt = null;
    manifest.setAttribute("href", href);
  }
  if (isMapsApp())
    document
      .querySelector('meta[name="viewport"]')
      ?.setAttribute(
        "content",
        "width=device-width, initial-scale=1, viewport-fit=cover"
      );
  if ("serviceWorker" in navigator && isSecureContext)
    try {
      await navigator.serviceWorker.register("./sw.js", { scope: "./" });
    } catch {}
}
export async function installMapsApp() {
  await prepareMapsApp();
  if (window.sapMapsInstallPrompt) {
    await window.sapMapsInstallPrompt.prompt();
    await window.sapMapsInstallPrompt.userChoice;
    window.sapMapsInstallPrompt = null;
    return true;
  }
  return false;
}
export function launchMapsApp(language = "en") {
  const url = new URL("./", location.href);
  url.searchParams.set("workspace", "maps");
  if (new URLSearchParams(location.search).get("demo") === "1" || document.body.classList.contains("demo-session")) url.searchParams.set("demo", "1");
  url.hash = `/${language}/admin/maps`;
  const app = window.open(
    url.href,
    "sap-service-maps",
    "popup,width=1200,height=900"
  );
  if (app)
    try {
      app.opener = null;
    } catch {}
  return !!app;
}
