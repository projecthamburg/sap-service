import { bindMapFullscreen } from "./fullscreen.js";
import { setupAppLayout } from "./app-layout.js";
import {
  siteTitle,
  readable,
  companyLabel,
  stageLabel,
  priorityLabel,
} from "./presentation.js";
import { isMapsApp } from "../src/pwa.js";
import { fieldLead, drivingURL, sitePinSVG, VISIT_LABELS } from "./field.js";
import { reviewedLocation, locationForMap } from "./location.js";
import { mapShell, dossierHTML } from "./views.js";
import { escapeHTML as esc } from "../src/utils.js";
import {
  TIERS,
  COLORS,
  contractorName,
  contractorKey,
  quickMatch,
  point,
  distance,
  bearing,
  approaching,
  filterLeads,
  deadlineLabel,
  csv,
  parseCSV,
  importErrors,
} from "./model.js";
import { googleMaps } from "./google.js";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
export function mountMaps(root, { request, language, readOnly = false }) {
  const fr = language === "fr",
    w = (a, b) => (fr ? b : a);
  let researchRecords = [],
    fieldSites = [],
    activity = {},
    pendingCentre = false,
    gpsGeneration = 0,
    notificationsOn = false,
    followingLocation = false,
    wakeLock = null;
  let records = [],
    version = null,
    disposed = false,
    map,
    engine = "google",
    markers = [],
    selected = null,
    highlight = "",
    watch = null,
    position = null,
    anchor = null,
    radarOn = false,
    audio = null,
    street = null,
    mapGeneration = 0,
    radarShape = null,
    beacon = null,
    quick = "",
    insideOnly = false,
    previousPosition = null,
    lastAlertAt = 0,
    activeAlertId = null,
    alertTimer,
    dialogSequence = 0;
  const alerted = new Set(),
    reviews = new Map();
  let prefs;
  try {
    prefs = JSON.parse(localStorage.getItem("sap-map-preferences") || "{}");
  } catch {
    prefs = {};
  }
  let analyst = prefs.recordView === "research",
    visibleTiers = [...TIERS],
    radius = [804.672, 1609.344, 3218.688, 8046.72, 16093.44].includes(
      Number(prefs.radius)
    )
      ? Number(prefs.radius)
      : 3218.688;
  let markerStyle = ["building", "hardhat", "crane"].includes(prefs.markerStyle)
    ? prefs.markerStyle
    : "building";
  root.innerHTML = mapShell(w, visibleTiers);
  const q = (s) => root.querySelector(s),
    status = q(".map-status"),
    canvas = q(".map-canvas");
  q("[data-radius]").value = String(radius);
  let disposeAppLayout = () => {};
  if (isMapsApp()) {
    disposeAppLayout = setupAppLayout(root, w);
    q("[data-filter-panel]").open = false;
    q(".map-layout").dataset.layout = "map";
    root
      .querySelectorAll("button[data-layout]")
      .forEach((b) =>
        b.setAttribute("aria-pressed", String(b.dataset.layout === "map"))
      );
  }
  if (readOnly) {
    q("[data-search]").placeholder = w("Demo: search sites", "Démo : chercher un site");
    for (const b of root.querySelectorAll("[data-import], .map-app-import")) {
      b.disabled = true;
      b.title = w("Read-only demo", "Démo en lecture seule");
    }
  }
  function message(s) {
    if (!disposed) status.textContent = s;
  }
  function locationIssue(text) {
    message(text);
    if (!isMapsApp()) return;
    q("[data-radar-status]").textContent = w(
      "Location unavailable",
      "Position indisponible"
    );
    dialog(
      w("Location access", "Accès à la position"),
      `<p>${esc(text)}</p><button class="button primary" data-location-help-close>${w("Got it", "Compris")}</button>`,
      (d) => {
        d.querySelector("[data-location-help-close]").onclick = () => d.close();
      }
    );
  }
  const disposeFullscreen = isMapsApp()
    ? bindMapFullscreen(
        root.closest(".admin-portal")?.querySelector("[data-map-fullscreen]"),
        { language, onInfo: message }
      )
    : () => {};
  const resizeMap = () => {
    if (!map || disposed) return;
    if (engine === "google") window.google?.maps.event.trigger(map, "resize");
    else map.invalidateSize();
  };
  window.addEventListener("sap-map-layout", resizeMap);
  const mapSizeObserver = new ResizeObserver(resizeMap);
  mapSizeObserver.observe(canvas);
  function rebuildRecords() {
    records = [...researchRecords, ...fieldSites.map(fieldLead)];
  }
  const visitState = (id) => activity[id]?.status || "open";
  function drive(r) {
    return drivingURL(coordinates(r), position);
  }
  q("[data-layers]")?.addEventListener("click", () => {
    if (engine === "google" && map) {
      const satellite = map.getMapTypeId() !== "satellite";
      map.setMapTypeId(satellite ? "satellite" : "roadmap");
      q("[data-layers]").setAttribute("aria-pressed", String(satellite));
    } else
      message(
        w(
          "Satellite layers are available on Google Maps.",
          "Les couches satellite sont disponibles dans Google Maps."
        )
      );
  });
  function filtered() {
    return filterLeads(records, {
      search: q("[data-search]").value,
      tiers: visibleTiers,
      gc: q("[data-gc]").value,
      stage: q("[data-stage]").value,
    }).filter(
      (r) =>
        quickMatch(r, quick) &&
        (!q("[data-visit-filter]").value ||
          visitState(r.lead_id) === q("[data-visit-filter]").value) &&
        (!insideOnly ||
          ((position || anchor) &&
            coordinates(r) &&
            distance(position || anchor, coordinates(r)) <= radius))
    );
  }
  function populate() {
    for (const [selector, key] of [
      ["[data-gc]", "general_contractor"],
      ["[data-stage]", "project_stage"],
    ]) {
      const select = q(selector),
        value = select.value;
      select.innerHTML =
        select.options[0].outerHTML +
        [
          ...new Set(
            records
              .map((r) =>
                key === "general_contractor" ? contractorName(r[key]) : r[key]
              )
              .filter(Boolean)
          ),
        ]
          .sort()
          .map(
            (v) =>
              `<option value="${esc(key === "general_contractor" ? contractorKey(v) : v)}">${esc(v)}</option>`
          )
          .join("");
      select.value = value;
    }
  }
  function refresh() {
    if (disposed) return;
    const sheetCount = q("[data-sheet-count]");
    if (sheetCount)
      sheetCount.textContent = `${records.length} ${w("sites · tap to view", "sites · toucher pour voir")}`;
    const rows = filtered();
    if (
      activeAlertId &&
      (!rows.some((r) => r.lead_id === activeAlertId) ||
        visitState(activeAlertId) === "visited")
    )
      hideAlert();
    root
      .querySelectorAll("[data-count]")
      .forEach(
        (b) =>
          (b.textContent = records.filter(
            (r) => r.priority === b.dataset.count
          ).length)
      );
    q(".lead-results").textContent =
      `${rows.length} ${w("sites", "sites")}${rows.length !== records.length ? ` / ${records.length}` : ""}${rows.some((r) => !point(r)) ? ` · ${rows.filter((r) => !point(r)).length} ${w("location needed", "à localiser")}` : ""}`;
    q(".lead-list").innerHTML =
      rows
        .map(
          (r) =>
            `<button class="lead-row ${selected === r.lead_id ? "selected" : ""}" data-lead="${esc(r.lead_id)}" style="--tier:${COLORS[r.priority]}"><span class="lead-row-meta">${esc(priorityLabel(r.priority, w))}<strong>${w(...VISIT_LABELS[visitState(r.lead_id)])}</strong></span><span class="lead-row-title">${esc(siteTitle(r.project_name))}</span><span>${esc(companyLabel(r, w))} · ${esc(readable(r.city))}</span><small>${esc(stageLabel(r.location_audit?.status || r.project_stage, w))}<span data-distance>${position && coordinates(r) ? ` · ${(distance(position, coordinates(r)) / 1609.344).toFixed(1)} mi` : ""}</span></small></button>`
        )
        .join("") ||
      `<p class="map-empty">${w("No matching leads. Change your filters.", "Aucune piste. Modifiez vos filtres.")}</p>`;
    q(".lead-list")
      .querySelectorAll("[data-lead]")
      .forEach((b) => (b.onclick = () => openLead(b.dataset.lead)));
    const deadlines = rows
      .filter(
        (r) =>
          r.general_contractor.toLowerCase().includes("frecon") &&
          /published.*tender close/i.test(r.deadline_type || "") &&
          Number.isFinite(+new Date(r.deadline))
      )
      .sort((a, b) => +new Date(a.deadline) - +new Date(b.deadline));
    const upcoming = deadlines.find((r) => +new Date(r.deadline) > Date.now());
    const deadlineNote = q(".map-deadline-note");
    deadlineNote.hidden = quick !== "frecon";
    deadlineNote.textContent = upcoming
      ? `${w("Next published tender close", "Prochaine fermeture publiée")} · ${upcoming.lead_id} · ${deadlineLabel(upcoming.deadline)}. ${w("Confirm current status with the contractor.", "Confirmez l’état actuel avec l’entrepreneur.")}`
      : w(
          "No future published tender closes in the visible research. Review historical dates and confirm current status.",
          "Aucune fermeture publiée à venir dans les recherches visibles. Vérifiez les dates et l’état actuel."
        );
    for (const key of ["frecon", "axor", "pomerleau"])
      q(`[data-quick="${key}"]`).textContent =
        `${key === "axor" ? "AXOR" : key === "frecon" ? w("Frecon bids", "Appels Frecon") : key[0].toUpperCase() + key.slice(1)} (${records.filter((r) => quickMatch(r, key)).length})`;
    paint();
    radar();
  }
  function updateDistanceLabels() {
    if (position && selected) {
      const site = records.find((r) => r.lead_id === selected);
      if (site && coordinates(site))
        root
          .querySelectorAll("dialog [data-route]")
          .forEach(
            (link) => (link.href = drivingURL(coordinates(site), position))
          );
    }
    root.querySelectorAll("[data-lead]").forEach((button) => {
      const record = records.find((r) => r.lead_id === button.dataset.lead),
        label = button.querySelector("[data-distance]");
      if (label && record && coordinates(record) && position)
        label.textContent = ` · ${(distance(position, coordinates(record)) / 1609.344).toFixed(1)} mi`;
    });
  }
  function clearMarkers() {
    markers.forEach((m) => (engine === "google" ? m.setMap(null) : m.remove()));
    markers = [];
  }
  function coordinates(r) {
    return locationForMap(r, engine === "google" ? reviews.get(r.lead_id) : undefined);
  }
  function paint() {
    if (!map) return;
    clearMarkers();
    const rows = filtered();
    for (const r of rows) {
      const p = coordinates(r);
      if (!p) continue;
      const active =
        !highlight || contractorKey(r.general_contractor) === highlight;
      let m;
      if (engine === "google") {
        m = new window.google.maps.Marker({
          position: p,
          map,
          title: siteTitle(r.project_name),
          opacity: active ? 1 : 0.25,
          zIndex: selected === r.lead_id ? 99 : active ? 10 : 1,
          icon: {
            url:
              "data:image/svg+xml;charset=UTF-8," +
              encodeURIComponent(
                sitePinSVG({
                  color: COLORS[r.priority],
                  style: markerStyle,
                  state: visitState(r.lead_id),
                  selected: selected === r.lead_id || (!!highlight && active),
                })
              ),
            scaledSize: new window.google.maps.Size(36, 46),
            anchor: new window.google.maps.Point(18, 44),
          },
          optimized: false,
        });
        m.addListener("click", () => openOverlap(r, p));
      } else {
        m = L.marker([p.lat, p.lng], {
          title: siteTitle(r.project_name),
          opacity: active ? 1 : 0.25,
          icon: L.divIcon({
            className: "construction-pin",
            html: sitePinSVG({
              color: COLORS[r.priority],
              style: markerStyle,
              state: visitState(r.lead_id),
              selected: selected === r.lead_id || (!!highlight && active),
            }),
            iconSize: [36, 46],
            iconAnchor: [18, 44],
          }),
        })
          .addTo(map)
          .on("click", () => openOverlap(r, p));
      }
      markers.push(m);
    }
    paintRadar();
  }
  function paintRadar() {
    q("[data-stop]").disabled = !radarOn;
    q("[data-add-site]").disabled = readOnly || !position;
    if (radarShape) {
      engine === "google" ? radarShape.setMap(null) : radarShape.remove();
      radarShape = null;
    }
    if (beacon) {
      engine === "google" ? beacon.setMap(null) : beacon.remove();
      beacon = null;
    }
    const c = position || anchor;
    if (!map || !radarOn || !c) return;
    if (engine === "google") {
      radarShape = new window.google.maps.Circle({
        map,
        center: c,
        radius,
        strokeColor: "#ff3b62",
        strokeWeight: 2,
        fillColor: "#ff3b62",
        fillOpacity: 0.06,
      });
      beacon = new window.google.maps.Marker({
        map,
        position: c,
        title: position ? "You are here · Add a site" : "Manual map anchor",
        zIndex: 200,
        icon: {
          path: Number.isFinite(position?.heading)
            ? window.google.maps.SymbolPath.FORWARD_CLOSED_ARROW
            : window.google.maps.SymbolPath.CIRCLE,
          scale: 7,
          rotation: position?.heading || 0,
          fillColor: "#1a73e8",
          fillOpacity: 1,
          strokeColor: "#ffffff",
          strokeWeight: 3,
        },
      });
      if (position) beacon.addListener("click", openMyLocation);
    } else {
      radarShape = L.circle([c.lat, c.lng], {
        radius,
        color: "#ff3b62",
        weight: 2,
        fillOpacity: 0.06,
      }).addTo(map);
      beacon = L.circleMarker([c.lat, c.lng], {
        radius: 8,
        color: "#ff3b62",
        fillColor: "#1a73e8",
        fillOpacity: 1,
        weight: 3,
      }).addTo(map);
      if (position) beacon.on("click", openMyLocation);
    }
    q("[data-add-site]").disabled = readOnly || !position;
  }
  function openMyLocation() {
    if (!position) {
      startGPS({ centre: true });
      message(
        w(
          "Share your location, then tap the blue location marker to add a site.",
          "Partagez votre position, puis touchez le point bleu pour ajouter un site."
        )
      );
      return;
    }
    const fix = { ...position };
    const nearbySites = records
      .filter(
        (r) =>
          coordinates(r) &&
          distance(fix, coordinates(r)) <= Math.max(100, fix.accuracy)
      )
      .slice(0, 4);
    dialog(
      w("You are here", "Votre position"),
      `<p>${w("GPS accuracy", "Précision GPS")} ±${Math.round(fix.accuracy)} m</p><p class="fine-print">${fix.lat.toFixed(6)}, ${fix.lng.toFixed(6)}</p>${nearbySites.length ? `<p>${w("Existing sites near this location:", "Sites déjà enregistrés à proximité :")}</p>${nearbySites.map((r) => `<button class="button secondary" data-existing-site="${esc(r.lead_id)}">${esc(r.project_name)}</button>`).join("")}` : ""}<button class="button primary" data-record-location>${w("Add a site at this location", "Ajouter un site à cette position")}</button>`,
      (d) => {
        d.querySelectorAll("[data-existing-site]").forEach(
          (b) =>
            (b.onclick = () => {
              d.close();
              openLead(b.dataset.existingSite);
            })
        );
        d.querySelector("[data-record-location]").disabled = readOnly;
        d.querySelector("[data-record-location]").title = readOnly ? w("Read-only demo", "Démo en lecture seule") : "";
        d.querySelector("[data-record-location]").onclick = () => {
          if (readOnly) return;
          d.close();
          addFieldSite(fix);
        };
      }
    );
  }
  function addFieldSite(fix) {
    if (readOnly) return;
    dialog(
      w("Add a field site", "Ajouter un site terrain"),
      `<form data-new-site><p>${w("This saves a site observation at the selected GPS position. Your travel history is not recorded.", "Cette action enregistre une observation à la position GPS choisie. Votre historique de déplacement n’est pas enregistré.")}</p><p class="fine-print">${fix.lat.toFixed(6)}, ${fix.lng.toFixed(6)} · ±${Math.round(fix.accuracy)} m</p><label class="field"><span>${w("Site name *", "Nom du site *")}</span><input name="name" required minlength="3" maxlength="180" placeholder="${w("e.g. Renovation on Notre-Dame", "Ex. Rénovation sur Notre-Dame")}"></label><label class="field"><span>${w("Address, if known", "Adresse, si connue")}</span><input name="address" maxlength="300" autocomplete="street-address"></label><div class="field-form-grid"><label class="field"><span>${w("City", "Ville")}</span><input name="city" maxlength="300"></label><label class="field"><span>Province</span><select name="province"><option value="">${w("To confirm", "À confirmer")}</option><option value="QC">Québec</option><option value="ON">Ontario</option></select></label></div><label class="field"><span>${w("Contractor, if known", "Entrepreneur, si connu")}</span><input name="contractor" maxlength="300"></label><label class="field"><span>${w("What did you observe? / next steps", "Observations / prochaines étapes")}</span><textarea name="notes" maxlength="4000" rows="3"></textarea></label>${fix.accuracy > 200 ? `<label class="check-line"><input type="checkbox" name="confirmLocation" required> ${w("GPS accuracy is low. I confirm this is the site location.", "Le GPS est imprécis. Je confirme la position du site.")}</label>` : ""}<p role="status" data-save-status></p><button class="button primary" type="submit">${w("Save site", "Enregistrer le site")}</button></form>`,
      (d) => {
        const requestId = crypto.randomUUID(),
          form = d.querySelector("form");
        form.onsubmit = async (e) => {
          e.preventDefault();
          const button = form.querySelector("[type=submit]");
          button.disabled = true;
          try {
            const values = Object.fromEntries(new FormData(form)),
              result = await request("/admin/maps/field-sites", {
                method: "POST",
                body: JSON.stringify({
                  ...values,
                  requestId,
                  lat: fix.lat,
                  lng: fix.lng,
                  accuracy: fix.accuracy,
                  locationCapturedAt: new Date(
                    fix.timestamp || Date.now()
                  ).toISOString(),
                  confirmLocation: values.confirmLocation === "on",
                }),
              });
            if (disposed) return;
            fieldSites.push(result.site);
            rebuildRecords();
            alerted.add(result.site.id);
            populate();
            refresh();
            d.close();
            openLead(result.site.id);
          } catch (e) {
            form.querySelector("[data-save-status]").textContent = [
              e.message,
              ...(e.data?.errors || []),
            ].join(" ");
            button.disabled = false;
          }
        };
      }
    );
  }
  function openOverlap(r, p) {
    const same = filtered().filter((v) => {
      const c = coordinates(v);
      return c && distance(p, c) < 8;
    });
    if (same.length < 2) return openLead(r.lead_id);
    dialog(
      w("Projects at this location", "Projets à cet endroit"),
      `<p>${w("Several sites are marked here. Choose a site.", "Plusieurs sites sont indiqués ici. Choisissez un site.")}</p>${same.map((v) => `<button class="button secondary" data-overlap="${esc(v.lead_id)}">${esc(siteTitle(v.project_name))}</button>`).join("")}`,
      (d) =>
        d.querySelectorAll("[data-overlap]").forEach(
          (b) =>
            (b.onclick = () => {
              d.close();
              openLead(b.dataset.overlap);
            })
        )
    );
  }
  function fit() {
    const pts = filtered().map(coordinates).filter(Boolean);
    if (!pts.length || !map) return;
    if (engine === "google") {
      const bounds = new window.google.maps.LatLngBounds();
      pts.forEach((p) => bounds.extend(p));
      map.fitBounds(bounds, 40);
    } else
      map.fitBounds(
        pts.map((p) => [p.lat, p.lng]),
        { padding: [30, 30], maxZoom: 14 }
      );
  }
  async function initMap(next, { preserveView = false } = {}) {
    const view =
      preserveView && map && engine === "google"
        ? {
            center: { lat: map.getCenter().lat(), lng: map.getCenter().lng() },
            zoom: map.getZoom(),
            mapTypeId: map.getMapTypeId(),
          }
        : null;
    const g = ++mapGeneration;
    if (next !== engine && anchor) stopGPS();
    clearMarkers();
    if (map) {
      if (engine === "leaflet") map.remove();
      else window.google?.maps.event.clearInstanceListeners(map);
    }
    if (radarShape) {
      engine === "google" ? radarShape.setMap(null) : radarShape.remove();
      radarShape = null;
    }
    if (beacon) {
      engine === "google" ? beacon.setMap(null) : beacon.remove();
      beacon = null;
    }
    map = null;
    engine = next;
    canvas.innerHTML = "";
    q("[data-engine]").value = engine;
    try {
      if (next === "google") {
        const c = await request("/admin/maps/config");
        const gm = await googleMaps(c.googleMapsKey);
        if (disposed || g !== mapGeneration) return;
        const { ColorScheme } = await gm.importLibrary("core");
        if (disposed || g !== mapGeneration) return;
        map = new gm.Map(canvas, {
          center: { lat: 45.51, lng: -73.57 },
          zoom: 9,
          mapTypeControl: !isMapsApp(),
          streetViewControl: !isMapsApp(),
          cameraControl: !isMapsApp(),
          zoomControl: !isMapsApp(),
          fullscreenControl: !isMapsApp(),
          gestureHandling: isMapsApp() ? "greedy" : "cooperative",
          colorScheme:
            document.documentElement.dataset.theme === "dark"
              ? ColorScheme.DARK
              : ColorScheme.LIGHT,
          ...(view || {}),
        });
      } else {
        map = L.map(canvas, { center: [45.51, -73.57], zoom: 9 });
        L.tileLayer("https://tile.openstreetmap.org/{z}/{x}/{y}.png", {
          attribution:
            '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
          maxZoom: 19,
        }).addTo(map);
      }
      if (disposed || g !== mapGeneration) return;
      if (engine === "google")
        map.addListener("dragstart", () => {
          followingLocation = false;
        });
      else
        map.on("dragstart", () => {
          followingLocation = false;
        });
      paint();
      if (!view) {
        if (followingLocation && position) centreOnMe();
        else fit();
      }
      canvas.dataset.scheme = document.documentElement.dataset.theme;
      message(`${records.length} ${w("sites ready", "sites prêts")}.`);
    } catch (e) {
      if (!disposed && g === mapGeneration) {
        canvas.innerHTML = `<div class="map-unavailable"><h3>${w("Map unavailable", "Carte indisponible")}</h3><p>${esc(e.message)}</p><button class="button secondary" data-fallback>${w("Open fallback map", "Ouvrir la carte de secours")}</button></div>`;
        canvas.querySelector("[data-fallback]").onclick = () =>
          initMap("leaflet");
        message(e.message);
      }
    }
  }
  function dialog(title, html, mount) {
    const previousFocus = document.activeElement;
    const d = document.createElement("dialog");
    d.className = "admin-dialog";
    const headingId = "map-dialog-" + ++dialogSequence;
    d.setAttribute("aria-labelledby", headingId);
    d.innerHTML = `<header><h3 id="${headingId}">${esc(title)}</h3><button class="icon-button" data-close aria-label="${w("Close", "Fermer")}">×</button></header><div class="dialog-content">${html}</div>`;
    root.append(d);
    d.querySelector("[data-close]").onclick = () => d.close();
    d.addEventListener("close", () => {
      street?.setVisible(false);
      street = null;
      d.remove();
      if (previousFocus?.isConnected) previousFocus.focus();
    });
    d.showModal();
    mount?.(d);
    return d;
  }
  function openLead(id) {
    const r = records.find((r) => r.lead_id === id);
    if (!r) return;
    selected = id;
    refresh();
    const p = coordinates(r);
    if (p && map) {
      engine === "google" ? map.panTo(p) : map.panTo([p.lat, p.lng]);
    }
    dialog(
      siteTitle(r.project_name),
      dossierHTML(r, {
        w,
        p,
        analyst,
        reviewed: reviews.has(id),
        driveURL: drive(r),
        visitState: visitState(r.lead_id),
        workflow: activity[r.lead_id],
      }),
      (d) => {
        d.classList.add("site-dialog");
        d.dataset.recordId = id;
        const header = d.querySelector("header");
        d.addEventListener(
          "close",
          () => {
            const row = q(`[data-lead="${CSS.escape(id)}"]`);
            (row?.offsetParent ? row : q("[data-my-location]"))?.focus({
              preventScroll: true,
            });
          },
          { once: true }
        );
        header.append(
          d.querySelector("[data-card-address]"),
          d.querySelector("[data-card-actions]")
        );
        if (readOnly) {
          for (const control of d.querySelectorAll("[data-set-visit], [data-visit-notes]")) control.disabled = true;
          d.querySelector("[data-work-status]").textContent = w("Demo: visits and notes cannot be saved.", "Démo : les visites et notes ne peuvent pas être enregistrées.");
        }
        const cardHeaderObserver = new ResizeObserver(() =>
          d.style.setProperty(
            "--site-header-height",
            header.getBoundingClientRect().height + "px"
          )
        );
        cardHeaderObserver.observe(header);
        d.addEventListener("close", () => cardHeaderObserver.disconnect(), {
          once: true,
        });
        d.querySelectorAll("[data-set-visit]").forEach(
          (b) =>
            (b.onclick = async () => {
              if (readOnly) return;
              const status = d.querySelector("[data-work-status]");
              d.querySelectorAll("[data-set-visit]").forEach(
                (button) => (button.disabled = true)
              );
              try {
                const result = await request("/admin/maps/site-status", {
                  method: "POST",
                  body: JSON.stringify({
                    leadId: r.lead_id,
                    status: b.dataset.setVisit,
                    expectedVersion: activity[r.lead_id]?.version || null,
                    notes: d.querySelector("[data-visit-notes]").value,
                  }),
                });
                if (disposed) return;
                activity[r.lead_id] = result.activity;
                alerted.delete(r.lead_id);
                refresh();
                d.close();
                message(
                  `${siteTitle(r.project_name)} · ${w(...VISIT_LABELS[result.activity.status])}`
                );
              } catch (e) {
                status.textContent = e.message;
                d.querySelectorAll("[data-set-visit]").forEach(
                  (button) => (button.disabled = false)
                );
              }
            })
        );
        d.querySelector("[data-pin-anchor]")?.addEventListener("click", () => {
          stopGPS();
          anchor = coordinates(r);
          radarOn = true;
          alerted.clear();
          refresh();
          d.close();
        });
        d.querySelector("[data-group]")?.addEventListener("click", () => {
          highlight =
            highlight === contractorKey(r.general_contractor)
              ? ""
              : contractorKey(r.general_contractor);
          paint();
          d.close();
          message(
            highlight
              ? `${w("Showing", "Affichage")} ${highlight}`
              : w("Company filter cleared.", "Filtre d’entreprise effacé.")
          );
        });
        d.querySelector("[data-locate]").onclick = async (e) => {
          if (r.location_audit) return;
          const b = e.currentTarget;
          b.disabled = true;
          const s = d.querySelector("[data-location-status]");
          try {
            if (engine !== "google" || !map)
              throw Error(
                w("Select Google Maps first.", "Sélectionnez Google Maps.")
              );
            const result = await new window.google.maps.Geocoder().geocode({
              address: [r.site_address, r.city, r.region, "Canada"]
                .filter(Boolean)
                .join(", "),
              componentRestrictions: { country: "CA" },
            });
            if (disposed || !d.open) return;
            const c = reviewedLocation(r, result);
            reviews.set(id, c);
            s.textContent = w(
              "Address located by Google for this session. This does not verify the lead.",
              "Adresse repérée par Google pour cette session. La piste reste à vérifier."
            );
            paint();
            map.panTo(c);
            d.querySelector("[data-route]")?.setAttribute(
              "href",
              drivingURL(c, position)
            );
          } catch (e) {
            s.textContent = e.message;
          } finally {
            b.disabled = false;
          }
        };
        d.querySelector("[data-street]")?.addEventListener(
          "click",
          async (e) => {
            const b = e.currentTarget;
            b.disabled = true;
            const target = d.querySelector("[data-street-view]");
            try {
              if (engine !== "google")
                throw Error("Street View requires Google Maps.");
              const service = new window.google.maps.StreetViewService(),
                result = await service.getPanorama({
                  location: coordinates(r),
                  radius: 80,
                });
              if (disposed || !d.open) return;
              target.innerHTML = `<p>${w("Nearby imagery, not proof of current construction.", "Images à proximité, pas une preuve de l’état actuel.")} ${esc(result.data.imageDate || "")}</p><div class="street-canvas"></div>`;
              street = new window.google.maps.StreetViewPanorama(
                target.querySelector(".street-canvas"),
                { pano: result.data.location.pano, visible: true }
              );
            } catch (e) {
              target.textContent =
                e.code === "ZERO_RESULTS"
                  ? w(
                      "No nearby Street View imagery.",
                      "Aucune image Street View à proximité."
                    )
                  : e.message;
            } finally {
              b.disabled = false;
            }
          }
        );
      }
    );
  }
  function hideAlert() {
    clearTimeout(alertTimer);
    activeAlertId = null;
    q(".radar-alert").hidden = true;
  }
  function radar() {
    if (!radarOn || (!position && !anchor)) return;
    const origin = position || anchor,
      near = filtered()
        .filter(
          (r) =>
            visitState(r.lead_id) !== "visited" &&
            coordinates(r) &&
            distance(origin, coordinates(r)) <= radius
        )
        .sort(
          (a, b) =>
            distance(origin, coordinates(a)) - distance(origin, coordinates(b))
        );
    if (activeAlertId && !near.some((r) => r.lead_id === activeAlertId))
      hideAlert();
    const next =
      near.find((r) => !alerted.has(r.lead_id)) ||
      (prefs.earlyWarning && position
        ? filtered().find(
            (r) =>
              visitState(r.lead_id) !== "visited" &&
              coordinates(r) &&
              approaching(
                position,
                coordinates(r),
                position.heading,
                position.speed,
                radius
              ) &&
              !alerted.has(r.lead_id)
          )
        : null);
    if (next && Date.now() - lastAlertAt > 15000) {
      lastAlertAt = Date.now();
      alerted.add(next.lead_id);
      activeAlertId = next.lead_id;
      clearTimeout(alertTimer);
      alertTimer = setTimeout(hideAlert, 12000);
      const alert = q(".radar-alert");
      alert.hidden = false;
      alert.innerHTML = `<strong>${w("Nearby site", "Site à proximité")}</strong><span>${esc(siteTitle(next.project_name))} · ${(distance(origin, coordinates(next)) / 1609.344).toFixed(1)} mi</span><button class="button secondary" data-open>${w("View site", "Voir le site")}</button><a class="button secondary" href="${drive(next)}" target="_blank" rel="noopener noreferrer">${w("Drive here", "Y aller en voiture")}</a><button class="text-link" data-dismiss>${w("Dismiss", "Fermer")}</button>`;
      alert.querySelector("[data-open]").onclick = () => openLead(next.lead_id);
      alert.querySelector("[data-dismiss]").onclick = () => {
        hideAlert();
      };
      if (notificationsOn && window.Notification?.permission === "granted") {
        try {
          const options = {
            body: `${siteTitle(next.project_name)} · ${(distance(origin, coordinates(next)) / 1609.344).toFixed(1)} mi`,
            tag: "sap-site-" + next.lead_id,
            icon: "./brand/map-app-192.png",
          };
          if (navigator.serviceWorker?.controller)
            navigator.serviceWorker.ready
              .then((reg) =>
                reg.showNotification(
                  w("Nearby site", "Site à proximité"),
                  options
                )
              )
              .catch(() => {});
          else new Notification(w("Nearby site", "Site à proximité"), options);
        } catch {}
      }
      if (audio?.state === "running") {
        const osc = audio.createOscillator(),
          gain = audio.createGain();
        osc.connect(gain);
        gain.connect(audio.destination);
        gain.gain.setValueAtTime(0.04, audio.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.001, audio.currentTime + 0.2);
        osc.start();
        osc.stop(audio.currentTime + 0.2);
      }
    }
    paintRadar();
    q("[data-radar-status]").textContent =
      `${position ? w("GPS active", "GPS actif") : w("Map anchor active", "Centre de carte actif")} · ${near.length} ${w("nearby", "à proximité")}${position?.accuracy ? ` · ±${Math.round(position.accuracy)} m` : ""}`;
  }
  function stopGPS() {
    gpsGeneration++;
    followingLocation = false;
    wakeLock?.release().catch(() => {});
    wakeLock = null;
    if (watch !== null) navigator.geolocation.clearWatch(watch);
    watch = null;
    position = null;
    radarOn = false;
    anchor = null;
    previousPosition = null;
    paintRadar();
    q("[data-gps]").textContent = w("Nearby alerts", "Alertes à proximité");
    q("[data-radar-status]").textContent = w(
      "GPS off · foreground use only",
      "GPS désactivé · premier plan uniquement"
    );
    hideAlert();
  }
  function startGPS({ centre = false } = {}) {
    pendingCentre = centre;
    if (centre) followingLocation = true;
    if (watch !== null && centre) {
      if (position) centreOnMe();
      return;
    }
    if (watch !== null) {
      stopGPS();
      refresh();
      return;
    }
    if (!navigator.geolocation) {
      locationIssue(
        w(
          "This browser cannot share a location. You can still browse sites and open driving directions.",
          "Ce navigateur ne peut pas partager votre position. Vous pouvez consulter les sites et ouvrir un itinéraire."
        )
      );
      return;
    }
    const Audio = window.AudioContext || window.webkitAudioContext;
    if (Audio) {
      audio ||= new Audio();
      audio.resume().catch(() => {});
    }
    alerted.clear();
    radarOn = true;
    anchor = null;
    previousPosition = null;
    paintRadar();
    q("[data-gps]").textContent = w(
      "Stop nearby alerts",
      "Arrêter les alertes"
    );
    if (
      prefs.keepAwake &&
      navigator.wakeLock &&
      document.visibilityState === "visible"
    )
      navigator.wakeLock
        .request("screen")
        .then((lock) => {
          if (radarOn) wakeLock = lock;
          else lock.release();
        })
        .catch(() => {});
    const run = ++gpsGeneration;
    watch = navigator.geolocation.watchPosition(
      (p) => {
        if (disposed || run !== gpsGeneration) return;
        position = {
          lat: p.coords.latitude,
          lng: p.coords.longitude,
          accuracy: p.coords.accuracy,
          timestamp: p.timestamp,
          speed: p.coords.speed,
          heading: p.coords.heading,
        };
        if (
          !Number.isFinite(position.heading) &&
          previousPosition &&
          distance(previousPosition, position) > 10
        )
          position.heading = bearing(previousPosition, position);
        previousPosition = position;
        if (pendingCentre) {
          pendingCentre = false;
          centreOnMe();
        } else if (followingLocation && map) {
          engine === "google"
            ? map.panTo(position)
            : map.panTo([position.lat, position.lng], { animate: false });
        }
        q("[data-add-site]").disabled = readOnly;
        if (insideOnly) refresh();
        else {
          updateDistanceLabels();
          radar();
        }
      },
      (e) => {
        if (disposed || run !== gpsGeneration) return;
        stopGPS();
        locationIssue(
          e.code === 1
            ? isMapsApp()
              ? w(
                  "Location permission denied. Allow location for this site in your browser or device settings, then tap My location again. You can still browse sites and open driving directions.",
                  "Accès à la position refusé. Autorisez la position pour ce site dans les réglages du navigateur ou de l’appareil, puis réessayez. Vous pouvez consulter les sites et ouvrir un itinéraire."
                )
              : w(
                  "Location permission denied. Choose “Use map centre” for a manual anchor; no position has been simulated.",
                  "Accès à la position refusé. Utilisez le centre de la carte; aucune position simulée."
                )
            : w(
                "Location is unavailable right now. Check that device location is enabled, then try My location again. You can still browse sites and open driving directions.",
                "Position indisponible pour le moment. Vérifiez que la localisation de l’appareil est activée, puis réessayez. Vous pouvez consulter les sites et ouvrir un itinéraire."
              )
        );
      },
      { enableHighAccuracy: true, maximumAge: 10000, timeout: 20000 }
    );
  }
  q("[data-gps]").onclick = () => startGPS();
  q("[data-my-location]").onclick = () => startGPS({ centre: true });
  function centreOnMe() {
    if (!map || !position) return;
    if (engine === "google") {
      map.panTo(position);
      map.setZoom(Math.max(14, map.getZoom()));
    } else
      map.setView([position.lat, position.lng], Math.max(14, map.getZoom()));
    canvas.scrollIntoView({ block: "center", behavior: "smooth" });
  }
  q("[data-notifications]").onclick = async () => {
    if (!("Notification" in window)) {
      message(
        w(
          "Use the on-screen alerts and sound on this browser.",
          "Utilisez les alertes à l’écran et le son dans ce navigateur."
        )
      );
      return;
    }
    try {
      const permission = await Notification.requestPermission();
      notificationsOn = permission === "granted";
      message(
        notificationsOn
          ? w(
              "Device notifications enabled while location updates are available. Keep the app open for reliable nearby alerts.",
              "Notifications activées lorsque la position est disponible. Gardez l’application ouverte pour des alertes fiables."
            )
          : w(
              "On-screen alerts remain available. Device notifications were not enabled.",
              "Les alertes à l’écran restent disponibles. Notifications système non activées."
            )
      );
    } catch {
      message(
        w(
          "This browser requires installing the Maps app before enabling notifications.",
          "Installez l’application Cartes pour activer les notifications dans ce navigateur."
        )
      );
    }
  };
  q("[data-add-site]").onclick = openMyLocation;
  q("[data-visit-filter]").onchange = refresh;
  q("[data-stop]").onclick = () => {
    stopGPS();
    insideOnly = false;
    q("[data-inside]").setAttribute("aria-pressed", "false");
    refresh();
  };
  q("[data-anchor]").onclick = () => {
    if (!map) return;
    stopGPS();
    const c = map.getCenter();
    anchor =
      engine === "google"
        ? { lat: c.lat(), lng: c.lng() }
        : { lat: c.lat, lng: c.lng };
    radarOn = true;
    alerted.clear();
    refresh();
  };
  q("[data-radius]").onchange = (e) => {
    radius = Number(e.target.value);
    prefs.radius = radius;
    try {
      localStorage.setItem(
        "sap-map-preferences",
        JSON.stringify({
          ...prefs,
          analyst,
          recordView: analyst ? "research" : "field",
          radius,
          markerStyle,
        })
      );
    } catch {}
    alerted.clear();
    refresh();
  };
  root.querySelectorAll("[data-quick]").forEach(
    (b) =>
      (b.onclick = () => {
        quick = quick === b.dataset.quick ? "" : b.dataset.quick;
        root
          .querySelectorAll("[data-quick]")
          .forEach((v) =>
            v.setAttribute("aria-pressed", String(v.dataset.quick === quick))
          );
        refresh();
      })
  );
  q("[data-inside]").onclick = (e) => {
    insideOnly = !insideOnly;
    e.currentTarget.setAttribute("aria-pressed", String(insideOnly));
    if (insideOnly && !position && !anchor)
      message(
        w(
          "Start GPS or choose a map or lead anchor to use the radius filter.",
          "Activez le GPS ou choisissez un centre pour utiliser ce filtre."
        )
      );
    refresh();
  };
  q("[data-clear]").onclick = () => {
    quick = "";
    insideOnly = false;
    highlight = "";
    q("[data-search]").value = "";
    q("[data-gc]").value = "";
    q("[data-stage]").value = "";
    q("[data-visit-filter]").value = "";
    visibleTiers = [...TIERS];
    root
      .querySelectorAll(".tier-controls input")
      .forEach((c) => (c.checked = visibleTiers.includes(c.value)));
    root
      .querySelectorAll("[data-quick],[data-inside]")
      .forEach((b) => b.setAttribute("aria-pressed", "false"));
    refresh();
  };
  root.querySelectorAll("button[data-layout]").forEach(
    (b) =>
      (b.onclick = () => {
        q(".map-layout").dataset.layout = b.dataset.layout;
        root
          .querySelectorAll("button[data-layout]")
          .forEach((v) => v.setAttribute("aria-pressed", String(v === b)));
        if (map) {
          engine === "leaflet"
            ? map.invalidateSize()
            : window.google.maps.event.trigger(map, "resize");
          fit();
        }
      })
  );
  q("[data-engine]").onchange = (e) => initMap(e.target.value);
  q("[data-fit]").onclick = fit;
  q("[data-search]").oninput = refresh;
  q("[data-gc]").onchange = refresh;
  q("[data-stage]").onchange = refresh;
  root.querySelectorAll(".tier-controls input").forEach(
    (c) =>
      (c.onchange = () => {
        visibleTiers = [
          ...root.querySelectorAll(".tier-controls input:checked"),
        ].map((v) => v.value);
        refresh();
      })
  );
  q("[data-settings]").onclick = () =>
    dialog(
      w("View options", "Options d’affichage"),
      `<label class="check-line"><input type="checkbox" data-analyst ${analyst ? "checked" : ""}> ${w("Show full project records", "Afficher les dossiers complets")}</label><p>${w("Keep full records folded for everyday visits. Display preferences stay on this device.", "Gardez les dossiers repliés pour les visites courantes. Les préférences d’affichage restent sur cet appareil.")}</p><label class="field"><span>${w("Construction marker", "Repère de chantier")}</span><select data-marker-style><option value="building">${w("Building pin", "Bâtiment")}</option><option value="hardhat">${w("Hard-hat pin", "Casque de chantier")}</option><option value="crane">${w("Crane pin", "Grue")}</option></select></label><label class="check-line"><input type="checkbox" data-keep-awake ${prefs.keepAwake ? "checked" : ""} ${!navigator.wakeLock ? "disabled" : ""}> ${w("Keep screen awake while nearby alerts are on", "Garder l’écran allumé pendant les alertes de proximité")}</label><button class="button secondary" type="button" data-enable-device-alerts>${w("Enable device notifications", "Activer les notifications système")}</button><button class="button secondary" type="button" data-open-import>${w("Import or back up site data", "Importer ou sauvegarder les sites")}</button><button class="button primary" data-apply>${w("Apply & close", "Appliquer et fermer")}</button>`,
      (d) => {
        d.querySelector("[data-marker-style]").value = markerStyle;
        d.querySelector("[data-open-import]").disabled = readOnly;
        d.querySelector("[data-enable-device-alerts]").onclick = () =>
          q("[data-notifications]").click();
        d.querySelector("[data-open-import]").onclick = () => {
          d.close();
          q("[data-import]").click();
        };
        d.querySelector("[data-apply]").onclick = () => {
          analyst = d.querySelector("[data-analyst]").checked;
          markerStyle = d.querySelector("[data-marker-style]").value;
          prefs.keepAwake = d.querySelector("[data-keep-awake]").checked;
          paint();
          try {
            localStorage.setItem(
              "sap-map-preferences",
              JSON.stringify({
                analyst,
                recordView: analyst ? "research" : "field",
                radius,
                markerStyle,
                keepAwake: prefs.keepAwake,
              })
            );
          } catch {}
          d.close();
        };
      }
    );
  function download(name, content, type) {
    const url = URL.createObjectURL(new Blob([content], { type })),
      a = document.createElement("a");
    a.href = url;
    a.download = name;
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }
  q("[data-import]").onclick = () =>
    dialog(
      w(
        "Research register · import / export",
        "Registre de recherche · importation / exportation"
      ),
      `<p>${w("Exports contain private business research. Keep them in approved storage. Google location reviews and GPS are session-only and excluded.", "Les exports contiennent des renseignements commerciaux privés. Conservez-les dans un espace autorisé. Les vérifications Google et le GPS ne sont pas exportés.")}</p><div class="map-actions"><button class="button secondary" data-json>Research JSON · ${researchRecords.length}</button><button class="button secondary" data-field-backup>${w("Field work backup", "Sauvegarde terrain")}</button><button class="button secondary" data-csv>Research CSV · ${researchRecords.length}</button></div><hr><label class="field"><span>${w("Replace private research register", "Remplacer le registre privé")}</span><input type="file" accept=".json,.csv,application/json,text/csv" data-file></label><p>${w("Review validation and counts before confirming. The current version is preserved in the private audit history.", "Vérifiez la validation et les totaux avant de confirmer. La version actuelle reste dans l’historique privé.")}</p><div data-preview role="status"></div><button class="button primary" data-save disabled>${w("Confirm replacement", "Confirmer le remplacement")}</button>`,
      (d) => {
        d.querySelector("[data-field-backup]").onclick = () =>
          download(
            "sap-private-field-work.json",
            JSON.stringify({ fieldSites, activity }, null, 2),
            "application/json"
          );
        d.querySelector("[data-json]").onclick = () =>
          download(
            "sap-private-research.json",
            JSON.stringify(researchRecords, null, 2),
            "application/json"
          );
        d.querySelector("[data-csv]").onclick = () =>
          download(
            "sap-private-research.csv",
            csv(researchRecords),
            "text/csv;charset=utf-8"
          );
        let incoming = null;
        const save = d.querySelector("[data-save]"),
          preview = d.querySelector("[data-preview]");
        d.querySelector("[data-file]").onchange = async (e) => {
          save.disabled = true;
          incoming = null;
          const f = e.target.files[0];
          if (!f) return;
          try {
            if (f.size > 4000000) throw Error("Maximum import size: 4 MB.");
            const raw = await f.text(),
              data = f.name.toLowerCase().endsWith(".csv")
                ? parseCSV(raw)
                : JSON.parse(raw),
              rows = Array.isArray(data) ? data : data.records,
              errors = importErrors(rows);
            if (errors.length) throw Error(errors.slice(0, 30).join("\n"));
            incoming = rows;
            preview.textContent = `${rows.length} records · ${TIERS.map((t) => `${t}: ${rows.filter((r) => r.priority === t).length}`).join(" / ")}. ${w("Ready for your confirmation.", "Prêt pour votre confirmation.")}`;
            save.disabled = false;
          } catch (e) {
            preview.textContent = e.message;
          }
        };
        save.onclick = async () => {
          save.disabled = true;
          try {
            const r = await request("/admin/maps/dataset", {
              method: "POST",
              body: JSON.stringify({
                records: incoming,
                expectedVersion: version,
                source: "Administrator validated import",
              }),
            });
            if (disposed) return;
            researchRecords = incoming;
            rebuildRecords();
            version = r.version;
            reviews.clear();
            populate();
            refresh();
            fit();
            d.close();
            message(
              w(
                "Private register updated; audit history preserved.",
                "Registre privé mis à jour; historique conservé."
              )
            );
          } catch (e) {
            preview.textContent = [e.message, ...(e.data?.errors || [])].join(
              "\n"
            );
            save.disabled = false;
          }
        };
      }
    );
  const authFailure = () => {
    if (disposed || engine !== "google") return;
    clearMarkers();
    if (map) window.google?.maps.event.clearInstanceListeners(map);
    map = null;
    canvas.innerHTML = `<div class="map-unavailable"><h3>${w("Google Maps unavailable", "Google Maps indisponible")}</h3><p>${w("The map provider rejected this page. The research list remains available.", "Le fournisseur a refusé cette page. La liste des recherches reste accessible.")}</p><button class="button secondary" data-fallback>${w("Open fallback map", "Ouvrir la carte de secours")}</button></div>`;
    canvas.querySelector("[data-fallback]").onclick = () => initMap("leaflet");
    message(
      w(
        "Google Maps authorization failed. Select the fallback map.",
        "Autorisation Google Maps refusée. Sélectionnez la carte de secours."
      )
    );
  };
  window.addEventListener("sap-map-auth-failure", authFailure);
  const themeObserver = new MutationObserver(() => {
    if (engine === "google" && map) initMap("google", { preserveView: true });
  });
  themeObserver.observe(document.documentElement, {
    attributes: true,
    attributeFilter: ["data-theme"],
  });
  async function loadSites() {
    try {
      const data = await request("/admin/maps/dataset");
      if (!disposed) {
        researchRecords = data.records;
        fieldSites = data.fieldSites || [];
        activity = data.activity || {};
        rebuildRecords();
        version = data.version;
        populate();
        refresh();
        await initMap("google");
      }
    } catch (e) {
      if (disposed) return;
      message(
        w(
          "Sites couldn’t load. Please retry.",
          "Impossible de charger les sites. Réessayez."
        )
      );
      canvas.innerHTML = `<div class="map-unavailable"><h3>${w("Let’s try again", "Réessayons")}</h3><p>${w("Check your connection, then reload your sites.", "Vérifiez votre connexion, puis rechargez vos sites.")}</p><button class="button primary" data-retry-sites>${w("Reload sites", "Recharger les sites")}</button></div>`;
      canvas.querySelector("[data-retry-sites]").onclick = (e) => {
        e.currentTarget.disabled = true;
        loadSites();
      };
    }
  }
  loadSites();
  return () => {
    if (disposed) return;
    disposed = true;
    mapGeneration++;
    disposeFullscreen();
    disposeAppLayout();
    mapSizeObserver.disconnect();
    window.removeEventListener("sap-map-layout", resizeMap);
    stopGPS();
    window.removeEventListener("sap-map-auth-failure", authFailure);
    themeObserver.disconnect();
    audio?.close().catch(() => {});
    root.querySelectorAll("dialog").forEach((d) => d.close());
    clearMarkers();
    if (map) {
      if (engine === "leaflet") map.remove();
      else window.google?.maps.event.clearInstanceListeners(map);
    }
    reviews.clear();
    records = [];
    researchRecords = [];
    fieldSites = [];
    activity = {};
    root.innerHTML = "";
  };
}
