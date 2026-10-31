import { planScopeFingerprint } from "./plan-geometry.js";
import {
  contextCopy,
  discoveryFields,
  budgetFitText,
} from "./client-context.js";
import {
  measurementWarnings,
  measurementFingerprint,
  measurementWarningText,
} from "./measurement-checks.js";
import { content, getContent } from "./content.js";
import { icon, logo } from "./icons.js";
import { estimate, PRICING, fromSqFt } from "./pricing.js";
import {
  initialState,
  freshRoom,
  roomSqft,
  totalSqft,
  estimateInput,
  validateStep,
  sampleState,
  restoreState,
  serializeScope,
  displayArea,
  parseArea,
  displayLength,
  parseLength,
} from "./model.js";
import {
  escapeHTML as esc,
  formField as field,
  selectField as select,
  money,
  number,
  store,
  toast,
  validateFiles,
  downloadFile,
} from "./utils.js";
import { openQuote } from "./forms.js";

export class Estimator {
  constructor(config) {
    this.config = config;
    this.state = initialState();
    this.files = [];
    this.error = null;
    this.result = null;
  }
  mount(root, language) {
    this.root = root;
    this.language = language;
    this.t = getContent(language, this.config).estimator;
    this.all = getContent(language, this.config);
    this.update();
    root.addEventListener("click", (event) => this.onClick(event));
    root.addEventListener("change", (event) => this.onChange(event));
    root.addEventListener("input", (event) => this.onInput(event));
    root.addEventListener("submit", (event) => {
      event.preventDefault();
      this.next();
    });
    root.addEventListener("dragover", (event) => {
      if (event.target.closest(".dropzone")) {
        event.preventDefault();
        event.target.closest(".dropzone").classList.add("drag-over");
      }
    });
    root.addEventListener("dragleave", (event) =>
      event.target.closest(".dropzone")?.classList.remove("drag-over")
    );
    root.addEventListener("drop", (event) => {
      if (event.target.closest(".dropzone")) {
        event.preventDefault();
        this.addFiles([...event.dataTransfer.files]);
      }
    });
  }
  update(focus = false) {
    if (!this.root?.isConnected) return;
    const s = this.state,
      t = this.t;
    this.result = null;
    try {
      if (!validateStep(s, 1) && !validateStep(s, 2))
        this.result = estimate(estimateInput(s));
    } catch {}
    this.root.innerHTML = `<div class="estimate-toolbar"><span>${icon(
      "ruler"
    )}${t.intro}</span><div><button type="button" data-est="restore">${icon(
      "file"
    )}${t.restore}</button><button type="button" data-est="sample">${
      t.sample
    }${icon(
      "diagonal"
    )}</button></div></div><div class="estimate-layout"><div class="estimate-card"><ol class="estimate-progress" aria-label="${t.steps.join(
      ", "
    )}">${t.steps
      .map(
        (label, i) =>
          `<li class="${
            i < s.step ? "complete" : i === s.step ? "current" : ""
          }"><button type="button" data-step="${i}" ${
            i > s.step ? "disabled" : ""
          } ${i === s.step ? 'aria-current="step"' : ""}><span>${
            i < s.step ? icon("check") : String(i + 1).padStart(2, "0")
          }</span><small>${label}</small></button></li>`
      )
      .join("")}</ol><div class="estimate-card-body"><div class="step-marker">${
      t.step
    } ${String(s.step + 1).padStart(2, "0")} <span>/ ${
      t.of
    } 06</span></div><form id="estimate-form" novalidate>${this.stepContent()}${
      s.step === 2
        ? `<div id="measurement-checks">${this.measurementChecks()}</div>`
        : ""
    }${
      this.error
        ? `<div class="form-error" id="estimate-error" role="alert">${icon(
            "info"
          )}${t[this.error.message] || t.validation}</div>`
        : ""
    }${
      s.step < 5
        ? `<div class="estimate-controls"><button type="button" class="back-button" data-est="back" ${
            s.step === 0 ? "disabled" : ""
          }>← ${t.back}</button><span>${String(s.step + 1).padStart(
            2,
            "0"
          )} / 06</span><button type="submit" class="button primary">${
            s.step === 4 ? t.calculate : t.next
          }${icon("arrow")}</button></div>`
        : ""
    }</form></div></div><aside class="estimate-summary" aria-label="${
      t.sidebar
    }">${this.summary()}</aside></div>`;
    if (focus) {
      const h = this.root.querySelector(".step-heading");
      h?.focus({ preventScroll: true });
      this.root.querySelector(".estimate-card").scrollIntoView({
        behavior: matchMedia("(prefers-reduced-motion: reduce)").matches
          ? "instant"
          : "smooth",
        block: "start",
      });
    }
  }
  heading(title, copy) {
    return `<h3 class="step-heading" tabindex="-1">${title}</h3><p class="step-copy">${copy}</p>`;
  }
  measurementChecks() {
    const warnings = measurementWarnings(this.state),
      fr = this.language === "fr";
    if (!warnings.length) return "";
    return `<aside class="measurement-warning" aria-labelledby="measurement-warning-title"><h4 id="measurement-warning-title">${
      fr ? "Vérifions les mesures" : "Let’s check the measurements"
    }</h4><p>${
      fr
        ? "Les dimensions inhabituelles peuvent être correctes. Aucune valeur ne sera modifiée automatiquement."
        : "Unusual sizes can be valid. No value will be changed automatically."
    }</p><ul>${warnings
      .map(
        (w) =>
          `<li>${esc(
            measurementWarningText(w, this.language, this.state.unit)
          )}</li>`
      )
      .join(
        ""
      )}</ul><label class="checkbox-row"><input type="checkbox" name="measurementConfirmation" ${
      this.state.measurementConfirmation === measurementFingerprint(this.state)
        ? "checked"
        : ""
    }><span>${
      fr
        ? "J’ai vérifié les unités, la portée et les mesures saisies; elles sont correctes."
        : "I checked the units, scope and measurements entered; they are correct."
    }</span></label></aside>`;
  }
  stepContent() {
    const s = this.state,
      t = this.t,
      context = contextCopy(this.language),
      unit = s.unit === "m2" ? "m²" : this.language === "fr" ? "pi²" : "sq ft";
    if (s.step === 0)
      return `${this.heading(
        t.projectTitle,
        t.projectCopy
      )}<div class="mode-choices" role="group" aria-label="${
        t.projectTitle
      }">${[
        ["project", "building", t.byProject, t.byProjectCopy],
        ["room", "grid", t.byRoom, t.byRoomCopy],
      ]
        .map(
          ([key, image, title, copy]) =>
            `<button type="button" class="choice-card ${
              s.mode === key ? "selected" : ""
            }" data-mode="${key}" aria-pressed="${s.mode === key}">${icon(
              image
            )}<span class="choice-check">${
              s.mode === key ? icon("check") : ""
            }</span><strong>${title}</strong><small>${copy}</small></button>`
        )
        .join("")}</div><div class="form-grid">${select(
        t.category,
        "category",
        s.category,
        t.categories,
        true
      )}${field(t.name, "name", s.name, {
        placeholder: t.namePlaceholder,
        full: true,
      })}${field(t.city, "city", s.city, {
        required: true,
        placeholder: t.cityPlaceholder,
        autocomplete: "address-level2",
      })}${select(t.province, "province", s.province, [
        ["QC", "Québec"],
        ["ON", "Ontario"],
      ])}${select(
        t.construction,
        "context",
        s.context,
        [
          ["new", t.new],
          ["renovation", t.renovation],
        ],
        true
      )}${field(t.cleanDate, "cleanDate", s.cleanDate, {
        type: "date",
      })}${field(t.handoverDate, "handoverDate", s.handoverDate, {
        type: "date",
      })}</div><label class="checkbox-row"><input type="checkbox" name="occupied" ${
        s.occupied ? "checked" : ""
      }><span>${t.occupied}</span></label><div class="form-grid">${field(
        context.budget,
        "budget",
        s.budget || "",
        { type: "number", min: 0, max: 10000000, step: "any", full: true }
      )}${field(context.referredBy, "referredBy", s.referredBy, {
        full: true,
      })}</div><p class="field-help">${context.budgetHelp}</p>`;
    if (s.step === 1)
      return `${this.heading(
        t.scopeTitle,
        t.scopeCopy
      )}<div class="scope-choices" id="phases">${this.all.services.stages
        .map(
          (phase) =>
            `<button type="button" class="scope-choice ${
              s.phases.includes(phase.key) ? "selected" : ""
            }" data-scope="${phase.key}" aria-pressed="${s.phases.includes(
              phase.key
            )}"><span class="scope-num">${phase.num}</span><div><strong>${
              phase.name
            }</strong><small>${
              phase.tag
            }</small></div><span class="scope-checkbox">${
              s.phases.includes(phase.key) ? icon("check") : icon("plus")
            }</span></button>`
        )
        .join("")}</div><div class="form-subheading"><h4>${
        t.addons
      }</h4><span>${t.optional}</span></div><div class="option-grid">${t.options
        .map(
          ([key, label]) =>
            `<label class="checkbox-row"><input type="checkbox" name="option" value="${key}" ${
              s.options.includes(key) ? "checked" : ""
            }><span>${label}</span></label>`
        )
        .join("")}</div><p class="fine-print">${t.specialty}</p>`;
    if (s.step === 2)
      return `${this.heading(
        t.areaTitle,
        t.areaCopy
      )}<div class="measurement-tools"><span>${
        s.mode === "room" ? t.rooms : t.area
      }</span><div class="unit-switch" role="group" aria-label="${unit}"><button type="button" data-unit="ft2" aria-pressed="${
        s.unit === "ft2"
      }">${
        this.language === "fr" ? "pi²" : "sq ft"
      }</button><button type="button" data-unit="m2" aria-pressed="${
        s.unit === "m2"
      }">m²</button></div></div>${
        s.mode === "project"
          ? `<div class="form-grid">${field(
              `${t.area} (${unit})`,
              "area",
              displayArea(s.area, s.unit),
              {
                type: "number",
                required: true,
                min: 0.01,
                max: 10000000,
                step: "any",
                full: true,
              }
            )}${field(
              `${t.gross} (${unit})`,
              "gross",
              displayArea(s.gross, s.unit),
              { type: "number", min: 0, step: "any" }
            )}${field(
              `${t.common} (${unit})`,
              "common",
              displayArea(s.common, s.unit),
              { type: "number", min: 0, step: "any" }
            )}</div><p class="field-help">${
              t.areaHelp
            }</p><div class="form-grid">${field(t.floors, "floors", s.floors, {
              type: "number",
              min: 1,
              max: 500,
            })}${field(t.units, "units", s.units, {
              type: "number",
              min: 1,
              max: 10000,
            })}${select(t.ceiling, "ceiling", s.ceiling, [
              ["standard", t.standard],
              ["high", t.high],
              ["veryHigh", t.veryHigh],
            ])}${select(t.fixtures, "fixtures", s.fixtures, [
              ["low", t.low],
              ["standard", t.normal],
              ["high", t.dense],
            ])}${select(t.floor, "floor", s.floor, t.floorOptions, true)}</div>`
          : `<div class="room-list" id="rooms">${s.rooms
              .map((r, i) => this.roomCard(r, i))
              .join(
                ""
              )}</div><button type="button" class="button outline add-room" data-est="add-room">${icon(
              "plus"
            )}${t.addRoom}</button><div class="room-total"><span>${
              t.total
            }</span><strong id="room-total">${number(
              fromSqFt(totalSqft(s), s.unit),
              this.language,
              2
            )} ${unit}</strong></div>`
      }<div class="form-subheading"><h4>${t.addons}</h4><span>${
        t.optional
      }</span></div><div class="form-grid">${field(
        t.washrooms,
        "washrooms",
        s.washrooms,
        { type: "number", min: 0, max: 10000 }
      )}${field(t.kitchens, "kitchens", s.kitchens, {
        type: "number",
        min: 0,
        max: 10000,
      })}${field(
        `${t.glazing} (${unit})`,
        "glazing",
        displayArea(s.glazing, s.unit),
        { type: "number", min: 0, step: "any", full: true }
      )}</div>`;
    if (s.step === 3)
      return `${this.heading(
        t.conditionsTitle,
        t.conditionsCopy
      )}<div class="form-grid">${t.conditions
        .map(([key, label, values]) =>
          select(label, `condition.${key}`, s.conditions[key], values)
        )
        .join("")}${field(
        t.visits,
        "visits",
        Math.max(s.phases.length, s.visits),
        {
          type: "number",
          min: Math.max(1, s.phases.length),
          max: 100,
          full: true,
        }
      )}</div><p class="field-help">${t.visitsHelp}</p><p class="fine-print">${
        t.specialty
      }</p>`;
    if (s.step === 4)
      return `${this.heading(
        t.filesTitle,
        t.filesCopy
      )}<div class="discovery-fields"><h4>${
        context.title
      }</h4><p class="field-help">${context.intro}</p>${discoveryFields
        .map(
          (key) =>
            `<label class="field"><span>${
              context[key]
            }</span><textarea name="${key}" rows="3" maxlength="2000">${esc(
              s[key]
            )}</textarea><small class="field-help">${
              context[key + "Help"]
            }</small></label>`
        )
        .join(
          ""
        )}</div><label class="dropzone"><input type="file" name="projectFiles" multiple accept=".pdf,.jpg,.jpeg,.png,.webp,application/pdf,image/jpeg,image/png,image/webp">${icon(
        "upload"
      )}<strong>${t.drop}</strong><span>${
        t.fileTypes
      }</span></label><div class="file-list">${this.files
        .map(
          (file, i) =>
            `<div class="file-item">${icon(
              file.type.startsWith("image/") ? "grid" : "file"
            )}<div><strong>${esc(file.name)}</strong><small>${number(
              file.size / 1024,
              this.language
            )} KB</small></div><button type="button" class="icon-button" data-remove-file="${i}" aria-label="${
              this.all.fileRemove
            }: ${esc(file.name)}">${icon("close")}</button></div>`
        )
        .join("")}</div><p class="file-privacy">${icon("shield")}${
        t.local
      }</p><div class="sample-plan-card"><div class="sample-plan-preview"><img src="./images/sample-floor-plan.svg" alt="${
        t.sampleLabel
      }" width="240" height="170" loading="lazy"></div><div><span class="micro-label">${
        t.sampleLabel
      }</span><a class="text-link" href="./images/sample-floor-plan.svg" target="_blank" rel="noopener noreferrer">${
        t.samplePlan
      }${icon("diagonal")}</a><p>${
        t.sampleHelp
      }</p><button type="button" class="small-link" data-est="sample">${
        t.sample
      }${icon("arrow")}</button></div></div><p class="fine-print">${
        t.noExtraction
      }</p>${
        this.config.planReviewEnabled
          ? `<div class="plan-review-entry"><button type="button" class="button outline" data-est="plan-review">${
              this.language === "fr"
                ? "Vérifier un plan (facultatif)"
                : "Review a floor plan (optional)"
            }</button>${
              this.planReview
                ? `<p class="fine-print">${esc(
                    this.planReview.audit.reference
                  )} · ${
                    this.language === "fr"
                      ? "Données vérifiées conservées"
                      : "Reviewed evidence kept"
                  }</p>`
                : ""
            }<div id="plan-review-workspace"></div></div>`
          : ""
      }`;
    return this.results();
  }
  roomCard(r, i) {
    const t = this.t,
      s = this.state,
      prefix = `room.${r.id}.`,
      unit = s.unit === "m2" ? "m" : this.language === "fr" ? "pi" : "ft";
    return `<fieldset class="room-card" data-room="${r.id}"><legend>${String(
      i + 1
    ).padStart(2, "0")} / ${esc(
      r.name || t.roomName
    )}</legend><button type="button" class="icon-button room-remove" data-remove-room="${
      r.id
    }" aria-label="${t.removeRoom}: ${esc(r.name || i + 1)}">${icon(
      "trash"
    )}</button><div class="form-grid">${field(
      t.roomName,
      prefix + "name",
      r.name,
      { required: true }
    )}${select(
      t.roomType,
      prefix + "category",
      r.category,
      t.categories
    )}${select(
      t.area,
      prefix + "measurement",
      r.measurement,
      [
        ["dimensions", t.dimensions],
        ["area", t.knownArea],
      ],
      true
    )}${
      r.measurement === "area"
        ? field(
            `${t.area} (${
              s.unit === "m2" ? "m²" : this.language === "fr" ? "pi²" : "sq ft"
            })`,
            prefix + "area",
            displayArea(r.area, s.unit),
            {
              type: "number",
              min: 0.01,
              step: "any",
              required: true,
              full: true,
            }
          )
        : `${field(
            `${t.length} (${unit})`,
            prefix + "length",
            displayLength(r.length, s.unit),
            { type: "number", min: 0.01, step: "any", required: true }
          )}${field(
            `${t.width} (${unit})`,
            prefix + "width",
            displayLength(r.width, s.unit),
            { type: "number", min: 0.01, step: "any", required: true }
          )}`
    }${select(t.ceiling, prefix + "ceiling", r.ceiling, [
      ["standard", t.standard],
      ["high", t.high],
      ["veryHigh", t.veryHigh],
    ])}${select(t.fixtures, prefix + "fixtures", r.fixtures, [
      ["low", t.low],
      ["standard", t.normal],
      ["high", t.dense],
    ])}${select(
      t.floor,
      prefix + "floor",
      r.floor,
      t.floorOptions,
      true
    )}</div></fieldset>`;
  }
  summary() {
    const t = this.t,
      s = this.state,
      result = this.result,
      area = totalSqft(s),
      unit = s.unit === "m2" ? "m²" : this.language === "fr" ? "pi²" : "sq ft";
    return `<div class="summary-heading">${icon("file")}<span>${
      t.sidebar
    }</span><span>↗</span></div><h3>${esc(
      s.name || t.empty
    )}</h3><p class="summary-location">${icon("pin")}${esc(
      s.city || "Montréal"
    )} · ${
      s.province === "ON" ? "Ontario" : "Québec"
    }</p><div class="summary-line"><span>${t.category}</span><strong>${esc(
      t.categories.find(([k]) => k === s.category)?.[1] || t.notSelected
    )}</strong></div><div class="summary-line"><span>${
      t.selectedPhases
    }</span><div>${
      s.phases.length
        ? this.all.services.stages
            .filter((p) => s.phases.includes(p.key))
            .map((p) => `<span class="summary-chip">${p.name}</span>`)
            .join("")
        : `<strong>${t.notSelected}</strong>`
    }</div></div><div class="summary-line"><span>${t.areaLabel}</span><strong>${
      area > 0
        ? `${number(fromSqFt(area, s.unit), this.language, 2)} ${unit}`
        : "—"
    }</strong></div><div class="summary-line"><span>${
      t.filesLabel
    }</span><strong>${this.files.length
      .toString()
      .padStart(
        2,
        "0"
      )}</strong></div><div class="summary-budget"><span class="micro-label">${
      t.planning
    }</span><strong>${
      result
        ? `${money(result.low, this.language)} <span>–</span> ${money(
            result.high,
            this.language
          )}`
        : "—"
    }</strong><small>${t.currency}</small></div><p class="summary-disclaimer">${
      t.demo
    }</p><div class="summary-bottom">${icon("shield")}<span>${
      t.private
    }</span></div>`;
  }
  results() {
    const s = this.state,
      t = this.t,
      r = this.result;
    if (!r)
      return `${this.heading(
        t.validation,
        t.areaError
      )}<button class="button primary" type="button" data-step="2">${
        t.edit
      }${icon("arrow")}</button>`;
    return `${this.heading(
      t.resultTitle,
      t.resultCopy
    )}<div class="result-range"><span class="micro-label">${
      t.range
    }</span><strong>${money(r.low, this.language)} <span>–</span> ${money(
      r.high,
      this.language
    )}</strong><small>${
      t.currency
    }</small></div><p class="model-disclaimer">${icon("info")}${
      t.demo
    }</p><div class="result-stats">${[
      [number(r.laborHours, this.language, 1), t.hours],
      [r.crewSize, t.crew],
      [number(r.crewDays, this.language, 2), t.days],
      [
        new Intl.NumberFormat(this.all.lang, {
          style: "currency",
          currency: "CAD",
          minimumFractionDigits: 2,
          maximumFractionDigits: 2,
        }).format(r.perSqFt),
        t.perArea,
      ],
    ]
      .map(([v, k]) => `<div><strong>${v}</strong><span>${k}</span></div>`)
      .join("")}</div><h4 class="result-subheading">${
      t.phaseBreakdown
    }</h4><div class="phase-breakdown">${r.rows
      .map(
        (row) =>
          `<div><span>${
            this.all.services.stages.find((s) => s.key === row.phase).name
          }</span><span>${number(
            row.hours,
            this.language,
            1
          )} h</span><strong>${money(row.cost, this.language)}</strong></div>`
      )
      .join("")}</div><details class="result-details"><summary>${t.costs}${icon(
      "plus"
    )}</summary><dl>${Object.keys(t.costLabels)
      .map((k) =>
        r[k]
          ? `<div><dt>${t.costLabels[k]}</dt><dd>${money(
              r[k],
              this.language
            )}</dd></div>`
          : ""
      )
      .join("")}</dl></details>${
      r.needsAssessment
        ? `<p class="assessment-note">${icon("info")}${t.assessment}</p>`
        : ""
    }<details class="result-details"><summary>${t.assumptions}${icon(
      "plus"
    )}</summary><p>${t.assumptionText}</p><p>${
      t.exclusionText
    }</p></details><p class="result-disclaimer">${t.disclaimer}</p>${
      s.budget > 0
        ? `<div class="budget-fit"><strong>${
            contextCopy(this.language).budget
          }: ${money(s.budget, this.language)}</strong><p>${budgetFitText(
            s.budget,
            r,
            this.language
          )}</p></div>`
        : ""
    }<div class="result-actions"><button type="button" class="button primary" data-est="quote">${
      t.request
    }${icon(
      "diagonal"
    )}</button><button type="button" class="button outline" data-est="print">${icon(
      "download"
    )}${
      t.download
    }</button><button type="button" class="button outline" data-est="export">${icon(
      "download"
    )}${
      t.export
    }</button><button type="button" class="small-link" data-est="save">${icon(
      "file"
    )}${
      t.save
    }</button><button type="button" class="small-link" data-step="0">${
      t.edit
    }${icon("arrow")}</button></div>`;
  }
  onInput(event) {
    const el = event.target;
    if (
      !el.name ||
      ["file", "checkbox"].includes(el.type) ||
      el.tagName === "SELECT"
    )
      return;
    this.readField(el);
    this.refreshSummary();
    const total = this.root.querySelector("#room-total");
    if (total)
      total.textContent = `${number(
        fromSqFt(totalSqft(this.state), this.state.unit),
        this.language,
        2
      )} ${
        this.state.unit === "m2"
          ? "m²"
          : this.language === "fr"
          ? "pi²"
          : "sq ft"
      }`;
  }
  onChange(event) {
    const el = event.target;
    if (el.name === "projectFiles") {
      this.addFiles([...el.files]);
      return;
    }
    if (!el.name) return;
    if (el.name === "measurementConfirmation") {
      this.state.measurementConfirmation = el.checked
        ? measurementFingerprint(this.state)
        : "";
      this.error = null;
      this.root.querySelector(".form-error")?.remove();
      this.refreshSummary(false);
      return;
    }
    this.readField(el);
    if (el.name.endsWith(".measurement")) this.update();
    else this.refreshSummary();
  }
  readField(el) {
    const s = this.state,
      name = el.name;
    if (name === "option") {
      s.options = el.checked
        ? [...new Set([...s.options, el.value])]
        : s.options.filter((v) => v !== el.value);
      return;
    }
    if (name.startsWith("condition.")) {
      s.conditions[name.split(".")[1]] = el.value;
      return;
    }
    if (name.startsWith("room.")) {
      const [, id, key] = name.split("."),
        r = s.rooms.find((v) => v.id === id);
      if (!r) return;
      r[key] = ["length", "width"].includes(key)
        ? parseLength(el.value, s.unit)
        : key === "area"
        ? parseArea(el.value, s.unit)
        : el.value;
      return;
    }
    if (["area", "gross", "common", "glazing"].includes(name))
      s[name] = parseArea(el.value, s.unit);
    else if (
      ["budget", "floors", "units", "washrooms", "kitchens", "visits"].includes(
        name
      )
    )
      s[name] = Math.max(0, Number(el.value) || 0);
    else if (name === "occupied") s.occupied = el.checked;
    else if (Object.hasOwn(s, name) && typeof s[name] === "string")
      s[name] = el.value;
  }
  refreshSummary(updateChecks = true) {
    if (updateChecks) {
      const checks = this.root.querySelector("#measurement-checks");
      if (checks) checks.innerHTML = this.measurementChecks();
    }
    this.result = null;
    try {
      if (!validateStep(this.state, 1) && !validateStep(this.state, 2))
        this.result = estimate(estimateInput(this.state));
    } catch {}
    this.root.querySelector(".estimate-summary").innerHTML = this.summary();
  }
  async onClick(event) {
    const b = event.target.closest("button");
    if (!b) return;
    const s = this.state,
      t = this.t;
    if (b.dataset.mode) {
      s.mode = b.dataset.mode;
      this.error = null;
      this.update();
    }
    if (b.dataset.unit) {
      s.unit = b.dataset.unit;
      this.update();
    }
    if (b.dataset.scope) {
      s.phases = s.phases.includes(b.dataset.scope)
        ? s.phases.filter((v) => v !== b.dataset.scope)
        : [...s.phases, b.dataset.scope];
      s.visits = Math.max(s.visits, s.phases.length);
      this.error = null;
      this.update();
    }
    if (b.dataset.step !== undefined) {
      const step = Number(b.dataset.step);
      if (step <= s.step) {
        s.step = step;
        this.error = null;
        this.update(true);
      }
    }
    if (b.dataset.removeRoom) {
      s.rooms = s.rooms.filter((r) => r.id !== b.dataset.removeRoom);
      if (!s.rooms.length) s.rooms = [freshRoom()];
      this.update();
    }
    if (b.dataset.removeFile !== undefined) {
      const removed = this.files.splice(Number(b.dataset.removeFile), 1)[0];
      if (removed?.name === this.planReview?.audit.source.name) {
        this.planReview = null;
        this.planWorkspace?.dispose();
        this.planWorkspace = null;
      }
      this.update();
    }
    switch (b.dataset.est) {
      case "back":
        s.step = Math.max(0, s.step - 1);
        this.error = null;
        this.update(true);
        break;
      case "add-room":
        s.rooms.push(freshRoom());
        this.update();
        this.root.querySelector(".room-card:last-child input")?.focus();
        break;
      case "sample":
        this.planWorkspace?.dispose();
        this.planWorkspace = null;
        this.planReview = null;
        this.state = sampleState(this.language);
        this.files = [];
        this.error = null;
        this.update();
        toast(t.sampleLoaded);
        break;
      case "save":
        if (store.set("estimate", serializeScope(s))) toast(t.savedMessage);
        break;
      case "restore":
        this.planWorkspace?.dispose();
        this.planWorkspace = null;
        this.planReview = null;
        try {
          const value = store.get("estimate");
          if (!value) {
            toast(t.noneSaved);
            break;
          }
          this.state = restoreState(value);
          this.files = [];
          this.error = null;
          this.update();
          toast(t.restoredMessage);
        } catch {
          toast(t.noneSaved);
        }
        break;
      case "plan-review": {
        const module = await import("./plan-review.js");
        if (!this.planWorkspace)
          this.planWorkspace = module.createPlanReview({
            files: () => this.files,
            getScope: () => this.state,
            config: this.config,
            language: this.language,
            onConfirm: (value) => {
              this.planReview = value;
            },
          });
        this.planWorkspace.mount(
          this.root.querySelector("#plan-review-workspace")
        );
        break;
      }
      case "quote":
        openQuote(this);
        break;
      case "print": {
        const snapshot = {
          ...structuredClone(this.exportData()),
          config: structuredClone(this.config),
          files: this.files.map((f) => ({
            name: f.name,
            size: f.size,
            type: f.type,
          })),
        };
        const original = b.innerHTML;
        b.disabled = true;
        b.textContent =
          this.language === "fr" ? "Préparation du PDF…" : "Preparing PDF…";
        try {
          const { downloadEstimatePDF } = await import("./pdf-export.js");
          await downloadEstimatePDF(snapshot);
        } catch (error) {
          toast(
            this.language === "fr"
              ? "Le PDF n’a pas pu être créé. Vérifiez votre connexion et réessayez."
              : "The PDF could not be created. Check your connection and try again."
          );
        } finally {
          b.disabled = false;
          b.innerHTML = original;
        }
        break;
      }
      case "export":
        downloadFile(
          "sap-estimate.json",
          JSON.stringify(this.exportData(), null, 2)
        );
        break;
      case "reset":
        this.planWorkspace?.dispose();
        this.planWorkspace = null;
        this.planReview = null;
        this.state = initialState();
        this.files = [];
        this.error = null;
        this.update(true);
        break;
    }
  }
  addFiles(files) {
    if (
      !validateFiles(
        files,
        "project",
        this.files.length,
        this.files.reduce((sum, file) => sum + file.size, 0)
      )
    ) {
      toast(this.t.fileError);
      return;
    }
    for (const file of files)
      if (
        !this.files.some(
          (f) =>
            f.name === file.name &&
            f.size === file.size &&
            f.lastModified === file.lastModified
        )
      )
        this.files.push(file);
    this.update();
  }
  next() {
    const form = this.root.querySelector("form");
    this.error = validateStep(this.state, this.state.step);
    if (!form.checkValidity() && !this.error) {
      form.reportValidity();
      return;
    }
    if (this.error) {
      this.update();
      const el = this.root.querySelector(`[name="${this.error.field}"]`);
      if (el) {
        el.setAttribute("aria-invalid", "true");
        el.setAttribute("aria-describedby", "estimate-error");
        el.focus();
      } else
        this.root
          .querySelector(".form-error")
          ?.scrollIntoView({ block: "center" });
      return;
    }
    if (
      this.state.step === 4 &&
      this.planReview &&
      this.planReview.proof.scopeFingerprint !==
        planScopeFingerprint(this.state)
    ) {
      toast(
        this.language === "fr"
          ? "Les mesures ont changé. Rouvrez la vérification du plan et confirmez les données actuelles."
          : "Measurements changed. Reopen the plan review and confirm the current readings."
      );
      return;
    }
    if (this.state.step === 4) {
      for (let i = 0; i < 4; i++) {
        const error = validateStep(this.state, i);
        if (error) {
          this.state.step = i;
          this.error = error;
          this.update(true);
          return;
        }
      }
    }
    this.state.step = Math.min(5, this.state.step + 1);
    this.update(true);
  }
  exportData() {
    return {
      schemaVersion: 1,
      pricingVersion: PRICING.version,
      generatedAt: new Date().toISOString(),
      language: this.language,
      scope: { ...this.state },
      ...(this.planReview ? { planReview: this.planReview.audit } : {}),
      estimate: this.result,
      disclaimer: this.t.demo + " " + this.t.disclaimer,
    };
  }
  print() {
    const r = this.result,
      t = this.t,
      s = this.state;
    if (!r) return;
    const printRoot = document.createElement("section");
    printRoot.id = "print-estimate";
    printRoot.innerHTML = `${logo()}<h1>SAP SERVICE INC.</h1><p>Montréal · ${esc(
      this.config.contact?.email || "info@projecthamburg.com"
    )}</p><hr><h2>${t.range}</h2><p>${esc(s.name)} · ${esc(s.city)} · ${
      s.province
    }</p><p>${new Date().toLocaleDateString(this.all.lang)}</p><h2>${money(
      r.low,
      this.language
    )} – ${money(r.high, this.language)}</h2><p>${t.currency}</p><p><strong>${
      t.demo
    }</strong></p><dl><dt>${t.category}</dt><dd>${esc(
      t.categories.find(([k]) => k === s.category)?.[1] || s.category
    )}</dd><dt>${t.areaLabel}</dt><dd>${number(
      r.totalSqFt,
      this.language
    )} sq ft</dd><dt>${t.hours}</dt><dd>${number(
      r.laborHours,
      this.language,
      1
    )}</dd><dt>${t.crew}</dt><dd>${r.crewSize}</dd><dt>${
      t.days
    }</dt><dd>${number(r.crewDays, this.language, 2)}</dd><dt>${
      t.cleanDate
    }</dt><dd>${esc(s.cleanDate || "—")}</dd><dt>${
      t.handoverDate
    }</dt><dd>${esc(s.handoverDate || "—")}</dd></dl><h3>${
      t.phaseBreakdown
    }</h3><table>${r.rows
      .map(
        (row) =>
          `<tr><td>${
            this.all.services.stages.find((p) => p.key === row.phase).name
          }</td><td>${number(row.hours, this.language, 1)} h</td><td>${money(
            row.cost,
            this.language
          )}</td></tr>`
      )
      .join("")}</table><h3>${t.costs}</h3><table>${Object.keys(t.costLabels)
      .map((k) =>
        r[k]
          ? `<tr><td>${t.costLabels[k]}</td><td>${money(
              r[k],
              this.language
            )}</td></tr>`
          : ""
      )
      .join("")}</table>${
      s.mode === "room"
        ? `<h3>${t.rooms}</h3><table>${s.rooms
            .map(
              (room) =>
                `<tr><td>${esc(room.name)}</td><td>${number(
                  roomSqft(room),
                  this.language,
                  2
                )} sq ft</td></tr>`
            )
            .join("")}</table>`
        : ""
    }<h3>${t.assumptions}</h3><p>${t.assumptionText}</p><p>${
      t.exclusionText
    }</p><p><strong>${t.disclaimer}</strong></p>`;
    document.getElementById("print-estimate")?.remove();
    document.body.append(printRoot);
    window.addEventListener("afterprint", () => printRoot.remove(), {
      once: true,
    });
    window.print();
  }
}
