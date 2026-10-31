import {
  contextCopy,
  discoveryFields,
  budgetFitText,
} from "./client-context.js";
import { PDFDocument, rgb } from "pdf-lib";
import fontkit from "@pdf-lib/fontkit";
import {
  measurementWarnings,
  measurementWarningText,
} from "./measurement-checks.js";
import { estimate, PRICING, fromSqFt } from "./pricing.js";
import { estimateInput, roomSqft, validateStep } from "./model.js";
import { getContent } from "./content.js";
import { brandGeometry } from "./brand.js";

const W = 612,
  H = 792,
  M = 44;
const palette = {
  navy: rgb(0.118, 0.176, 0.325),
  coral: rgb(0.737, 0.137, 0.271),
  white: rgb(1, 1, 1),
  wash: rgb(0.957, 0.961, 0.969),
  muted: rgb(0.396, 0.439, 0.51),
  line: rgb(0.85, 0.87, 0.9),
};
export async function createEstimatePDF(snapshot, assets) {
  const scope = structuredClone(snapshot.scope),
    language = snapshot.language || "en",
    config = snapshot.config || {},
    fr = language === "fr";
  const imperial = fr ? "pi²" : "sq ft";
  for (const step of [0, 1, 2])
    if (validateStep(scope, step))
      throw Error(
        "Complete the required project measurements before downloading."
      );
  const r = estimate(estimateInput(scope)),
    all = getContent(language, config),
    t = all.estimator;
  const pdf = await PDFDocument.create();
  pdf.registerFontkit(fontkit);
  const regular = await pdf.embedFont(assets.regular, { subset: true }),
    bold = await pdf.embedFont(assets.bold, { subset: true });
  const date = snapshot.generatedAt || new Date().toISOString(),
    documentId =
      snapshot.documentId ||
      `SAP-EST-${date.slice(0, 10).replaceAll("-", "")}-${crypto
        .randomUUID()
        .slice(0, 8)
        .toUpperCase()}`;
  pdf.setTitle(
    `${scope.name || scope.city} — SAP ${
      fr ? "Estimation préliminaire" : "Planning estimate"
    }`
  );
  pdf.setAuthor("Project Hamburg");
  pdf.setSubject(
    "Illustrative construction-cleaning estimate / Estimation indicative de nettoyage de chantier"
  );
  pdf.setCreator("SAP Service Inc. website · Project Hamburg");
  pdf.setCreationDate(new Date(date));
  pdf.setLanguage(fr ? "fr-CA" : "en-CA");
  const money = (n) =>
    new Intl.NumberFormat(fr ? "fr-CA" : "en-CA", {
      style: "currency",
      currency: "CAD",
      maximumFractionDigits: 2,
    }).format(n);
  const number = (n, d = 2) =>
    new Intl.NumberFormat(fr ? "fr-CA" : "en-CA", {
      maximumFractionDigits: d,
    }).format(n);
  const text = (value = "") => String(value).replace(/[\r\n]+/g, " ");
  let page, y;
  function newPage(title) {
    page = pdf.addPage([W, H]);
    page.drawRectangle({
      x: 0,
      y: 0,
      width: W,
      height: H,
      color: palette.white,
    });
    page.drawText("SAP SERVICE INC.", {
      x: M,
      y: H - 36,
      size: 10,
      font: bold,
      color: palette.navy,
    });
    page.drawText(documentId, {
      x: W - M - bold.widthOfTextAtSize(documentId, 8),
      y: H - 36,
      size: 8,
      font: regular,
      color: palette.muted,
    });
    page.drawLine({
      start: { x: M, y: H - 51 },
      end: { x: W - M, y: H - 51 },
      thickness: 2,
      color: palette.coral,
    });
    y = H - 85;
    if (title) paragraph(title, { size: 22, font: bold, gap: 20 });
    return page;
  }
  function ensure(height) {
    if (y - height < 62)
      newPage(fr ? "Estimation — suite" : "Estimate — continued");
  }
  function lines(value, font, size, width) {
    const words = text(value).split(/\s+/),
      result = [];
    let line = "";
    for (const word of words) {
      if (!word) continue;
      const proposed = line ? line + " " + word : word;
      if (font.widthOfTextAtSize(proposed, size) > width && line) {
        result.push(line);
        line = word;
      } else line = proposed;
      if (font.widthOfTextAtSize(line, size) > width) {
        let part = "";
        for (const c of line) {
          if (font.widthOfTextAtSize(part + c, size) > width) {
            result.push(part);
            part = c;
          } else part += c;
        }
        line = part;
      }
    }
    if (line) result.push(line);
    return result;
  }
  function paragraph(
    value,
    {
      size = 10,
      font = regular,
      color = palette.navy,
      width = W - 2 * M,
      x = M,
      gap = 12,
      leading = size * 1.45,
    } = {}
  ) {
    for (const line of lines(value, font, size, width)) {
      ensure(leading);
      page.drawText(line, { x, y, size, font, color });
      y -= leading;
    }
    y -= gap;
  }
  function section(value) {
    ensure(60);
    y -= 8;
    paragraph(value, { size: 14, font: bold, gap: 12 });
  }
  function row(label, value, { emphasis = false, padding = 14 } = {}) {
    const ll = lines(label, regular, 10, 310),
      vl = lines(value, emphasis ? bold : regular, 10, 170),
      height = Math.max(ll.length, vl.length) * 15 + padding;
    ensure(height);
    if (emphasis)
      page.drawRectangle({
        x: M - 8,
        y: y - height + 9,
        width: W - 2 * M + 16,
        height,
        color: palette.wash,
      });
    for (let i = 0; i < ll.length; i++)
      page.drawText(ll[i], {
        x: M,
        y: y - i * 15,
        size: 10,
        font: emphasis ? bold : regular,
        color: palette.navy,
      });
    for (let i = 0; i < vl.length; i++) {
      const font = emphasis ? bold : regular,
        line = vl[i];
      page.drawText(line, {
        x: W - M - font.widthOfTextAtSize(line, 10),
        y: y - i * 15,
        size: 10,
        font,
        color: palette.navy,
      });
    }
    y -= height;
    page.drawLine({
      start: { x: M, y: y + 8 },
      end: { x: W - M, y: y + 8 },
      thickness: 0.5,
      color: palette.line,
    });
  }
  const phaseName = (key) =>
    all.services.stages.find((p) => p.key === key)?.name || key;
  const category = (key) => t.categories.find((p) => p[0] === key)?.[1] || key;
  // Cover: the same typography, SAP geometry, navy/coral palette and architectural imagery as the website.
  newPage();
  page.drawRectangle({
    x: 0,
    y: H - 130,
    width: W,
    height: 130,
    color: palette.navy,
  });
  const logoPath = [...brandGeometry.monogram, ...brandGeometry.wordmark].join(
      " "
    ),
    scale = 0.64;
  page.drawSvgPath(logoPath, {
    x: M - 42 * scale,
    y: H - 24 + 78 * scale,
    scale,
    color: palette.white,
  });
  page.drawText(fr ? "ESTIMATION PRÉLIMINAIRE" : "PRELIMINARY ESTIMATE", {
    x: 230,
    y: H - 50,
    size: 16,
    font: bold,
    color: palette.white,
  });
  page.drawText(
    fr
      ? "Document de planification · CAD · avant taxes"
      : "Planning document · CAD · before tax",
    { x: 230, y: H - 72, size: 9, font: regular, color: palette.white }
  );
  if (assets.hero) {
    const image = await pdf.embedJpg(assets.hero);
    page.drawImage(image, { x: 0, y: H - 360, width: W, height: 230 });
  } else {
    page.drawRectangle({
      x: 0,
      y: H - 360,
      width: W,
      height: 230,
      color: palette.wash,
    });
  }
  page.drawRectangle({
    x: 0,
    y: H - 360,
    width: W,
    height: 27,
    color: palette.navy,
    opacity: 0.9,
  });
  page.drawText(
    fr
      ? "Image architecturale de référence — aucun chantier client revendiqué"
      : "Architectural reference imagery — not presented as completed SAP work",
    { x: M, y: H - 351, size: 8, font: regular, color: palette.white }
  );
  y = H - 391;
  paragraph(
    scope.name || (fr ? "Votre projet de nettoyage" : "Your cleaning project"),
    { size: 23, font: bold, gap: 8 }
  );
  paragraph(
    `${scope.city}, ${scope.province} · ${new Intl.DateTimeFormat(
      fr ? "fr-CA" : "en-CA",
      { dateStyle: "long" }
    ).format(new Date(date))}`,
    { size: 11, color: palette.muted, gap: 20 }
  );
  paragraph(fr ? "Fourchette de planification" : "Planning range", {
    size: 11,
    color: palette.muted,
    gap: 18,
  });
  paragraph(`${money(r.low)} – ${money(r.high)}`, {
    size: 25,
    font: bold,
    gap: 14,
  });
  row(
    fr ? "Superficie nettoyable" : "Cleanable area",
    `${number(r.totalSqFt)} ${imperial} / ${number(
      fromSqFt(r.totalSqFt, "m2")
    )} m²`
  );
  row(
    fr
      ? "Heures de main-d’œuvre / mobilisations"
      : "Labour hours / mobilizations",
    `${number(r.laborHours)} h / ${r.visits}`
  );
  paragraph(t.demo + " " + t.disclaimer, {
    size: 9,
    color: palette.muted,
    gap: 0,
  });
  newPage(fr ? "Votre portée et votre budget" : "Your scope and budget");
  row(t.city, `${scope.city}, ${scope.province}`);
  row(t.category, category(scope.category));
  if (scope.budget > 0) {
    row(contextCopy(language).budget, money(scope.budget));
    paragraph(budgetFitText(scope.budget, r, language), {
      size: 9,
      color: palette.muted,
    });
  }
  row(t.cleanDate, scope.cleanDate || "—");
  row(t.handoverDate, scope.handoverDate || "—");
  section(fr ? "Ventilation du calcul" : "Calculation breakdown");
  const ledger = [
    [t.costLabels.labor, r.labor],
    [t.costLabels.equipment, r.equipment],
    [t.costLabels.disposal, r.disposal],
    [t.costLabels.consumables, r.consumables],
    [t.costLabels.travel, r.travel],
    [fr ? "Services optionnels" : "Optional services", r.optionsTotal],
    [
      `${t.costLabels.overhead} (${number(PRICING.overheadPct * 100)}%)`,
      r.overhead,
    ],
    [`${t.costLabels.margin} (${number(PRICING.marginPct * 100)}%)`, r.margin],
    [
      fr ? "Ajustement au minimum" : "Minimum-charge adjustment",
      Math.max(0, r.minimumAdjustment),
    ],
  ];
  for (const [label, value] of ledger) row(label, money(value));
  const rounding =
    Math.round(r.mid * 100) -
    ledger.reduce((sum, [, n]) => sum + Math.round(n * 100), 0);
  if (rounding)
    row(
      fr ? "Ajustement d’arrondi" : "Rounding adjustment",
      money(rounding / 100)
    );
  row(
    fr
      ? "Point milieu indicatif — avant taxes"
      : "Planning midpoint — before tax",
    money(r.mid),
    { emphasis: true }
  );
  row(
    fr ? "Coût indicatif par pied carré" : "Planning cost per square foot",
    `${money(r.perSqFt)} / ${imperial}`
  );
  paragraph(
    fr
      ? "Aucune taxe n’est ajoutée à cette fourchette. Toute soumission commerciale doit confirmer les taux et les taxes applicables."
      : "No tax is added to this planning range. A commercial quotation must confirm approved rates and applicable taxes.",
    { size: 9, color: palette.muted }
  );
  newPage(
    fr ? "Mesures et phases de nettoyage" : "Measurements and cleaning phases"
  );
  if (scope.mode === "room") {
    paragraph(
      fr
        ? "Chaque pièce est comptée une fois. Les dimensions sont celles que vous avez saisies; aucun plan n’a été mesuré automatiquement."
        : "Each room is counted once. Dimensions are the ones you entered; no plan has been automatically measured.",
      { color: palette.muted }
    );
    for (const [index, room] of scope.rooms.entries()) {
      const area = roomSqft(room),
        dim =
          room.measurement === "dimensions"
            ? `${number(
                fromSqFt(room.length ** 2, scope.unit) ** 0.5
              )} × ${number(fromSqFt(room.width ** 2, scope.unit) ** 0.5)} ${
                scope.unit === "m2" ? "m" : "ft"
              }`
            : fr
            ? "Superficie saisie"
            : "Entered area";
      row(
        `${String(index + 1).padStart(2, "0")} · ${room.name} (${dim})`,
        `${number(area)} ${imperial} / ${number(fromSqFt(area, "m2"))} m²`
      );
    }
  } else {
    row(
      fr ? "Superficie totale saisie" : "Entered total cleanable area",
      `${number(r.totalSqFt)} ${imperial} / ${number(
        fromSqFt(r.totalSqFt, "m2")
      )} m²`
    );
    row(
      fr
        ? "Aires communes incluses dans le total"
        : "Common areas included in the total",
      `${number(scope.common)} ${imperial}`
    );
    row(
      fr ? "Étages / unités" : "Floors / units",
      `${scope.floors} / ${scope.units}`
    );
  }
  if (measurementWarnings(scope).length) {
    section(
      fr ? "Mesures inhabituelles confirmées" : "Confirmed measurement checks"
    );
    for (const warning of measurementWarnings(scope))
      paragraph(measurementWarningText(warning, language, scope.unit), {
        size: 9,
      });
  }
  section(fr ? "Phases retenues" : "Selected phases");
  for (const item of r.rows)
    row(`${phaseName(item.phase)} · ${number(item.hours)} h`, money(item.cost));
  paragraph(
    fr
      ? "Les montants par phase répartissent le point milieu complet proportionnellement aux heures de nettoyage; ils ne constituent pas seulement le coût de main-d’œuvre."
      : "Phase amounts allocate the complete planning midpoint in proportion to cleaning hours; they are not labour-only charges.",
    { size: 9, color: palette.muted }
  );
  row(
    fr ? "Mobilisation supplémentaire incluse" : "Included mobilization labour",
    `${r.visits} × ${PRICING.mobilizationHours} h = ${
      r.visits * PRICING.mobilizationHours
    } h`
  );
  row(
    fr ? "Équipe / jours-équipe estimés" : "Crew / estimated crew-days",
    `${r.crewSize} / ${number(r.crewDays)}`
  );
  if (r.optionRows.length) {
    section(fr ? "Options incluses" : "Included options");
    for (const option of r.optionRows)
      row(
        t.options.find((x) => x[0] === option.key)?.[1] || option.key,
        money(option.amount)
      );
  }
  newPage(
    fr
      ? "Conditions, hypothèses et prochaines étapes"
      : "Conditions, assumptions and next steps"
  );
  const discovery = contextCopy(language);
  if (scope.referredBy || discoveryFields.some((k) => scope[k])) {
    section(discovery.title);
    if (scope.referredBy) {
      paragraph(discovery.referredBy, { font: bold, size: 9, gap: 3 });
      paragraph(scope.referredBy, { size: 9 });
    }
    for (const key of discoveryFields)
      if (scope[key]) {
        paragraph(discovery[key], { font: bold, size: 9, gap: 3 });
        paragraph(scope[key], { size: 9 });
      }
  }
  if (snapshot.planReview) {
    const review = snapshot.planReview;
    section(
      fr
        ? "Vérification du plan et traçabilité"
        : "Plan review and traceability"
    );
    paragraph(`${review.reference} · ${review.protocol} · ${review.model}`, {
      size: 9,
    });
    paragraph(
      `${review.source.name} · ${fr ? "page" : "page"} ${review.source.page}/${
        review.source.pageCount
      } · ${review.source.width} × ${review.source.height} px · ${
        review.reviewedTileCount
      }/${review.tiles.length} ${fr ? "tuiles analysées" : "tiles reviewed"}`,
      { size: 9 }
    );
    paragraph(
      fr
        ? "Les données imprimées sont une lecture assistée par IA et vérifiée par le visiteur. Il ne s’agit pas d’un relevé de mesures. Le recouvrement des tuiles ne prouve pas que toutes les pièces ont été reconnues. Aucune saisie de prix n’a été modifiée automatiquement."
        : "Printed information is an AI-assisted reading reviewed by the visitor, not a surveyed measurement. Tile coverage does not prove every room was recognized. No pricing input was changed automatically.",
      { size: 9, color: palette.muted }
    );
    if (review.requiresClarification)
      paragraph(
        fr
          ? "Des différences restent à clarifier lors de la consultation."
          : "Differences remain flagged for clarification at consultation.",
        { size: 10, font: bold, color: palette.coral }
      );
    for (const claim of review.claims.filter((c) => c.kind === "room"))
      row(
        claim.label,
        claim.areaSqFt === null
          ? fr
            ? "À vérifier"
            : "Unverified"
          : `${number(claim.areaSqFt)} ${imperial}`,
        { padding: 8 }
      );
    for (const d of review.decisions || [])
      if (review.comparison?.conflicts.some((c) => c.id === d.conflictId))
        paragraph(`${d.conflictId}: ${d.resolution} — ${d.reason}`, {
          size: 9,
        });
  }
  for (let index = 0; index < t.conditions.length; index += 2) {
    const entries = t.conditions
      .slice(index, index + 2)
      .map(([key, label, values]) =>
        lines(
          `${label}: ${
            values.find((v) => v[0] === scope.conditions[key])?.[1] ||
            scope.conditions[key] ||
            "—"
          }`,
          regular,
          9,
          244
        )
      );
    const height = Math.max(...entries.map((e) => e.length)) * 13 + 12;
    ensure(height);
    entries.forEach((entry, column) =>
      entry.forEach((line, i) =>
        page.drawText(line, {
          x: M + column * 268,
          y: y - i * 13,
          size: 9,
          font: regular,
          color: palette.navy,
        })
      )
    );
    y -= height;
  }
  if (r.needsAssessment)
    paragraph(t.assessment, { font: bold, color: palette.coral });
  section(fr ? "Méthode de calcul" : "Calculation method");
  paragraph(
    fr
      ? `Heures par phase = somme(superficie ÷ rendement × facteurs locaux) × facteur de chantier. Ajout des sanitaires, cuisines et vitrages à la phase de finition, puis ${
          r.visits
        } mobilisations. Heures × ${money(
          PRICING.loadedLaborRate
        )}/h + équipement + consommables + déplacement + options; frais généraux ${number(
          PRICING.overheadPct * 100
        )} %, majoration ${number(PRICING.marginPct * 100)} %, minimum ${money(
          PRICING.minimumCharge
        )}, fourchette ±${number(PRICING.rangeSpread * 100)} %.`
      : `Phase hours = sum(area ÷ production rate × room factors) × site factor. Final cleaning adds washroom, kitchen and glazing time, followed by ${
          r.visits
        } mobilizations. Hours × ${money(
          PRICING.loadedLaborRate
        )}/h + equipment + consumables + travel + options; ${number(
          PRICING.overheadPct * 100
        )}% overhead, ${number(PRICING.marginPct * 100)}% markup, ${money(
          PRICING.minimumCharge
        )} minimum, ±${number(PRICING.rangeSpread * 100)}% planning range.`,
    { size: 9 }
  );
  paragraph(t.exclusionText, { size: 9, color: palette.muted });
  if (snapshot.files?.length) {
    section(fr ? "Pièces jointes sélectionnées" : "Selected supporting files");
    paragraph(snapshot.files.map((f) => f.name).join(" · "), { size: 9 });
    paragraph(
      fr
        ? "Cette liste ne confirme pas une transmission. Les fichiers ne sont envoyés qu’avec une demande formelle et votre consentement."
        : "This list is not a submission receipt. Files are uploaded only when you send a formal request with consent.",
      { size: 9, color: palette.muted }
    );
  }
  const nextSteps = fr
    ? "Demandez une soumission formelle et réservez une consultation. Confirmez la superficie nette, les accès, les finis et l’échéancier avant toute mobilisation."
    : "Request a formal quotation and book a consultation. Confirm net cleanable area, access, finishes and schedule before any mobilization.";
  const contactEmail = config.contact?.email || "info@projecthamburg.com";
  // Keep the final heading, guidance and contact together; avoid an email-only page.
  ensure(
    8 +
      14 * 1.45 +
      12 +
      (lines(nextSteps, regular, 10, W - 2 * M).length +
        lines(contactEmail, bold, 10, W - 2 * M).length) *
        14.5 +
      24 +
      4
  );
  section(fr ? "Confirmer la portée" : "Confirm the scope");
  paragraph(nextSteps, { size: 10 });
  paragraph(contactEmail, { font: bold });
  const pages = pdf.getPages();
  for (let i = 0; i < pages.length; i++) {
    const p = pages[i];
    p.drawLine({
      start: { x: M, y: 43 },
      end: { x: W - M, y: 43 },
      color: palette.line,
      thickness: 0.5,
    });
    p.drawText(`SAP SERVICE INC. · ${PRICING.version} · Project Hamburg`, {
      x: M,
      y: 26,
      size: 8,
      font: regular,
      color: palette.muted,
    });
    p.drawText(`${i + 1} / ${pages.length}`, {
      x: W - M - 30,
      y: 26,
      size: 8,
      font: regular,
      color: palette.muted,
    });
  }
  await pdf.attach(
    new TextEncoder().encode(
      JSON.stringify(
        {
          documentId,
          generatedAt: date,
          pricingVersion: PRICING.version,
          scope,
          estimate: r,
          ...(snapshot.planReview ? { planReview: snapshot.planReview } : {}),
        },
        null,
        2
      )
    ),
    "estimate-data.json",
    {
      mimeType: "application/json",
      description:
        "Exact calculation inputs and unrounded results / Données exactes du calcul",
    }
  );
  return {
    bytes: await pdf.save(),
    documentId,
    estimate: r,
    pageCount: pages.length,
  };
}
async function imageBytes(url, width = 1224, height = 460) {
  const image = new Image();
  image.crossOrigin = "anonymous";
  image.src = url;
  await image.decode();
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d"),
    ratio = Math.max(width / image.naturalWidth, height / image.naturalHeight),
    sw = width / ratio,
    sh = height / ratio;
  ctx.drawImage(
    image,
    (image.naturalWidth - sw) / 2,
    (image.naturalHeight - sh) / 2,
    sw,
    sh,
    0,
    0,
    width,
    height
  );
  const blob = await new Promise((resolve) =>
    canvas.toBlob(resolve, "image/jpeg", 0.88)
  );
  return new Uint8Array(await blob.arrayBuffer());
}
export async function downloadEstimatePDF(snapshot) {
  const fetchAsset = async (path) => {
    const r = await fetch(new URL(path, document.baseURI));
    if (!r.ok) throw Error("PDF asset unavailable");
    return new Uint8Array(await r.arrayBuffer());
  };
  const [regular, bold, hero] = await Promise.all([
    fetchAsset("./fonts/Figtree-Regular.ttf"),
    fetchAsset("./fonts/Figtree-Bold.ttf"),
    imageBytes(new URL("./images/lobby.webp", document.baseURI).href),
  ]);
  const result = await createEstimatePDF(snapshot, { regular, bold, hero });
  const blob = new Blob([result.bytes], { type: "application/pdf" });
  const url = URL.createObjectURL(blob),
    a = document.createElement("a");
  a.href = url;
  a.download = result.documentId + ".pdf";
  document.body.append(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 30000);
  return { documentId: result.documentId, pageCount: result.pageCount };
}
