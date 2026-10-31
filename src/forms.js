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
  const timer = setTimeout(() => controller.abort(), 180000);
  try {
    if (config.uploadMode === "direct") {
      const preparedResponse = await fetch(
        `${config.apiUrl}/v1/${kind}/prepare`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            payload: { ...payload, kind, turnstileToken: token },
            files: files.map((file) => ({
              name: file.name,
              size: file.size,
              type: file.type,
            })),
          }),
          signal: controller.signal,
        }
      );
      const prepared = await preparedResponse.json();
      if (
        !preparedResponse.ok ||
        !prepared.reference ||
        !Array.isArray(prepared.uploads) ||
        prepared.uploads.length !== files.length
      )
        throw new Error(prepared.error || "Unable to prepare submission.");
      await Promise.all(
        prepared.uploads.map(async (upload, index) => {
          const target = new URL(upload.url);
          if (
            target.protocol !== "https:" ||
            !target.hostname.endsWith(".amazonaws.com")
          )
            throw new Error("Unexpected upload destination.");
          const fileBody = new FormData();
          for (const [key, value] of Object.entries(upload.fields))
            fileBody.append(key, value);
          fileBody.append("file", files[index], files[index].name);
          const response = await fetch(upload.url, {
            method: "POST",
            body: fileBody,
            signal: controller.signal,
          });
          if (!response.ok)
            throw new Error(
              "A supporting file could not be uploaded. Please try again."
            );
        })
      );
      const response = await fetch(`${config.apiUrl}/v1/${kind}/complete`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          reference: prepared.reference,
          token: prepared.token,
        }),
        signal: controller.signal,
      });
      const data = await response.json();
      if (!response.ok || !data.reference)
        throw new Error(data.error || "Submission failed.");
      return data;
    }
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
export function emailDraft(
  subject,
  lines,
  recipient = "info@projecthamburg.com"
) {
  const a = document.createElement("a");
  a.href = `mailto:${encodeURIComponent(
    recipient
  )}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(
    lines.join("\n")
  )}`;
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
        ],
        config.contact?.email || "info@projecthamburg.com"
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
          estimate: {
            ...estimator.exportData(),
            planReview: undefined,
            ...(estimator.planReview
              ? { planReviewProof: estimator.planReview.proof }
              : {}),
          },
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
