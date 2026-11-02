import { escapeHTML as esc } from "../src/utils.js";
import { TIERS, COLORS, point, deadlineLabel } from "./model.js";
const labels = {
  "Project type": "Type de projet",
  "Owner / developer": "Propriétaire / promoteur",
  "General contractor": "Entrepreneur général",
  Stage: "Étape",
  Description: "Description",
  "Cleaning scope": "Portée du nettoyage",
  Address: "Adresse",
  "City / region": "Ville et région",
  "Location notes": "Notes de localisation",
  "Coordinate basis": "Origine des coordonnées",
  "Research coordinates": "Coordonnées de recherche",
  "Procurement chain": "Chaîne d’approvisionnement",
  Contact: "Contact",
  Emails: "Courriels",
  Telephones: "Téléphones",
  "Start date": "Date de début",
  Deadline: "Échéance",
  "Deadline meaning": "Signification de l’échéance",
  "Follow-up": "Suivi",
  "Timeline notes": "Notes de calendrier",
  "Next action": "Prochaine action",
  "Evidence confidence": "Confiance dans les preuves",
  Assessment: "Analyse",
};
export function mapShell(w, visibleTiers) {
  return `<div class="maps-heading"><div><p class="eyebrow">${w("PRIVATE FIELD INTELLIGENCE", "RENSEIGNEMENT TERRAIN PRIVÉ")}</p><h2>${w("Opportunity map", "Carte des opportunités")}</h2><p>${w("Research leads, with evidence in view. Confirm scope, timing and contacts before outreach.", "Pistes de recherche et pièces à l’appui. Confirmez la portée, les dates et les contacts avant toute démarche.")}</p></div><div class="map-actions"><button class="button secondary" data-import>${w("Import / export", "Importer / exporter")}</button><button class="button secondary" data-settings>${w("View options", "Affichage")}</button></div></div><p class="map-status" role="status" aria-live="polite">${w("Loading private research…", "Chargement des recherches privées…")}</p><div class="map-filters"><label class="field map-search"><span>${w("Search projects, contractors or places", "Chercher un projet, entrepreneur ou lieu")}</span><input type="search" data-search placeholder="${w("Search the research register", "Chercher dans le registre")}" autocomplete="off"></label><label class="field"><span>${w("General contractor", "Entrepreneur général")}</span><select data-gc><option value="">${w("All contractors", "Tous les entrepreneurs")}</option></select></label><label class="field"><span>${w("Project stage", "Étape du projet")}</span><select data-stage><option value="">${w("All stages", "Toutes les étapes")}</option></select></label></div><fieldset class="tier-controls"><legend>${w("Priority tiers", "Niveaux de priorité")}</legend>${TIERS.map((t) => `<label><input type="checkbox" value="${t}" ${visibleTiers.includes(t) ? "checked" : ""}><span style="--tier:${COLORS[t]}">${t} <b data-count="${t}">0</b></span></label>`).join("")}</fieldset><div class="quick-filters" role="group" aria-label="Quick filters"><button class="button secondary" data-quick="frecon">Frecon</button><button class="button secondary" data-quick="healthcare">Healthcare / LTC</button><button class="button secondary" data-quick="axor">AXOR</button><button class="button secondary" data-quick="pomerleau">Pomerleau</button><button class="button secondary" data-inside>${w("Inside radius only", "Dans le rayon seulement")}</button><button class="text-link" data-clear>${w("Clear filters", "Effacer les filtres")}</button></div><div class="radar-toolbar"><button class="button secondary" data-gps>${w("Start GPS radar", "Activer le radar GPS")}</button><button class="button secondary" data-anchor>${w("Use map centre", "Utiliser le centre de la carte")}</button><button class="text-link" data-stop disabled>${w("Stop radar", "Arrêter le radar")}</button><label>${w("Radius", "Rayon")} <select data-radius><option value="800">0.8 km</option><option value="1600">1.6 km</option><option value="3200">3.2 km</option><option value="8000">8 km</option></select></label><span data-radar-status>${w("GPS off · foreground use only", "GPS désactivé · premier plan uniquement")}</span></div><div class="map-view-controls" role="group" aria-label="Map layout"><button class="button secondary" data-layout="split" aria-pressed="true">${w("Split view", "Vue combinée")}</button><button class="button secondary" data-layout="map" aria-pressed="false">${w("Map", "Carte")}</button><button class="button secondary" data-layout="list" aria-pressed="false">${w("List", "Liste")}</button></div><p class="map-deadline-note" hidden></p><div class="map-layout" data-layout="split"><aside class="lead-sidebar" aria-label="${w("Lead results", "Résultats")}"><div class="lead-results" role="status"></div><div class="lead-list"></div></aside><section class="map-panel" aria-label="${w("Lead map", "Carte des pistes")}"><div class="map-engine"><label>${w("Map provider", "Fournisseur")} <select data-engine><option value="google">Google Maps</option><option value="leaflet">OpenStreetMap ${w("fallback", "secours")}</option></select></label><button class="text-link" data-fit>${w("Fit results", "Voir les résultats")}</button></div><div class="map-canvas" role="region" aria-label="${w("Interactive opportunity map", "Carte interactive des opportunités")}"></div><p class="map-coordinate-note">${w("Pins are research estimates. No locations are invented for multi-site projects.", "Les points sont des estimations de recherche. Aucun lieu n’est inventé pour les projets multisites.")}</p></section></div><div class="radar-alert" role="status" aria-live="polite" hidden></div>`;
}
export function dossierHTML(r, { w, p, analyst, reviewed }) {
  const text = (label, value) =>
    value
      ? `<div class="dossier-field"><dt>${esc(w(label, labels[label] || label))}</dt><dd>${esc(Array.isArray(value) ? value.join(" · ") : String(value))}</dd></div>`
      : "";
  const citations = (items) =>
    `<ul>${(items || []).map((s) => `<li>${citationHTML(s)}</li>`).join("")}</ul>`;
  return `<p class="eyebrow">${esc(r.lead_id)} / ${esc(r.priority)} / ${r.opportunity_score}/100</p><p class="evidence-note">${w("Research opportunity, not a confirmed contract. Location estimates and commercial evidence require separate review.", "Piste de recherche, pas un contrat confirmé. Les lieux et les renseignements commerciaux nécessitent des vérifications distinctes.")}</p><div class="dossier-actions"><button class="button secondary" data-group>${w("Highlight same contractor", "Repérer le même entrepreneur")}</button>${p ? `<a class="button secondary" data-route href="https://www.google.com/maps/dir/?api=1&destination=${p.lat},${p.lng}" target="_blank" rel="noopener noreferrer">${w("Directions", "Itinéraire")}</a><button class="button secondary" data-street>Street View</button><button class="button secondary" data-pin-anchor>${w("Anchor radius here", "Centrer le rayon ici")}</button>` : ""}<button class="button secondary" data-locate>${w("Review address on Google", "Vérifier l’adresse avec Google")}</button></div><p class="evidence-note">${w("Confirm SAP staffing, insurance, certifications and equipment for this scope before quoting.", "Confirmez les effectifs, assurances, certifications et équipements de SAP pour cette portée avant de soumissionner.")}</p><div class="dossier-actions">${(
    r.telephones || []
  )
    .filter((n) => /^[+0-9(). ext#-]+$/i.test(n))
    .map(
      (n) =>
        `<a class="button secondary" href="tel:${esc(n.replace(/[^+0-9]/g, ""))}">${esc(n)}</a>`
    )
    .join("")}${(r.emails || [])
    .filter((e) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e))
    .map(
      (e) =>
        `<a class="button secondary" href="mailto:${esc(e)}?subject=${encodeURIComponent(r.project_name)}">${esc(e)}</a>`
    )
    .join(
      ""
    )}<a class="button secondary" href="https://schedule.projecthamburg.com/booking/sap-service-cleanup" target="_blank" rel="noopener noreferrer">${w("Arrange consultation", "Organiser une consultation")}</a></div><h4>A · ${w("Project & delivery", "Projet et livraison")}</h4><dl>${text("Project type", r.project_type)}${text("Owner / developer", r.owner_developer)}${text("General contractor", r.general_contractor)}${text("Stage", r.project_stage)}${text("Description", r.project_description)}${text("Cleaning scope", r.cleaning_specifics)}</dl><h4>B · ${w("Location", "Lieu")}</h4><dl>${text("Address", r.site_address)}${text("City / region", `${r.city} · ${r.region}`)}${text("Location notes", r.site_location_description)}${text("Coordinate basis", r.coordinates_basis)}${text("Research coordinates", point(r) ? `${r.latitude_estimate}, ${r.longitude_estimate}` : "Not located")}</dl><p data-location-status role="status">${reviewed ? w("Address located by Google this session. Commercial evidence is unchanged.", "Adresse repérée par Google pour cette session. Les preuves commerciales restent inchangées.") : ""}</p><div data-street-view></div><h4>C · ${w("People & procurement", "Contacts et approvisionnement")}</h4><dl>${text("Procurement chain", r.procurement_chain)}${text("Contact", `${[r.contact_name, r.contact_role, r.contact_company].filter(Boolean).join(" · ") || w("Not identified in research", "Non identifié dans les recherches")}`)}${text("Emails", r.emails)}${text("Telephones", r.telephones)}</dl><h4>D · ${w("Timing & next action", "Calendrier et prochaine étape")}</h4><dl>${text("Start date", r.start_date)}${text("Deadline", deadlineLabel(r.deadline))}${text("Deadline meaning", r.deadline_type)}${text("Follow-up", deadlineLabel(r.follow_up_date))}${text("Timeline notes", r.timeline_notes)}${text("Next action", r.next_action)}</dl><h4>E · ${w("Analyst assessment", "Analyse")}</h4><dl>${text("Evidence confidence", r.evidence_confidence)}${text("Assessment", r.argon_view)}</dl><details ${analyst ? "open" : ""}><summary>F · ${w("Sources & conflicts", "Sources et conflits")} (${r.sources?.length || 0} / ${r.conflicts?.length || 0})</summary><h4>${w("Conflicting claims / review notes", "Divergences et notes")}</h4>${r.conflicts?.length ? citations(r.conflicts) : `<p>${w("No conflicts recorded. This does not establish independent verification.", "Aucun conflit consigné. Cela ne constitue pas une vérification indépendante.")}</p>`}<h4>${w("Research citations", "Références de recherche")}</h4>${citations(r.sources)}${citations(r.source_ids)}</details>`;
}

function citationHTML(value) {
  return value
    .split(/(https?:\/\/[^\s<>"']+)/g)
    .map((part) => {
      if (!/^https?:\/\//.test(part)) return esc(part);
      const url = part.replace(/[),.;]+$/, "");
      return `<a href="${esc(url)}" target="_blank" rel="noopener noreferrer">${esc(url)}</a>${esc(part.slice(url.length))}`;
    })
    .join("");
}
