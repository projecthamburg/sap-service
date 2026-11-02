import { contextCopy, discoveryFields } from "./client-context.js";
import { icon } from "./icons.js";
import { escapeHTML as esc, money } from "./utils.js";

const copy = {
  en: {
    title: "Private project inbox",
    intro:
      "Review quotation requests, applications and private supporting files.",
    key: "Private access key",
    signIn: "Open inbox",
    empty: "No submissions received yet.",
    refresh: "Refresh",
    logout: "Sign out",
    unavailable: "The private service is unavailable.",
    denied: "Access was not accepted. Check the private access key.",
    quote: "Quotation request",
    application: "Application",
    files: "Private files",
    download: "Download",
    notes: "Notes",
    availability: "Availability",
    start: "Available from",
    experience: "Years of experience",
    training: "Safety training",
    regions: "Working regions",
    receipt: "Received",
    hint: "The access key is kept only in this tab’s memory. Your private files are never listed publicly.",
    more: "Project / application details",
    error: "The request could not be completed. Please try again.",
    phases: "Cleaning phases",
    area: "Cleanable area",
    range: "Illustrative planning range",
    phone: "Telephone",
    consent: "Consent recorded",
    yes: "Yes",
    sample: "Test submission",
    loadMore: "Load older submissions",
    notification: "Operator email",
    emailStates: {
      queued: "Queued",
      sending: "Sending",
      retrying: "Retry scheduled",
      sent: "Accepted by email provider",
      failed: "Needs operator attention",
      suppressed: "Suppressed for test",
      disabled: "Disabled",
    },
  },
  fr: {
    title: "Boîte de réception privée",
    intro:
      "Consultez les demandes de soumission, candidatures et fichiers de référence privés.",
    key: "Clé d’accès privée",
    signIn: "Ouvrir la boîte",
    empty: "Aucune demande reçue pour le moment.",
    refresh: "Actualiser",
    logout: "Se déconnecter",
    unavailable: "Le service privé n’est pas disponible.",
    denied: "Accès refusé. Vérifiez la clé d’accès privée.",
    quote: "Demande de soumission",
    application: "Candidature",
    files: "Fichiers privés",
    download: "Télécharger",
    notes: "Précisions",
    availability: "Disponibilités",
    start: "Disponible à partir du",
    experience: "Années d’expérience",
    training: "Formation en sécurité",
    regions: "Régions de travail",
    receipt: "Reçue le",
    hint: "La clé reste uniquement en mémoire dans cet onglet. Les fichiers privés ne sont jamais affichés publiquement.",
    more: "Détails du projet / de la candidature",
    error: "La demande n’a pas pu être traitée. Réessayez.",
    phases: "Phases de nettoyage",
    area: "Superficie à nettoyer",
    range: "Fourchette indicative",
    phone: "Téléphone",
    consent: "Consentement enregistré",
    yes: "Oui",
    sample: "Demande de test",
    loadMore: "Charger les demandes précédentes",
    notification: "Courriel à l’opérateur",
    emailStates: {
      queued: "En attente",
      sending: "En cours",
      retrying: "Nouvel essai prévu",
      sent: "Accepté par le fournisseur",
      failed: "Vérification requise",
      suppressed: "Désactivé pour le test",
      disabled: "Désactivé",
    },
  },
};
let accessKey = "";
export function mountInbox(root, language, config, all, options = {}) {
  const t = copy[language];
  root.innerHTML = `<section class="section"><div class="container inbox-container"><a class="text-link" href="#">← ${
    all.careers.back
  }</a><p class="eyebrow">SAP SERVICE INC. / ${
    language === "fr" ? "ACCÈS PRIVÉ" : "PRIVATE ACCESS"
  }</p><h1>${t.title}</h1><p class="section-intro">${
    t.intro
  }</p><div id="inbox-content"></div></div></section>`;
  const content = root.querySelector("#inbox-content");
  function login(error = "") {
    content.innerHTML = `<form class="inbox-login"><label class="field"><span>${
      t.key
    }</span><input name="key" type="password" autocomplete="off" required minlength="32"></label><p class="form-status" role="status">${esc(
      error
    )}</p><button class="button primary" type="submit" ${
      !config.apiUrl ? "disabled" : ""
    }>${t.signIn}${icon("arrow")}</button><p class="fine-print">${
      config.apiUrl ? t.hint : t.unavailable
    }</p></form>`;
    content.querySelector("form").addEventListener("submit", (event) => {
      event.preventDefault();
      accessKey = new FormData(event.currentTarget).get("key").trim();
      load();
    });
  }
  async function request(path, requestOptions = {}) {
    if (options.request) return options.request(path, requestOptions);

    const response = await fetch(config.apiUrl + path, {
      ...requestOptions,
      headers: {
        Authorization: `Bearer ${accessKey}`,
        ...(requestOptions.body ? { "Content-Type": "application/json" } : {}),
      },
      signal: AbortSignal.timeout(20000),
    });
    if (response.status === 401) {
      accessKey = "";
      throw new Error(t.denied);
    }
    if (!response.ok) throw new Error(t.error);
    return response.json();
  }
  function details(record) {
    const payload = record.payload,
      contact = payload.contact || payload;
    let rows = [
      [t.phone, contact.phone || "—"],
      [t.consent, payload.consent ? t.yes : "—"],
    ];
    if (record.kind === "quote") {
      const scope = payload.estimate.scope,
        result = payload.estimate.estimate;
      if (payload.estimate.planReview) {
        const review = payload.estimate.planReview;
        rows.push([
          language === "fr" ? "Vérification du plan" : "Plan review",
          `${review.reference} · ${review.reviewedTileCount}/${
            review.tiles.length
          } · ${
            review.requiresClarification
              ? language === "fr"
                ? "À clarifier"
                : "Clarification needed"
              : language === "fr"
                ? "Vérifié par le visiteur"
                : "Visitor reviewed"
          }`,
        ]);
        for (const d of review.decisions || [])
          rows.push([d.conflictId, `${d.resolution}: ${d.reason}`]);
      }
      const discovery = contextCopy(language);
      if (scope.budget > 0)
        rows.push([discovery.budget, money(scope.budget, language) + " CAD"]);
      if (scope.referredBy) rows.push([discovery.referredBy, scope.referredBy]);
      for (const key of discoveryFields)
        if (scope[key]) rows.push([discovery[key], scope[key]]);
      rows.push(
        [all.estimator.city, `${scope.city}, ${scope.province}`],
        [t.area, `${result.totalSqFt} sq ft`],
        [
          t.phases,
          scope.phases
            .map((p) => all.services.stages.find((s) => s.key === p)?.name || p)
            .join(", "),
        ],
        [all.estimator.cleanDate, scope.cleanDate || "—"],
        [all.estimator.handoverDate, scope.handoverDate || "—"],
        [
          t.range,
          `${money(result.low, language)} – ${money(
            result.high,
            language
          )} CAD`,
        ]
      );
    } else {
      const availability = (payload.availability || [])
        .map((v) => {
          const [day, shift] = v.split("-").map(Number);
          return `${all.careers.days[day]} · ${all.careers.shifts[shift]}`;
        })
        .join("; ");
      rows.push(
        [all.careers.city, `${payload.city}, ${payload.province}`],
        [t.regions, payload.regions],
        [t.experience, payload.experience],
        [all.careers.languages, payload.languages],
        [t.start, payload.start],
        [
          t.training,
          all.careers.aspOptions.find(([k]) => k === payload.asp)?.[1] ||
            payload.asp,
        ],
        [t.availability, availability],
        [all.careers.exact, payload.hours || "—"]
      );
    }
    return `<dl>${rows
      .map(
        ([label, value]) =>
          `<div><dt>${esc(label)}</dt><dd>${esc(value)}</dd></div>`
      )
      .join("")}</dl><p class="inbox-notes">${esc(
      payload.notes || payload.cover || ""
    )}</p>`;
  }
  let records = [],
    cursor = null;
  async function load(append = false) {
    try {
      const data = await request(
        "/admin/submissions" +
          (append && cursor ? "?cursor=" + encodeURIComponent(cursor) : "")
      );
      records = append
        ? [...records, ...data.submissions].filter(
            (r, i, a) => a.findIndex((other) => other.pk === r.pk) === i
          )
        : data.submissions;
      cursor = data.nextCursor;
      data.submissions = records;
      content.innerHTML = `<div class="inbox-toolbar"><span>${
        data.submissions.length
      } ${
        language === "fr" ? "demandes" : "submissions"
      }</span><div><button type="button" class="small-link" data-inbox="refresh">${
        t.refresh
      }${icon(
        "arrow"
      )}</button><button type="button" class="small-link" data-inbox="logout">${
        t.logout
      }</button></div></div><div class="inbox-list">${
        data.submissions.length
          ? data.submissions
              .map((record) => {
                const p = record.payload,
                  contact = p.contact || p;
                return `<article class="inbox-record"><div class="inbox-record-top"><span class="eyebrow">${
                  record.kind === "quote" ? t.quote : t.application
                }${record.isTest ? ` · ${t.sample}` : ""}</span><span>${esc(
                  record.pk
                )}</span></div><h2>${esc(
                  contact.name
                )}</h2><p><a href="mailto:${esc(contact.email)}">${esc(
                  contact.email
                )}</a>${
                  contact.company ? ` · ${esc(contact.company)}` : ""
                }</p><small>${t.receipt}: ${new Date(
                  record.receivedAt || record.createdAt
                ).toLocaleString(all.lang)}</small><p class="fine-print">${
                  t.notification
                }: ${esc(
                  t.emailStates[record.notification?.state] ||
                    record.notification?.state ||
                    "—"
                )}${
                  record.notification?.attempts
                    ? ` · ${record.notification.attempts} ${
                        language === "fr" ? "essai(s)" : "attempt(s)"
                      }`
                    : ""
                }</p><details><summary>${t.more}${icon(
                  "plus"
                )}</summary>${details(record)}</details>${
                  record.files.length
                    ? `<div class="inbox-files"><h3>${
                        t.files
                      }</h3>${record.files
                        .map(
                          (file) =>
                            `<button type="button" data-reference="${esc(
                              record.pk
                            )}" data-file-id="${esc(file.id)}">${icon(
                              "file"
                            )}<span>${esc(file.name)}<small>${Math.ceil(
                              file.size / 1024
                            )} KB</small></span>${icon("download")}</button>`
                        )
                        .join("")}</div>`
                    : ""
                }</article>`;
              })
              .join("")
          : `<p class="inbox-empty">${t.empty}</p>`
      }</div>${
        cursor
          ? `<button type="button" class="button secondary" data-inbox="more">${t.loadMore}</button>`
          : ""
      }<p class="fine-print">${t.hint}</p>`;
      content.querySelector('[data-inbox="refresh"]').onclick = () => load();
      const more = content.querySelector('[data-inbox="more"]');
      if (more)
        more.onclick = () => {
          more.disabled = true;
          load(true);
        };
      content.querySelector('[data-inbox="logout"]').onclick = () => {
        accessKey = "";
        if (options.onLogout) options.onLogout();
        else login();
      };
      content.querySelectorAll("[data-file-id]").forEach((button) =>
        button.addEventListener("click", async () => {
          button.disabled = true;
          try {
            const data = await request("/admin/file-url", {
              method: "POST",
              body: JSON.stringify({
                reference: button.dataset.reference,
                fileId: button.dataset.fileId,
              }),
            });
            const anchor = document.createElement("a");
            anchor.href = data.url;
            anchor.target = "_blank";
            anchor.rel = "noopener noreferrer";
            anchor.click();
          } catch (error) {
            const status = document.createElement("p");
            status.className = "form-status";
            status.setAttribute("role", "status");
            status.textContent = error.message;
            button.after(status);
          } finally {
            button.disabled = false;
          }
        })
      );
    } catch (error) {
      if (options.request) {
        content.innerHTML = `<p role="status">${esc(error.message)}</p><button class="button secondary" data-retry>${t.refresh}</button>`;
        content.querySelector("[data-retry]").onclick = () => load();
      } else login(error.message);
    }
  }
  if ((options.request || accessKey) && config.apiUrl) load();
  else login();
}
