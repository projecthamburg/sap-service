import * as pdfjs from "pdfjs-dist/build/pdf.mjs";
import {
  planTiles,
  coverageAudit,
  comparePlanScope,
  planScopeFingerprint,
  reviewDecisionsValid,
  PLAN_PROTOCOL,
} from "./plan-geometry.js";
import { escapeHTML as esc } from "./utils.js";
pdfjs.GlobalWorkerOptions.workerSrc = new URL(
  "./vendor/pdfjs/pdf.worker.min.mjs",
  document.baseURI
).href;
const pause = () => new Promise((r) => setTimeout(r, 0));
const blob = (canvas) =>
  new Promise((resolve, reject) =>
    canvas.toBlob(
      (b) => (b ? resolve(b) : reject(Error("Image encoding failed"))),
      "image/png"
    )
  );
const canvas = (width, height) =>
  Object.assign(document.createElement("canvas"), { width, height });
const hash = async (bytes) =>
  [...new Uint8Array(await crypto.subtle.digest("SHA-256", bytes))]
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
export async function renderPlanFile(file, pageNumber = 1) {
  const bytes = await file.arrayBuffer();
  let surface,
    pageCount = 1,
    dpi = null;
  if (file.type === "application/pdf" || /\.pdf$/i.test(file.name)) {
    const documentTask = pdfjs.getDocument({
      data: new Uint8Array(bytes.slice(0)),
      isEvalSupported: false,
      enableXfa: false,
      standardFontDataUrl: new URL(
        "./vendor/pdfjs/standard_fonts/",
        document.baseURI
      ).href,
      cMapUrl: new URL("./vendor/pdfjs/cmaps/", document.baseURI).href,
      cMapPacked: true,
      wasmUrl: new URL("./vendor/pdfjs/wasm/", document.baseURI).href,
    });
    const pdf = await documentTask.promise;
    try {
      pageCount = pdf.numPages;
      if (pageCount > 200 || pageNumber < 1 || pageNumber > pageCount)
        throw Error("Choose a page in a PDF of up to 200 pages.");
      const page = await pdf.getPage(pageNumber),
        v = page.getViewport({ scale: 150 / 72 });
      planTiles(Math.ceil(v.width), Math.ceil(v.height));
      surface = canvas(Math.ceil(v.width), Math.ceil(v.height));
      const ctx = surface.getContext("2d");
      ctx.fillStyle = "white";
      ctx.fillRect(0, 0, surface.width, surface.height);
      await page.render({ canvasContext: ctx, viewport: v }).promise;
      dpi = 150;
    } finally {
      await documentTask.destroy();
    }
  } else {
    const image = await createImageBitmap(
      new Blob([bytes], { type: file.type })
    );
    try {
      planTiles(image.width, image.height);
      surface = canvas(image.width, image.height);
      const ctx = surface.getContext("2d");
      ctx.fillStyle = "white";
      ctx.fillRect(0, 0, image.width, image.height);
      ctx.drawImage(image, 0, 0);
    } finally {
      image.close();
    }
  }
  const source = {
    name: file.name,
    size: file.size,
    sha256: await hash(bytes),
    page: pageNumber,
    pageCount,
    width: surface.width,
    height: surface.height,
    dpi,
  };
  const geometry = planTiles(surface.width, surface.height),
    scale = Math.min(1, 1200 / Math.max(surface.width, surface.height)),
    overview = canvas(
      Math.max(1, Math.round(surface.width * scale)),
      Math.max(1, Math.round(surface.height * scale))
    );
  overview
    .getContext("2d")
    .drawImage(surface, 0, 0, overview.width, overview.height);
  const parts = [],
    coreHashes = [];
  // Reassemble ownership cores from decoded PNG tiles, preserving overlap only
  // as context. Hash comparisons establish browser-local lossless fidelity.
  for (const tile of geometry) {
    const original = surface
      .getContext("2d")
      .getImageData(
        tile.core.x,
        tile.core.y,
        tile.core.width,
        tile.core.height
      );
    const sourceCoreSha256 = await hash(original.data),
      piece = canvas(tile.width, tile.height),
      ctx = piece.getContext("2d");
    ctx.drawImage(
      surface,
      tile.x,
      tile.y,
      tile.width,
      tile.height,
      0,
      0,
      tile.width,
      tile.height
    );
    const encoded = await blob(piece),
      decoded = await createImageBitmap(encoded);
    ctx.clearRect(0, 0, piece.width, piece.height);
    ctx.drawImage(decoded, 0, 0);
    decoded.close();
    const ox = tile.core.x - tile.x,
      oy = tile.core.y - tile.y,
      decodedCoreSha256 = await hash(
        ctx.getImageData(ox, oy, tile.core.width, tile.core.height).data
      );
    if (sourceCoreSha256 !== decodedCoreSha256)
      throw Error(
        "The local tile fidelity check failed. Use manual measurements."
      );
    overview
      .getContext("2d")
      .drawImage(
        piece,
        ox,
        oy,
        tile.core.width,
        tile.core.height,
        tile.core.x * scale,
        tile.core.y * scale,
        tile.core.width * scale,
        tile.core.height * scale
      );
    coreHashes.push({ id: tile.id, sourceCoreSha256, decodedCoreSha256 });
    parts.push({ id: tile.id, blob: encoded });
    piece.width = piece.height = 1;
    await pause();
  }
  parts.unshift({ id: "overview", blob: await blob(overview) });
  source.fidelity = {
    method: "Browser-local PNG ownership-core SHA-256 comparison",
    verifiedCoreCount: coreHashes.length,
    coreHashes,
  };
  surface.width = surface.height = 1;
  overview.width = overview.height = 1;
  if (
    parts.some((p) => p.blob.size > 2 * 1024 * 1024) ||
    parts.reduce((s, p) => s + p.blob.size, 0) > 64 * 1024 * 1024
  )
    throw Error(
      "This page produces oversized review images. Export a simpler plan page and try again."
    );
  return {
    source,
    tiles: geometry,
    parts,
    coverage: coverageAudit(source.width, source.height, geometry),
  };
}
export function createPlanReview({
  files,
  getScope,
  config,
  language,
  onConfirm,
}) {
  const fr = language === "fr",
    say = (en, french) => (fr ? french : en);
  let root,
    prepared = null,
    report = null,
    rendered = null,
    sourceFile = null,
    pdfPage = 1,
    busy = false,
    message = "",
    error = "",
    wholeProject = false,
    linksByIndex = {},
    decisions = {},
    selectedTile = "overview";
  const urls = new Map();
  const url = (id) => {
    if (!urls.has(id)) {
      const p = rendered?.parts.find((p) => p.id === id);
      if (p) urls.set(id, URL.createObjectURL(p.blob));
    }
    return urls.get(id) || "";
  };
  const release = () => {
    for (const u of urls.values()) URL.revokeObjectURL(u);
    urls.clear();
  };
  const comparison = () => {
    const scope = getScope(),
      links = {};
    for (const [id, index] of Object.entries(linksByIndex))
      if (scope.rooms[index]) links[id] = scope.rooms[index].id;
    return comparePlanScope(report?.claims || [], scope, {
      wholeProject,
      links,
      geometryWarnings: report?.discardedGeometryClaims || 0,
    });
  };
  const fmt = (n) =>
    n === null || n === undefined
      ? "?"
      : new Intl.NumberFormat(fr ? "fr-CA" : "en-CA", {
          maximumFractionDigits: 2,
        }).format(n);
  const label = (code) =>
    ({
      "ambiguous-plan-room": say(
        "Repeated room label needs verification; possible duplicate tile reading",
        "Libellé répété à vérifier; doublon de lecture possible"
      ),
      "possible-zero": say(
        "Possible missing or extra zero",
        "Zéro manquant ou en trop possible"
      ),
      "possible-unit": say(
        "Possible unit mismatch",
        "Unités possiblement incohérentes"
      ),
      "area-mismatch": say(
        "Entered area differs from plan",
        "Superficie saisie différente du plan"
      ),
      "uncertain-plan-reading": say(
        "Printed measurement needs verification",
        "Mesure imprimée à vérifier"
      ),
      "unmatched-plan-room": say(
        "Link this plan room or explain its scope",
        "Associez cette pièce ou précisez la portée"
      ),
      "room-linked-twice": say(
        "Two plan rooms link to one entered room",
        "Deux pièces du plan sont associées à la même pièce"
      ),
      "unmatched-entered-room": say(
        "Entered room has no linked plan reading",
        "Pièce saisie sans mesure associée sur le plan"
      ),
    }[code] || code);
  async function api(action, body) {
    const r = await fetch(
      config.planReviewApiUrl + "/v1/plan-review/" + action,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
        signal: AbortSignal.timeout(115000),
      }
    );
    const d = await r.json();
    if (!r.ok)
      throw Error(
        d.error ||
          say(
            "Review unavailable. Continue with manual measurements.",
            "Analyse indisponible. Continuez avec des mesures vérifiées manuellement."
          )
      );
    return d;
  }
  function draw() {
    if (!root?.isConnected) return;
    const candidates = files().filter((f) =>
        /\.(pdf|jpe?g|png|webp)$/i.test(f.name)
      ),
      scope = getScope(),
      c = report ? comparison() : null;
    root.innerHTML = `<div class="plan-review-panel"><div class="form-subheading"><h4>${say(
      "Plan review · optional",
      "Vérification du plan · facultative"
    )}</h4><button type="button" class="small-link" data-plan="discard" ${
      busy ? "disabled" : ""
    }>${say(
      "Continue with manual measurements",
      "Continuer avec des mesures manuelles"
    )}</button></div><p>${say(
      "Review one selected page using overlapping image tiles. Printed dimensions remain subject to your verification; this does not measure a drawing to scale.",
      "Analysez une page choisie à l’aide de tuiles d’image avec recouvrement. Les dimensions imprimées restent à vérifier; le dessin n’est pas mesuré à l’échelle."
    )}</p><div class="form-grid"><label class="field"><span>${say(
      "Plan file",
      "Fichier du plan"
    )}</span><select name="plan.source" ${busy ? "disabled" : ""}>${candidates
      .map(
        (f, i) =>
          `<option value="${i}" ${f === sourceFile ? "selected" : ""}>${esc(
            f.name
          )}</option>`
      )
      .join("")}</select></label><label class="field"><span>${say(
      "Page number",
      "Numéro de page"
    )}</span><input name="plan.page" type="number" min="1" max="200" value="${pdfPage}" ${
      busy ? "disabled" : ""
    }></label></div><button type="button" class="button outline" data-plan="preview" ${
      busy || !candidates.length ? "disabled" : ""
    }>${say(
      "Preview page and tile coverage",
      "Voir la page et le recouvrement"
    )}</button>${
      rendered
        ? `<p class="fine-print">${esc(rendered.source.name)} · ${say(
            "Page",
            "Page"
          )} ${rendered.source.page}/${rendered.source.pageCount} · ${
            rendered.source.width
          } × ${rendered.source.height} px${
            rendered.source.dpi ? " · " + rendered.source.dpi + " DPI" : ""
          } · ${rendered.tiles.length} ${say(
            "tiles, 128 px overlap padding",
            "tuiles, marge de recouvrement de 128 px"
          )}. ${say(
            "Other pages are not reviewed.",
            "Les autres pages ne sont pas analysées."
          )}</p><div class="plan-map"><img src="${url("overview")}" alt="${say(
            "Original selected page with tile ownership grid",
            "Page choisie avec grille des tuiles"
          )}"><svg viewBox="0 0 ${rendered.source.width} ${
            rendered.source.height
          }" aria-hidden="true">${rendered.tiles
            .map(
              (t) =>
                `<rect x="${t.core.x}" y="${t.core.y}" width="${
                  t.core.width
                }" height="${
                  t.core.height
                }" fill="none" stroke="#bc2345" stroke-width="${Math.max(
                  2,
                  rendered.source.width / 700
                )}"/>`
            )
            .join("")}</svg></div><div class="plan-tiles" aria-label="${say(
            "Inspect a padded tile",
            "Inspecter une tuile avec sa marge"
          )}">${rendered.parts
            .map(
              (p) =>
                `<button type="button" data-tile="${p.id}" aria-pressed="${
                  p.id === selectedTile
                }">${
                  p.id === "overview" ? say("Whole page", "Page entière") : p.id
                }</button>`
            )
            .join("")}</div>${
            selectedTile !== "overview"
              ? `<img class="plan-tile-detail" src="${url(
                  selectedTile
                )}" alt="${say(
                  "Padded tile",
                  "Tuile avec marge"
                )} ${selectedTile}"><a class="small-link" href="${url(
                  selectedTile
                )}" target="_blank" rel="noopener">${say(
                  "Open full-resolution tile",
                  "Ouvrir la tuile en pleine résolution"
                )}</a>`
              : ""
          }${
            !report
              ? `<label class="checkbox-row plan-consent"><input type="checkbox" name="plan.consent" ${
                  busy ? "checked disabled" : ""
                }><span>${say(
                  "I authorize processing this selected page through OpenAI for an optional AI-assisted review. Page images use private storage and expire after 7 days; processing may occur outside Canada. No other selected files are sent for this review.",
                  "J’autorise le traitement de cette page choisie par OpenAI pour une vérification facultative assistée par IA. Les images privées expirent après 7 jours; le traitement peut avoir lieu hors du Canada. Les autres fichiers sélectionnés ne sont pas transmis pour cette analyse."
                )}</span></label><button type="button" class="button primary" data-plan="run" ${
                  busy ? "disabled" : ""
                }>${
                  prepared
                    ? say("Resume page review", "Reprendre la vérification")
                    : say(
                        "Review printed measurements",
                        "Vérifier les mesures imprimées"
                      )
                }</button>`
              : ""
          }`
        : ""
    }<p class="form-status" role="status">${esc(message)}</p>${
      error ? `<p class="form-error" role="alert">${esc(error)}</p>` : ""
    }${
      report
        ? `<div class="plan-report"><h4>${say(
            "Match the plan to your scope",
            "Associer le plan à votre portée"
          )}</h4><p class="fine-print">${report.reviewedTileCount}/${
            report.tiles.length
          } ${say("tiles reviewed", "tuiles analysées")} · ${esc(
            report.model
          )} · ${esc(report.reference)}. ${say(
            "Complete tile coverage does not prove that every room or number was recognized. Check the original page, room count and units.",
            "Le recouvrement complet ne prouve pas que toutes les pièces ou mesures ont été reconnues. Vérifiez la page originale, le nombre de pièces et les unités."
          )}</p>${
            scope.mode === "project"
              ? `<label class="checkbox-row"><input type="checkbox" name="plan.wholeProject" ${
                  wholeProject ? "checked" : ""
                }><span>${say(
                  "This selected page includes all rooms in the project I entered; compare their printed total with my cleanable area.",
                  "Cette page comprend toutes les pièces du projet saisi; comparer leur total imprimé avec ma superficie nettoyable."
                )}</span></label>`
              : ""
          }<div class="plan-claim-list">${report.claims
            .filter((x) => x.kind === "room")
            .map(
              (claim) =>
                `<article class="plan-claim"><strong>${esc(
                  claim.label
                )}</strong><p>${
                  claim.areaSqFt === null
                    ? say("Measurement unverified", "Mesure non vérifiée")
                    : fmt(claim.areaSqFt) + " " + (fr ? "pi²" : "sq ft")
                } · ${claim.evidence
                  .map(
                    (e) =>
                      `<button type="button" class="small-link" data-tile="${e.tileId}">${e.tileId}</button>`
                  )
                  .join(" ")}</p><details><summary>${say(
                  "Printed evidence",
                  "Données imprimées"
                )}</summary>${claim.evidence
                  .map((e) => `<p>${esc(e.tileId + ": " + e.rawText)}</p>`)
                  .join("")}</details>${
                  scope.mode === "room"
                    ? `<label class="field"><span>${say(
                        "Corresponding entered room",
                        "Pièce saisie correspondante"
                      )}</span><select name="plan.link.${
                        claim.id
                      }"><option value="">${say(
                        "Match by unique label / choose manually",
                        "Associer par libellé unique / choisir"
                      )}</option>${scope.rooms
                        .map(
                          (r, i) =>
                            `<option value="${i}" ${
                              linksByIndex[claim.id] === i ? "selected" : ""
                            }>${esc(r.name)}</option>`
                        )
                        .join("")}</select></label>`
                    : ""
                }</article>`
            )
            .join("")}</div><p>${say(
            "Sum of readable room claims (verify duplicates)",
            "Somme des données de pièces lisibles (vérifier les doublons)"
          )}: ${fmt(c.printedRoomAreaSqFt)} ${fr ? "pi²" : "sq ft"}. ${
            !c.completeMeasurements
              ? say(
                  "Some readings are unresolved.",
                  "Certaines mesures restent à vérifier."
                )
              : ""
          }</p>${
            c.conflicts.length
              ? `<div class="measurement-warning"><h4>${say(
                  "Differences to resolve or discuss",
                  "Différences à résoudre ou à discuter"
                )}</h4><p>${say(
                  "Return to Measurements to correct an input, then reopen this review. Otherwise record why a difference is valid or must be discussed. No input is changed automatically.",
                  "Retournez aux mesures pour corriger une saisie, puis rouvrez cette vérification. Sinon, précisez pourquoi une différence est valide ou doit être discutée. Aucune saisie n’est modifiée automatiquement."
                )}</p>${c.conflicts
                  .map(
                    (x) =>
                      `<div class="plan-conflict"><strong>${esc(
                        x.label || ""
                      )} · ${esc(label(x.code))}</strong>${
                        x.enteredSqFt !== undefined
                          ? `<p>${say("Entered", "Saisi")}: ${fmt(
                              x.enteredSqFt
                            )}; ${say("plan", "plan")}: ${fmt(x.planSqFt)} ${
                              fr ? "pi²" : "sq ft"
                            }</p>`
                          : ""
                      }<label class="field"><span>${say(
                        "Review decision",
                        "Décision de vérification"
                      )}</span><select name="plan.decision.${
                        x.id
                      }"><option value="">${say(
                        "Choose a decision",
                        "Choisir une décision"
                      )}</option><option value="partial-scope" ${
                        decisions[x.id]?.resolution === "partial-scope"
                          ? "selected"
                          : ""
                      }>${say(
                        "A partial or different cleaning scope explains this",
                        "Une portée partielle ou différente explique cet écart"
                      )}</option><option value="discuss-on-call" ${
                        decisions[x.id]?.resolution === "discuss-on-call"
                          ? "selected"
                          : ""
                      }>${say(
                        "Flag this for clarification on the call",
                        "Signaler cet élément pour clarification à l’appel"
                      )}</option></select></label><label class="field"><span>${say(
                        "Reason / question (at least 8 characters)",
                        "Raison / question (au moins 8 caractères)"
                      )}</span><textarea name="plan.reason.${
                        x.id
                      }" rows="2" maxlength="1000">${esc(
                        decisions[x.id]?.reason || ""
                      )}</textarea></label></div>`
                  )
                  .join("")}</div>`
              : `<p class="plan-match-success">${say(
                  "No numerical or room-link conflict was detected in the readings available. This remains a user-reviewed reading, not a surveyed measurement.",
                  "Aucun conflit numérique ou d’association de pièces détecté dans les données disponibles. Il s’agit d’une lecture vérifiée par vous, non d’un relevé d’arpentage."
                )}</p>`
          }<label class="checkbox-row plan-confirm"><input type="checkbox" name="plan.confirm"><span>${say(
            "I checked the original page, units and room coverage. Keep these readings and any explicitly flagged differences with my estimate.",
            "J’ai vérifié la page originale, les unités et les pièces couvertes. Conserver ces données et les différences signalées avec mon estimation."
          )}</span></label><button type="button" class="button primary" data-plan="confirm">${say(
            "Keep reviewed plan evidence",
            "Conserver les données vérifiées"
          )}</button><button type="button" class="small-link" data-plan="audit">${say(
            "Download review audit JSON",
            "Télécharger le journal de vérification JSON"
          )}</button></div>`
        : ""
    }</div>`;
    root
      .querySelectorAll("[data-plan]")
      .forEach((b) => (b.onclick = () => action(b.dataset.plan)));
    root.querySelectorAll("[data-tile]").forEach(
      (b) =>
        (b.onclick = () => {
          selectedTile = b.dataset.tile;
          draw();
        })
    );
    root
      .querySelector('[name="plan.source"]')
      ?.addEventListener("change", (e) => {
        sourceFile = candidates[Number(e.target.value)];
        reset();
        draw();
      });
    root
      .querySelector('[name="plan.page"]')
      ?.addEventListener("change", (e) => {
        pdfPage = Math.max(1, Math.floor(Number(e.target.value) || 1));
        reset();
        draw();
      });
    root
      .querySelector('[name="plan.wholeProject"]')
      ?.addEventListener("change", (e) => {
        wholeProject = e.target.checked;
        onConfirm(null);
        draw();
      });
    root.querySelectorAll('[name^="plan.link."]').forEach(
      (e) =>
        (e.onchange = () => {
          const id = e.name.slice(10);
          if (e.value === "") delete linksByIndex[id];
          else linksByIndex[id] = Number(e.value);
          onConfirm(null);
          draw();
        })
    );
    root.querySelectorAll('[name^="plan.decision."]').forEach(
      (e) =>
        (e.onchange = () => {
          const id = e.name.slice(14);
          decisions[id] = { ...decisions[id], resolution: e.value };
          onConfirm(null);
        })
    );
    root.querySelectorAll('[name^="plan.reason."]').forEach(
      (e) =>
        (e.oninput = () => {
          const id = e.name.slice(12);
          decisions[id] = { ...decisions[id], reason: e.value };
          onConfirm(null);
        })
    );
  }
  function reset() {
    release();
    rendered = null;
    prepared = null;
    report = null;
    decisions = {};
    linksByIndex = {};
    onConfirm(null);
    error = "";
    message = "";
  }
  async function action(name) {
    if (busy) return;
    if (name === "discard") {
      onConfirm(null);
      root.innerHTML = "";
      return;
    }
    if (name === "audit") {
      if (report) {
        const a = document.createElement("a"),
          u = URL.createObjectURL(
            new Blob(
              [
                JSON.stringify(
                  {
                    ...report,
                    comparison: comparison(),
                    decisions: Object.entries(decisions).map(
                      ([conflictId, d]) => ({ conflictId, ...d })
                    ),
                  },
                  null,
                  2
                ),
              ],
              { type: "application/json" }
            )
          );
        a.href = u;
        a.download = report.reference + "-review.json";
        a.click();
        setTimeout(() => URL.revokeObjectURL(u), 10000);
      }
      return;
    }
    if (name === "confirm") {
      const c = comparison(),
        ds = Object.entries(decisions).map(([conflictId, d]) => ({
          conflictId,
          ...d,
        }));
      if (
        !root.querySelector('[name="plan.confirm"]')?.checked ||
        !reviewDecisionsValid(c, ds)
      ) {
        error = say(
          "Confirm the original page and add a decision and reason for each difference.",
          "Confirmez la page originale et précisez une décision et une raison pour chaque différence."
        );
        draw();
        return;
      }
      const scopeFingerprint = planScopeFingerprint(getScope()),
        audit = {
          ...report,
          comparison: c,
          decisions: ds,
          reviewedAt: new Date().toISOString(),
          scopeFingerprint,
          requiresClarification: c.conflicts.length > 0,
        };
      onConfirm({
        proof: {
          reference: prepared.reference,
          token: prepared.token,
          confirmed: true,
          scopeFingerprint,
          wholeProject,
          linksByIndex,
          decisions: ds,
        },
        audit,
      });
      message = say(
        "Reviewed evidence kept with this estimate. Correcting measurements will require a fresh confirmation.",
        "Données vérifiées conservées avec cette estimation. Toute correction des mesures exigera une nouvelle confirmation."
      );
      error = "";
      draw();
      return;
    }
    const consent = root.querySelector('[name="plan.consent"]')?.checked;
    if (name === "run" && !prepared && !consent) {
      error = say(
        "Choose the consent checkbox before sending page images.",
        "Cochez le consentement avant l’envoi des images de la page."
      );
      draw();
      return;
    }
    busy = true;
    error = "";
    message = say(
      "Preparing the selected page…",
      "Préparation de la page choisie…"
    );
    draw();
    try {
      if (name === "preview") {
        sourceFile =
          sourceFile ||
          files().filter((f) => /\.(pdf|jpe?g|png|webp)$/i.test(f.name))[0];
        if (!sourceFile)
          throw Error(
            say("Select a plan file first.", "Sélectionnez d’abord un plan.")
          );
        reset();
        busy = true;
        rendered = await renderPlanFile(sourceFile, pdfPage);
        message = say(
          "Every ownership core is covered and its decoded PNG pixels match the source. Padded context overlaps at boundaries.",
          "Chaque zone centrale est couverte et ses pixels PNG décodés correspondent à la source. Les marges se recouvrent aux limites."
        );
      }
      if (name === "run") {
        if (!prepared) {
          message = say(
            "Uploading only this page’s overview and tiles…",
            "Envoi de l’aperçu et des tuiles de cette page uniquement…"
          );
          draw();
          prepared = await api("prepare", {
            source: rendered.source,
            consent: true,
            files: rendered.parts.map((p) => ({
              id: p.id,
              size: p.blob.size,
              type: "image/png",
            })),
          });
          for (const [i, upload] of prepared.uploads.entries()) {
            const form = new FormData();
            for (const [k, v] of Object.entries(upload.fields))
              form.append(k, v);
            form.append("file", rendered.parts[i].blob, upload.id + ".png");
            const r = await fetch(upload.url, {
              method: "POST",
              body: form,
              signal: AbortSignal.timeout(45000),
            });
            if (!r.ok)
              throw Error(
                say(
                  "A review tile could not be uploaded. Preview again to restart.",
                  "Une tuile n’a pu être envoyée. Recréez l’aperçu pour recommencer."
                )
              );
          }
        }
        let progress = await api("status", {
          reference: prepared.reference,
          token: prepared.token,
        });
        while (progress.status !== "complete") {
          message =
            say("Reviewing tiles", "Vérification des tuiles") +
            " " +
            (progress.reviewedTileCount + 1) +
            "–" +
            Math.min(
              progress.reviewedTileCount + (progress.batchSize || 4),
              rendered.tiles.length
            ) +
            " / " +
            rendered.tiles.length;
          draw();
          progress = await api("run", {
            reference: prepared.reference,
            token: prepared.token,
            batchIndex: progress.nextBatch,
          });
        }
        report = progress;
        message = say(
          "Page review finished. Match the readings and inspect any differences below.",
          "Analyse de la page terminée. Associez les données et vérifiez les différences ci-dessous."
        );
      }
    } catch (e) {
      error = e.message;
    } finally {
      busy = false;
      draw();
    }
  }
  return {
    mount(element) {
      root = element;
      if (sourceFile && !files().includes(sourceFile)) reset();
      draw();
    },
    dispose() {
      release();
    },
  };
}
