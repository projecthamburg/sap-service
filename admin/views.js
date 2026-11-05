import { escapeHTML as esc } from "../src/utils.js";
import { TIERS, COLORS, point, deadlineLabel } from "./model.js";
import {
  readable,
  companyLabel,
  stageLabel,
  priorityLabel,
  contactOptions,
  fieldDate,
} from "./presentation.js";
const labels = {
  "Project name": "Nom du projet",
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
  return `<div class="maps-heading"><div><p class="eyebrow">${w("MAPS", "CARTES")}</p><h2>${w("Sites & visits", "Sites et visites")}</h2><p>${w("Find a site, get in touch and record your visit.", "Trouvez un site, prenez contact et notez votre visite.")}</p></div><div class="map-actions"><button class="button secondary" data-import>${w("Import / export", "Importer / exporter")}</button><button class="button secondary" data-settings>${w("View options", "Affichage")}</button></div></div><p class="map-status" role="status" aria-live="polite">${w("Loading sites…", "Chargement des sites…")}</p><details class="map-filter-disclosure" data-filter-panel open><summary>${w("Search & filters", "Recherche et filtres")}</summary><div class="map-filters"><label class="field map-search"><span>${w("Search projects, contractors or places", "Chercher un projet, entrepreneur ou lieu")}</span><input type="search" data-search placeholder="${w("Search sites or companies", "Chercher un site ou une entreprise")}" autocomplete="off"></label><label class="field"><span>${w("General contractor", "Entrepreneur général")}</span><select data-gc><option value="">${w("All contractors", "Tous les entrepreneurs")}</option></select></label><label class="field"><span>${w("Project stage", "Étape du projet")}</span><select data-stage><option value="">${w("All stages", "Toutes les étapes")}</option></select></label></div><label class="field visit-filter"><span>${w("Visit status", "État de visite")}</span><select data-visit-filter><option value="">${w("All sites", "Tous les sites")}</option><option value="open">${w("Open", "Ouvert")}</option><option value="visited">${w("Visited", "Visité")}</option><option value="return">${w("Will return", "À revisiter")}</option></select></label><fieldset class="tier-controls"><legend>${w("Follow-up priority", "Priorité de suivi")}</legend>${TIERS.map((t) => `<label><input type="checkbox" value="${t}" ${visibleTiers.includes(t) ? "checked" : ""}><span style="--tier:${COLORS[t]}">${priorityLabel(t, w)} <b data-count="${t}">0</b></span></label>`).join("")}</fieldset><div class="quick-filters" role="group" aria-label="Quick filters"><button class="button secondary" data-quick="frecon">Frecon</button><button class="button secondary" data-quick="healthcare">Healthcare / LTC</button><button class="button secondary" data-quick="axor">AXOR</button><button class="button secondary" data-quick="pomerleau">Pomerleau</button><button class="button secondary" data-inside>${w("Inside radius only", "Dans le rayon seulement")}</button><button class="text-link" data-clear>${w("Clear filters", "Effacer les filtres")}</button></div></details><div class="radar-toolbar"><button class="button primary" data-my-location>${w("My location", "Ma position")}</button><button class="button secondary" data-add-site disabled>${w("Add site here", "Ajouter un site ici")}</button><button class="button secondary" data-gps>${w("Nearby alerts", "Alertes à proximité")}</button><button class="button secondary" data-anchor>${w("Use map centre", "Utiliser le centre de la carte")}</button><button class="text-link" data-stop disabled>${w("Stop radar", "Arrêter le radar")}</button><label>${w("Radius", "Rayon")} <select data-radius><option value="804.672">½ mile · 0.8 km</option><option value="1609.344">1 mile · 1.6 km</option><option value="3218.688">2 miles · 3.2 km</option><option value="8046.72">5 miles · 8 km</option><option value="16093.44">10 miles · 16 km</option></select></label><button class="text-link" data-notifications>${w("Device notifications", "Notifications système")}</button><span data-radar-status>${w("GPS off · foreground use only", "GPS désactivé · premier plan uniquement")}</span></div><div class="map-view-controls" role="group" aria-label="Map layout"><button class="button secondary" data-layout="split" aria-pressed="true">${w("Split view", "Vue combinée")}</button><button class="button secondary" data-layout="map" aria-pressed="false">${w("Map", "Carte")}</button><button class="button secondary" data-layout="list" aria-pressed="false">${w("List", "Liste")}</button></div><p class="map-deadline-note" hidden></p><div class="map-layout" data-layout="split"><aside class="lead-sidebar" aria-label="${w("Lead results", "Résultats")}"><div class="lead-results" role="status"></div><div class="lead-list"></div></aside><section class="map-panel" aria-label="${w("Lead map", "Carte des pistes")}"><div class="map-engine"><label>${w("Map provider", "Fournisseur")} <select data-engine><option value="google">Google Maps</option><option value="leaflet">OpenStreetMap ${w("fallback", "secours")}</option></select></label><button class="text-link" data-fit>${w("Fit results", "Voir les résultats")}</button></div><div class="map-canvas" role="region" aria-label="${w("Interactive opportunity map", "Carte interactive des opportunités")}"></div><p class="map-coordinate-note">${w("Pins are research estimates. No locations are invented for multi-site projects.", "Les points sont des estimations de recherche. Aucun lieu n’est inventé pour les projets multisites.")}</p></section></div><div class="radar-alert" role="status" aria-live="polite" hidden></div>`;
}
export function dossierHTML(
  r,
  { w, p, analyst, reviewed, driveURL, visitState = "open", workflow }
) {
  const text = (label, value) =>
    value
      ? `<div class="dossier-field"><dt>${esc(w(label, labels[label] || label))}</dt><dd>${esc(Array.isArray(value) ? value.join(" · ") : String(value))}</dd></div>`
      : "";
  const clean = (label, value) =>
    text(
      label,
      readable(Array.isArray(value) ? value.join(" · ") : value || "").replace(
        /\bUNCONFIRMED\b/g,
        w("not yet checked", "à vérifier")
      )
    );
  const citations = (items) =>
    `<ul>${(items || []).map((s) => `<li>${citationHTML(s)}</li>`).join("")}</ul>`;
  const contacts = contactOptions(r),
    company = companyLabel(r, w);
  const states = {
    open: ["Open", "Ouvert"],
    visited: ["Visited", "Visité"],
    return: ["Will return", "À revisiter"],
  };
  const status = w(...(states[visitState] || states.open));
  const address = readable(r.site_address),
    city = readable(r.city);
  const location =
    !address ||
    /^(?:address to confirm|unknown|not identified|to confirm)/i.test(address)
      ? city && !/^to confirm/i.test(city)
        ? city
        : w("Saved map location", "Position enregistrée")
      : address;
  const date = fieldDate(r.follow_up_date || r.deadline, w);
  const buttons = [
    p
      ? `<a class="button primary" data-route href="${esc(driveURL || "https://www.google.com/maps/dir/?api=1&destination=" + p.lat + "," + p.lng + "&travelmode=driving&dir_action=navigate")}" target="_blank" rel="noopener noreferrer">${w("Drive", "Itinéraire")}</a>`
      : "",
    contacts.phones[0]
      ? `<a class="button secondary" href="${esc(contacts.phones[0].href)}" aria-label="${esc(w("Call listed contact", "Appeler le contact indiqué"))}">${w("Call", "Appeler")}</a>`
      : "",
    contacts.emails[0]
      ? `<a class="button secondary" href="${esc(contacts.emails[0].href)}">${w("Email", "Courriel")}</a>`
      : "",
  ].join("");
  return `<article class="site-card" data-record-id="${esc(r.lead_id)}">
    <p class="site-card-address" data-card-address><span>${esc(location)}${city && !location.includes(city) && !/^to confirm/i.test(city) ? ` · ${esc(city)}` : ""}</span>${r.location_audit ? `<small>${w("Location audit", "Lieu audité")} · ${esc(fieldDate(r.location_audit.date, w))}</small>` : p && !r.isFieldSite && !reviewed ? `<small>${w("Approximate map location", "Position approximative sur la carte")}</small>` : ""}</p>
    <div class="site-card-quick-actions" data-card-actions>${buttons}</div>
    <section class="field-workflow">
      <div class="visit-state"><span>${w("Visit status", "État de visite")}</span><strong>${status}</strong></div>
      <div class="visit-actions" role="group" aria-label="${esc(w("Update visit", "Mettre à jour la visite"))}">
        ${visitState !== "visited" ? `<button class="button secondary" data-set-visit="visited">${w("Mark visited", "Visité")}</button>` : ""}
        ${visitState !== "return" ? `<button class="button secondary" data-set-visit="return">${w("Will return", "À revisiter")}</button>` : ""}
        ${visitState !== "open" ? `<button class="button secondary" data-set-visit="open">${w("Reopen", "Rouvrir")}</button>` : ""}
      </div>
      <details class="visit-notes"><summary>${workflow?.notes ? w("Visit note", "Note de visite") : w("Add a note", "Ajouter une note")}${workflow?.notes ? `<span class="visit-note-preview">${esc(workflow.notes)}</span>` : ""}</summary><label class="field"><span>${w("Note / next visit", "Note / prochaine visite")}</span><textarea data-visit-notes maxlength="4000" rows="2">${esc(workflow?.notes || "")}</textarea></label><button class="button secondary" data-set-visit="${visitState}" data-save-note>${w("Save note", "Enregistrer la note")}</button></details>
      <p data-work-status role="status"></p>
    </section>
    <dl class="site-quick-facts"><div><dt>${w("Company", "Entreprise")}</dt><dd>${company !== w("Not listed", "Non indiqué") ? `<button class="site-company" data-group title="${esc(w("See this company’s other sites", "Voir les autres sites de cette entreprise"))}">${esc(company)}</button>` : esc(company)}</dd></div><div><dt>${w("Project stage", "Étape du projet")}</dt><dd>${esc(stageLabel(r.location_audit?.status || r.project_stage, w))}</dd></div>${date ? `<div><dt>${r.follow_up_date ? w("Follow-up", "Suivi") : w("Tender date", "Date d’appel d’offres")}</dt><dd>${esc(date)}</dd></div>` : ""}</dl>

    <details class="site-record" data-full-record ${analyst ? "open" : ""}><summary>${w("Project details", "Détails du projet")}</summary>
      <dl>${clean("Description", r.project_description)}${clean("Cleaning scope", r.cleaning_specifics)}${clean("Address", r.site_address)}${clean("City / region", [r.city, r.region].filter(Boolean))}${clean("Contact", [r.contact_name, r.contact_role, r.contact_company].filter(Boolean))}</dl>
      <div class="dossier-actions">${[...contacts.phones, ...contacts.emails].map((c) => `<a class="button secondary" href="${esc(c.href)}">${esc(c.label)}</a>`).join("")}</div>
      <div class="dossier-actions">${p ? `<button class="button secondary" data-street>Street View</button><button class="button secondary" data-pin-anchor>${w("Set nearby area here", "Centrer la zone ici")}</button>` : ""}<button class="button secondary" data-locate ${r.location_audit ? `disabled title="${esc(w("Audited coordinates are retained", "Les coordonnées auditées sont conservées"))}"` : ""}>${w("Check address on Google", "Vérifier l’adresse avec Google")}</button></div>
      <p data-location-status role="status">${r.location_audit ? w("The supplied audit coordinates are retained. Address lookup cannot replace this point.", "Les coordonnées de l’audit sont conservées. La recherche d’adresse ne remplace pas ce point.") : reviewed ? w("Address located this session.", "Adresse repérée pour cette session.") : ""}</p><div data-street-view></div>
      <details class="internal-record" data-original-record ${analyst ? "open" : ""}><summary>${r.isFieldSite ? w("Saved site record", "Dossier du site enregistré") : w("Original research record", "Dossier de recherche original")}</summary>
      <p class="research-meta">${esc(r.lead_id)} · ${esc(r.priority)} · ${r.opportunity_score}/100</p>
      <p class="evidence-note">${w("These are potential opportunities. Check the project, location and cleaning scope before making commitments.", "Il s’agit d’occasions potentielles. Vérifiez le projet, le lieu et la portée du nettoyage avant de vous engager.")}</p>
      <h4>${w("Project", "Projet")}</h4><dl>${text("Project name", r.project_name)}${text("Project type", r.project_type)}${text("Owner / developer", r.owner_developer)}${text("General contractor", r.general_contractor)}${text("Stage", r.project_stage)}${text("Description", r.project_description)}${text("Cleaning scope", r.cleaning_specifics)}</dl>
      <h4>${w("Location", "Lieu")}</h4><dl>${text("Address", r.site_address)}${text("City / region", `${r.city} · ${r.region}`)}${text("Location notes", r.site_location_description)}${text("Coordinate basis", r.coordinates_basis)}${text("Research coordinates", point(r) ? `${r.latitude_estimate}, ${r.longitude_estimate}` : "Not located")}</dl>      <h4>${w("Contacts", "Contacts")}</h4><dl>${text("Procurement chain", r.procurement_chain)}${text("Contact", [r.contact_name, r.contact_role, r.contact_company].filter(Boolean).join(" · "))}${text("Emails", r.emails)}${text("Telephones", r.telephones)}</dl><div class="dossier-actions">${[...contacts.phones, ...contacts.emails].map((c) => `<a class="button secondary" href="${esc(c.href)}">${esc(c.label)}</a>`).join("")}</div>
      <h4>${w("Dates & next steps", "Dates et prochaines étapes")}</h4><dl>${text("Start date", r.start_date)}${text("Deadline", deadlineLabel(r.deadline))}${text("Deadline meaning", r.deadline_type)}${text("Follow-up", deadlineLabel(r.follow_up_date))}${text("Timeline notes", r.timeline_notes)}${text("Next action", r.next_action)}</dl>
      <h4>${w("Internal research", "Recherche interne")}</h4><dl>${text("Evidence confidence", r.evidence_confidence)}${text("Assessment", r.argon_view)}</dl><details><summary>${w("Sources & review notes", "Sources et notes de vérification")}</summary>${r.conflicts?.length ? citations(r.conflicts) : ""}${citations(r.sources)}${citations(r.source_ids)}</details>
      </details>
    </details>
  </article>`;
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
