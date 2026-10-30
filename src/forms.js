import { icon } from "./icons.js";
import {
  formField as field,
  escapeHTML as esc,
  money,
  number,
  toast,
} from "./utils.js";

export async function sendForm(config, kind, payload, files = [], token = "") {
  const body = new FormData();
  body.set(
    "payload",
    JSON.stringify({ ...payload, kind, turnstileToken: token })
  );
  for (const file of files) body.append("files", file, file.name);
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 45000);
  try {
    const response = await fetch(`${config.apiUrl}/v1/${kind}`, {
      method: "POST",
      body,
      signal: controller.signal,
    });
    const data = await response.json();
    if (!response.ok || !data.reference)
      throw new Error(data.error || "Submission failed");
    return data;
  } finally {
    clearTimeout(timer);
  }
}
export function emailDraft(subject, lines) {
  const a = document.createElement("a");
  a.href = `mailto:servicesapinc@gmail.com?subject=${encodeURIComponent(
    subject
  )}&body=${encodeURIComponent(lines.join("\n"))}`;
  a.click();
}
let turnstilePromise;
export async function mountTurnstile(target, key) {
  if (!key) return () => "";
  if (!window.turnstile) {
    if (!turnstilePromise)
      turnstilePromise = new Promise((resolve, reject) => {
        const script = document.createElement("script");
        script.src =
          "https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit";
        script.async = true;
        script.onload = resolve;
        script.onerror = reject;
        document.head.append(script);
      });
    await turnstilePromise;
  }
  let token = "";
  window.turnstile.render(target, {
    sitekey: key,
    callback: (value) => {
      token = value;
    },
    "expired-callback": () => {
      token = "";
    },
    theme: "auto",
  });
  return () => token;
}
export function openQuote(estimator) {
  const { all, language, state: s, result: r, config } = estimator,
    t = all.request,
    e = all.estimator;
  if (!r) return;
  const dialog = document.getElementById("request-dialog");
  dialog.innerHTML = `<div class="dialog-content"><button type="button" class="icon-button dialog-close" aria-label="${
    all.close
  }">${icon(
    "close"
  )}</button><p class="eyebrow">SAP SERVICE INC.</p><h2 id="request-title">${
    t.title
  }</h2><p>${t.copy}</p><div class="quote-brief"><strong>${esc(
    s.name || e.range
  )}</strong><span>${money(r.low, language)} – ${money(
    r.high,
    language
  )} CAD</span><small>${
    e.demo
  }</small></div><form id="quote-form"><div class="form-grid">${field(
    t.name,
    "name",
    "",
    { required: true, autocomplete: "name", full: true }
  )}${field(t.company, "company", "", {
    autocomplete: "organization",
    full: true,
  })}${field(t.email, "email", "", {
    type: "email",
    required: true,
    autocomplete: "email",
    full: true,
  })}${field(t.phone, "phone", "", {
    type: "tel",
    autocomplete: "tel",
    full: true,
  })}<label class="field full"><span>${
    t.notes
  }</span><textarea name="notes" rows="3" maxlength="4000"></textarea></label></div><label class="checkbox-row consent-row"><input type="checkbox" name="consent" required><span>${
    t.consent
  }</span></label><div class="honeypot" aria-hidden="true"><label>Website<input type="text" name="website" tabindex="-1" autocomplete="off"></label></div><div id="quote-challenge"></div><p class="form-status" role="status"></p><button class="button primary full-button" type="submit">${
    config.apiUrl ? t.submit : t.emailSubmit
  }${icon("arrow")}</button>${
    !config.apiUrl ? `<p class="field-help">${t.emailNote}</p>` : ""
  }</form></div>`;
  dialog
    .querySelector(".dialog-close")
    .addEventListener("click", () => dialog.close());
  dialog.onclick = (event) => {
    if (event.target === dialog) dialog.close();
  };
  dialog.showModal();
  let getToken = () => "";
  if (config.apiUrl && config.turnstileSiteKey)
    mountTurnstile(
      dialog.querySelector("#quote-challenge"),
      config.turnstileSiteKey
    )
      .then((get) => (getToken = get))
      .catch(() => {});
  dialog.querySelector("form").addEventListener("submit", async (event) => {
    event.preventDefault();
    const form = event.currentTarget;
    if (!form.reportValidity()) return;
    const values = Object.fromEntries(new FormData(form)),
      button = form.querySelector('[type="submit"]'),
      status = form.querySelector(".form-status");
    if (values.website) return;
    if (!config.apiUrl) {
      const phases = all.services.stages
        .filter((p) => s.phases.includes(p.key))
        .map((p) => p.name)
        .join(", ");
      emailDraft(
        `SAP — ${
          language === "fr" ? "Demande de soumission" : "Quotation request"
        } — ${s.name || s.city}`,
        [
          t.title,
          "",
          `${t.name}: ${values.name}`,
          `${t.company}: ${values.company}`,
          `${t.email}: ${values.email}`,
          `${t.phone}: ${values.phone}`,
          "",
          `${e.name}: ${s.name}`,
          `${e.city}: ${s.city} (${s.province})`,
          `${e.areaLabel}: ${number(r.totalSqFt, language)} sq ft`,
          `${e.selectedPhases}: ${phases}`,
          `${e.cleanDate}: ${s.cleanDate || "—"}`,
          `${e.handoverDate}: ${s.handoverDate || "—"}`,
          `${e.range}: ${money(r.low, language)} – ${money(
            r.high,
            language
          )} CAD`,
          e.demo,
          e.disclaimer,
          "",
          values.notes || "",
          "",
          `${e.filesLabel}: ${
            estimator.files.map((f) => f.name).join(", ") || "—"
          }`,
          t.emailNote,
        ]
      );
      status.textContent = t.emailReady;
      return;
    }
    button.disabled = true;
    button.textContent = t.pending;
    status.textContent = "";
    try {
      const data = await sendForm(
        config,
        "quote",
        {
          contact: {
            name: values.name,
            email: values.email,
            phone: values.phone,
            company: values.company,
          },
          notes: values.notes,
          consent: true,
          language,
          estimate: estimator.exportData(),
          website: values.website,
        },
        estimator.files,
        getToken()
      );
      form.innerHTML = `<div class="submission-success">${icon("check")}<h3>${
        t.success
      }</h3><strong>${esc(data.reference)}</strong></div>`;
    } catch {
      status.textContent = t.error;
      button.disabled = false;
      button.innerHTML = `${t.submit}${icon("arrow")}`;
    }
  });
}
