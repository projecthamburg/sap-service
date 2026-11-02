import { reviewedLocation } from "./location.js";
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
export function mountMaps(root, { request, language }) {
  const fr = language === "fr",
    w = (a, b) => (fr ? b : a);
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
    previousPosition = null;
  const alerted = new Set(),
    reviews = new Map();
  let prefs;
  try {
    prefs = JSON.parse(localStorage.getItem("sap-map-preferences") || "{}");
  } catch {
    prefs = {};
  }
  let analyst = prefs.analyst !== false,
    visibleTiers = TIERS.filter((t) => t !== "Unqualified"),
    radius = Number(prefs.radius) || 3200;
  root.innerHTML = mapShell(w, visibleTiers);
  const q = (s) => root.querySelector(s),
    status = q(".map-status"),
    canvas = q(".map-canvas");
  q("[data-radius]").value = String(radius);
  function message(s) {
    if (!disposed) status.textContent = s;
  }
  function filtered() {
    return filterLeads(records, {
      search: q("[data-search]").value,
      tiers: visibleTiers,
      gc: q("[data-gc]").value,
      stage: q("[data-stage]").value,
    }).filter(
      (r) =>
        quickMatch(r, quick) &&
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
    const rows = filtered();
    root
      .querySelectorAll("[data-count]")
      .forEach(
        (b) =>
          (b.textContent = records.filter(
            (r) => r.priority === b.dataset.count
          ).length)
      );
    q(".lead-results").textContent =
      `${rows.length} / ${records.length} ${w("research leads", "pistes de recherche")} · ${rows.filter((r) => !point(r)).length} ${w("without coordinates", "sans coordonnées")}`;
    q(".lead-list").innerHTML =
      rows
        .map(
          (r) =>
            `<button class="lead-row ${selected === r.lead_id ? "selected" : ""}" data-lead="${esc(r.lead_id)}" style="--tier:${COLORS[r.priority]}"><span class="lead-row-meta">${esc(r.lead_id)} · ${esc(r.priority)} <strong>${r.opportunity_score}/100</strong></span><span class="lead-row-title">${esc(r.project_name)}</span><span>${esc(contractorName(r.general_contractor))} · ${esc(r.city)}</span><small>${esc(r.project_stage)}${position && coordinates(r) ? ` · ${(distance(position, coordinates(r)) / 1000).toFixed(1)} km` : ""}</small></button>`
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
  function clearMarkers() {
    markers.forEach((m) => (engine === "google" ? m.setMap(null) : m.remove()));
    markers = [];
  }
  function coordinates(r) {
    return engine === "google" && reviews.has(r.lead_id)
      ? reviews.get(r.lead_id)
      : point(r);
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
          title: r.project_name,
          opacity: active ? 1 : 0.25,
          zIndex: selected === r.lead_id ? 99 : active ? 10 : 1,
          icon: {
            path: window.google.maps.SymbolPath.CIRCLE,
            scale: selected === r.lead_id ? 11 : active && highlight ? 10 : 7,
            fillColor: COLORS[r.priority],
            fillOpacity: 1,
            strokeColor: active && highlight ? "#14293f" : "#fff",
            strokeWeight: active && highlight ? 4 : 2,
          },
        });
        m.addListener("click", () => openOverlap(r, p));
      } else {
        m = L.circleMarker([p.lat, p.lng], {
          radius: selected === r.lead_id ? 11 : highlight && active ? 10 : 7,
          color: active && highlight ? "#14293f" : "#fff",
          weight: active && highlight ? 4 : 2,
          fillColor: COLORS[r.priority],
          fillOpacity: active ? 1 : 0.2,
          opacity: active ? 1 : 0.25,
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
        title: position ? "Live GPS position" : "Manual map anchor",
        zIndex: 200,
        icon: {
          path: Number.isFinite(position?.heading)
            ? window.google.maps.SymbolPath.FORWARD_CLOSED_ARROW
            : window.google.maps.SymbolPath.CIRCLE,
          scale: 7,
          rotation: position?.heading || 0,
          fillColor: "#1e2d53",
          fillOpacity: 1,
          strokeColor: "#ff3b62",
          strokeWeight: 3,
        },
      });
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
        fillColor: "#1e2d53",
        fillOpacity: 1,
        weight: 3,
      }).addTo(map);
    }
  }
  function openOverlap(r, p) {
    const same = filtered().filter((v) => {
      const c = coordinates(v);
      return c && distance(p, c) < 8;
    });
    if (same.length < 2) return openLead(r.lead_id);
    dialog(
      w("Projects at this location", "Projets à cet endroit"),
      `<p>${w("These records share approximate coordinates. Select a dossier.", "Ces dossiers partagent des coordonnées approximatives.")}</p>${same.map((v) => `<button class="button secondary" data-overlap="${esc(v.lead_id)}">${esc(v.project_name)}</button>`).join("")}`,
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
  async function initMap(next) {
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
        map = new gm.Map(canvas, {
          center: { lat: 45.51, lng: -73.57 },
          zoom: 9,
          mapTypeControl: true,
          streetViewControl: true,
          fullscreenControl: true,
          gestureHandling: "cooperative",
          styles:
            document.documentElement.dataset.theme === "dark"
              ? [
                  { elementType: "geometry", stylers: [{ color: "#18243b" }] },
                  {
                    elementType: "labels.text.fill",
                    stylers: [{ color: "#adb7ca" }],
                  },
                  {
                    elementType: "labels.text.stroke",
                    stylers: [{ color: "#18243b" }],
                  },
                ]
              : null,
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
      paint();
      fit();
      message(
        `${w("Private research loaded", "Recherches privées chargées")} · ${records.length} ${w("records", "dossiers")}. ${w("Review citations and conflicts before outreach.", "Consultez les sources et conflits avant toute démarche.")}`
      );
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
    d.innerHTML = `<header><h3>${esc(title)}</h3><button class="icon-button" data-close aria-label="${w("Close", "Fermer")}">×</button></header><div class="dialog-content">${html}</div>`;
    root.append(d);
    d.querySelector("[data-close]").onclick = () => d.close();
    d.addEventListener("close", () => {
      street?.setVisible(false);
      street = null;
      d.remove();
      if(previousFocus?.isConnected)previousFocus.focus();
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
      r.project_name,
      dossierHTML(r, { w, p, analyst, reviewed: reviews.has(id) }),
      (d) => {
        d.querySelector("[data-pin-anchor]")?.addEventListener("click", () => {
          stopGPS();
          anchor = coordinates(r);
          radarOn = true;
          alerted.clear();
          refresh();
          d.close();
        });
        d.querySelector("[data-group]").onclick = () => {
          highlight =
            highlight === contractorKey(r.general_contractor)
              ? ""
              : contractorKey(r.general_contractor);
          paint();
          d.close();
          message(
            highlight
              ? `${w("Highlighting", "Repérage")} ${highlight}`
              : w("Contractor highlight cleared.", "Repérage désactivé.")
          );
        };
        d.querySelector("[data-locate]").onclick = async (e) => {
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
              `https://www.google.com/maps/dir/?api=1&destination=${c.lat},${c.lng}`
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
  function radar() {
    if (!radarOn || (!position && !anchor)) return;
    const origin = position || anchor,
      near = filtered().filter(
        (r) => coordinates(r) && distance(origin, coordinates(r)) <= radius
      );
    const next =
      near.find((r) => !alerted.has(r.lead_id)) ||
      (position
        ? filtered().find(
            (r) =>
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
    if (next) {
      alerted.add(next.lead_id);
      const alert = q(".radar-alert");
      alert.hidden = false;
      alert.innerHTML = `<strong>${w("Nearby research lead", "Piste à proximité")}</strong><span>${esc(next.project_name)} · ${(distance(origin, coordinates(next)) / 1000).toFixed(1)} km</span><button class="button secondary" data-open>${w("Review dossier", "Voir le dossier")}</button><a class="button secondary" href="https://www.google.com/maps/dir/?api=1&destination=${coordinates(next).lat},${coordinates(next).lng}" target="_blank" rel="noopener noreferrer">${w("Directions", "Itinéraire")}</a><button class="text-link" data-dismiss>${w("Dismiss", "Fermer")}</button>`;
      alert.querySelector("[data-open]").onclick = () => openLead(next.lead_id);
      alert.querySelector("[data-dismiss]").onclick = () => {
        alert.hidden = true;
      };
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
    if (watch !== null) navigator.geolocation.clearWatch(watch);
    watch = null;
    position = null;
    radarOn = false;
    anchor = null;
    previousPosition = null;
    paintRadar();
    q("[data-gps]").textContent = w("Start GPS radar", "Activer le radar GPS");
    q("[data-radar-status]").textContent = w(
      "GPS off · foreground use only",
      "GPS désactivé · premier plan uniquement"
    );
    q(".radar-alert").hidden = true;
  }
  q("[data-gps]").onclick = () => {
    if (watch !== null) {
      stopGPS();
      refresh();
      return;
    }
    if (!navigator.geolocation) {
      message(
        w(
          "Geolocation is unavailable. Use a map anchor.",
          "Géolocalisation indisponible. Utilisez le centre de la carte."
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
    q("[data-gps]").textContent = w("Stop GPS radar", "Arrêter le radar GPS");
    watch = navigator.geolocation.watchPosition(
      (p) => {
        if (disposed) return;
        position = {
          lat: p.coords.latitude,
          lng: p.coords.longitude,
          accuracy: p.coords.accuracy,
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
        refresh();
      },
      (e) => {
        stopGPS();
        message(
          e.code === 1
            ? w(
                "Location permission denied. Choose “Use map centre” for a manual anchor; no position has been simulated.",
                "Accès à la position refusé. Utilisez le centre de la carte; aucune position simulée."
              )
            : w(
                "Location unavailable. Try again or use the map centre.",
                "Position indisponible. Réessayez ou utilisez le centre de la carte."
              )
        );
      },
      { enableHighAccuracy: true, maximumAge: 10000, timeout: 20000 }
    );
  };
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
    visibleTiers = TIERS.filter((t) => t !== "Unqualified");
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
      `<label class="check-line"><input type="checkbox" data-analyst ${analyst ? "checked" : ""}> ${w("Analyst view: expand evidence and conflicts", "Vue analyste : développer les preuves et conflits")}</label><p>${w("Turning this off folds the evidence panel; it never removes sources. Preferences are saved only when you apply. GPS and leads are not saved in browser storage.", "Cette option replie les preuves sans les supprimer. Seul « Appliquer » enregistre les préférences. Le GPS et les pistes ne sont pas conservés dans le navigateur.")}</p><button class="button primary" data-apply>${w("Apply & close", "Appliquer et fermer")}</button>`,
      (d) =>
        (d.querySelector("[data-apply]").onclick = () => {
          analyst = d.querySelector("[data-analyst]").checked;
          try {
            localStorage.setItem(
              "sap-map-preferences",
              JSON.stringify({ analyst, radius })
            );
          } catch {}
          d.close();
        })
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
      `<p>${w("Exports contain private business research. Keep them in approved storage. Google location reviews and GPS are session-only and excluded.", "Les exports contiennent des renseignements commerciaux privés. Conservez-les dans un espace autorisé. Les vérifications Google et le GPS ne sont pas exportés.")}</p><div class="map-actions"><button class="button secondary" data-json>JSON · ${records.length}</button><button class="button secondary" data-csv>CSV · ${records.length}</button></div><hr><label class="field"><span>${w("Replace private research register", "Remplacer le registre privé")}</span><input type="file" accept=".json,.csv,application/json,text/csv" data-file></label><p>${w("Review validation and counts before confirming. The current version is preserved in the private audit history.", "Vérifiez la validation et les totaux avant de confirmer. La version actuelle reste dans l’historique privé.")}</p><div data-preview role="status"></div><button class="button primary" data-save disabled>${w("Confirm replacement", "Confirmer le remplacement")}</button>`,
      (d) => {
        d.querySelector("[data-json]").onclick = () =>
          download(
            "sap-private-research.json",
            JSON.stringify(records, null, 2),
            "application/json"
          );
        d.querySelector("[data-csv]").onclick = () =>
          download(
            "sap-private-research.csv",
            csv(records),
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
            records = incoming;
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
    if(map)window.google?.maps.event.clearInstanceListeners(map);
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
    if (engine === "google" && map)
      map.setOptions({
        styles:
          document.documentElement.dataset.theme === "dark"
            ? [
                { elementType: "geometry", stylers: [{ color: "#18243b" }] },
                {
                  elementType: "labels.text.fill",
                  stylers: [{ color: "#adb7ca" }],
                },
                {
                  elementType: "labels.text.stroke",
                  stylers: [{ color: "#18243b" }],
                },
              ]
            : null,
      });
  });
  themeObserver.observe(document.documentElement, {
    attributes: true,
    attributeFilter: ["data-theme"],
  });
  (async () => {
    try {
      const data = await request("/admin/maps/dataset");
      if (!disposed) {
        records = data.records;
        version = data.version;
        populate();
        refresh();
        await initMap("google");
      }
    } catch (e) {
      message(e.message);
    }
  })();
  return () => {
    if (disposed) return;
    disposed = true;
    mapGeneration++;
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
    root.innerHTML = "";
  };
}
