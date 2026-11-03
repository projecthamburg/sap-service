// Keep all map controls and dialogs inside the fullscreen document.
export function bindMapFullscreen(
  button,
  { language = "en", onInfo = () => {} } = {}
) {
  if (!button) return () => {};
  const w = (a, b) => (language === "fr" ? b : a);
  let active = false,
    native = false,
    disposed = false,
    operation = 0;
  const capable =
    !!document.fullscreenEnabled &&
    typeof document.documentElement.requestFullscreen === "function";
  const exit = document.createElement("button");
  exit.type = "button";
  exit.className = "map-focus-exit";
  exit.hidden = true;
  exit.innerHTML =
    '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 9h5V4m6 0v5h5M4 15h5v5m6 0v-5h5"/></svg>';
  document.body.append(exit);
  button.hidden = false;
  button.textContent = capable
    ? w("Full screen", "Plein écran")
    : w("Expand map", "Agrandir la carte");
  const update = () => {
    document.body.classList.toggle("map-focus", active);
    document.body.dataset.mapDisplay = active
      ? native
        ? "fullscreen"
        : "expanded"
      : "normal";
    button.setAttribute("aria-pressed", String(active));
    exit.hidden = !active;
    exit.title = native
      ? w("Exit full screen", "Quitter le plein écran")
      : w("Exit expanded map", "Réduire la carte");
    exit.setAttribute("aria-label", exit.title);
    requestAnimationFrame(() =>
      window.dispatchEvent(new Event("sap-map-layout"))
    );
  };
  const leave = async () => {
    operation++;
    active = false;
    if (document.fullscreenElement)
      try {
        await document.exitFullscreen();
      } catch {}
    native = false;
    update();
    if (button.isConnected && !disposed) button.focus({ preventScroll: true });
  };
  button.onclick = async () => {
    if (active) {
      await leave();
      return;
    }
    const ticket = ++operation;
    active = true;
    native = false;
    update();
    if (capable)
      try {
        await document.documentElement.requestFullscreen({
          navigationUI: "hide",
        });
        if (disposed || ticket !== operation || !active) {
          if (document.fullscreenElement) await document.exitFullscreen();
          return;
        }
        native = !!document.fullscreenElement;
      } catch {}
    if (disposed) return;
    update();
    if (!native)
      onInfo(
        w(
          "Map expanded. Install the app to hide browser controls.",
          "Carte agrandie. Installez l’app pour masquer les commandes du navigateur."
        )
      );
    exit.focus({ preventScroll: true });
  };
  exit.onclick = leave;
  const change = () => {
    if (native && !document.fullscreenElement) {
      active = false;
      native = false;
      update();
    }
  };
  const key = (e) => {
    if (e.key === "Escape" && active && !document.querySelector("dialog[open]"))
      leave();
  };
  document.addEventListener("fullscreenchange", change);
  document.addEventListener("keydown", key);
  update();
  return () => {
    if (disposed) return;
    disposed = true;
    operation++;
    document.removeEventListener("fullscreenchange", change);
    document.removeEventListener("keydown", key);
    button.onclick = null;
    button.hidden = true;
    exit.remove();
    active = false;
    native = false;
    document.body.classList.remove("map-focus");
    delete document.body.dataset.mapDisplay;
    if (document.fullscreenElement) document.exitFullscreen().catch(() => {});
  };
}
