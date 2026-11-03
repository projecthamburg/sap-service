export function setupAppLayout(root, w) {
  const q = (s) => root.querySelector(s),
    panel = q(".map-panel"),
    overlay = document.createElement("div");
  overlay.className = "map-app-search";
  const search = q(".map-search");
  overlay.append(search);
  const filter = document.createElement("button");
  filter.className = "map-app-icon";
  filter.type = "button";
  filter.setAttribute("aria-label", w("Filters", "Filtres"));
  filter.innerHTML =
    '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 6h16M7 12h10m-7 6h4"/></svg>';
  filter.onclick = () => {
    const p = q("[data-filter-panel]");
    p.open = !p.open;
    filter.setAttribute("aria-expanded", String(p.open));
  };
  overlay.append(filter);
  const settings = document.createElement("button");
  settings.className = "map-app-icon";
  settings.type = "button";
  settings.setAttribute("aria-label", w("Map options", "Options de carte"));
  settings.textContent = "⋮";
  settings.onclick = () => q("[data-settings]").click();
  overlay.append(settings);
  panel.append(overlay);
  const chips = q(".quick-filters");
  chips.classList.add("map-app-chips");
  panel.append(chips);
  const controls = document.createElement("div");
  controls.className = "map-app-controls";
  const locate = q("[data-my-location]");
  locate.classList.add("map-location-fab");
  locate.setAttribute(
    "aria-label",
    w("Show my current location", "Afficher ma position")
  );
  locate.innerHTML =
    '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 2v3m0 14v3M2 12h3m14 0h3"/><circle cx="12" cy="12" r="7"/><circle cx="12" cy="12" r="2"/></svg>';
  controls.append(locate);
  const layers = document.createElement("button");
  layers.type = "button";
  layers.className = "map-layer-fab";
  layers.dataset.layers = "";
  layers.setAttribute(
    "aria-label",
    w("Change map layers", "Changer les couches de carte")
  );
  layers.innerHTML =
    '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="m12 3 9 5-9 5-9-5 9-5Zm-9 9 9 5 9-5M3 16l9 5 9-5"/></svg>';
  controls.append(layers);
  panel.append(controls);
  const nearby = document.createElement("div");
  nearby.className = "map-app-nearby";
  nearby.append(q("[data-gps]"));
  const radius = q("[data-radius]").closest("label");
  nearby.append(radius);
  nearby.append(q("[data-stop]"));
  nearby.append(q("[data-radar-status]"));
  panel.append(nearby);
  const aside = q(".lead-sidebar"),
    toggle = document.createElement("button");
  toggle.type = "button";
  toggle.className = "site-sheet-toggle";
  toggle.dataset.sheetToggle = "";
  toggle.setAttribute("aria-expanded", "false");
  toggle.innerHTML = `<span class="sheet-grip"></span><strong>${w("Nearby & saved sites", "Sites à proximité et enregistrés")}</strong><span data-sheet-count></span>`;
  toggle.onclick = () => {
    const open = aside.classList.toggle("sheet-expanded");
    toggle.setAttribute("aria-expanded", String(open));
  };
  aside.prepend(toggle);
  const importButton = document.createElement("button");
  importButton.className = "text-link map-app-import";
  importButton.textContent = w("Import / export", "Importer / exporter");
  importButton.onclick = () => q("[data-import]").click();
  panel.append(importButton);
}
