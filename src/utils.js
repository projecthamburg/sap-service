export const escapeHTML = (value) =>
  String(value ?? "").replace(
    /[&<>"']/g,
    (c) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[
        c
      ])
  );
export const store = {
  get(key) {
    try {
      return localStorage.getItem(`sap:${key}`);
    } catch {
      return null;
    }
  },
  set(key, value) {
    try {
      localStorage.setItem(`sap:${key}`, value);
      return true;
    } catch {
      return false;
    }
  },
};
export const money = (value, lang = "en") =>
  new Intl.NumberFormat(lang === "fr" ? "fr-CA" : "en-CA", {
    style: "currency",
    currency: "CAD",
    maximumFractionDigits: 0,
  }).format(value);
export const number = (value, lang = "en", decimals = 0) =>
  new Intl.NumberFormat(lang === "fr" ? "fr-CA" : "en-CA", {
    maximumFractionDigits: decimals,
  }).format(value);
export function downloadFile(name, text, type = "application/json") {
  const url = URL.createObjectURL(new Blob([text], { type }));
  const a = document.createElement("a");
  a.href = url;
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
export function validateFiles(
  files,
  kind = "project",
  currentCount = 0,
  currentBytes = 0
) {
  const types =
    kind === "resume"
      ? {
          pdf: ["application/pdf"],
          docx: [
            "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
            "application/zip",
          ],
        }
      : {
          pdf: ["application/pdf"],
          jpg: ["image/jpeg"],
          jpeg: ["image/jpeg"],
          png: ["image/png"],
          webp: ["image/webp"],
        };
  const limit = kind === "resume" ? 5 : 10;
  if (currentCount + files.length > (kind === "resume" ? 1 : 6)) return false;
  if (
    currentBytes + [...files].reduce((sum, file) => sum + file.size, 0) >
    25 * 1024 * 1024
  )
    return false;
  return [...files].every(
    (f) =>
      f.size > 0 &&
      f.size <= limit * 1024 * 1024 &&
      Object.hasOwn(types, f.name.split(".").pop().toLowerCase()) &&
      (!f.type || types[f.name.split(".").pop().toLowerCase()].includes(f.type))
  );
}
export function toast(message) {
  const target = document.getElementById("toast");
  if (!target) return;
  target.textContent = message;
  target.hidden = false;
  clearTimeout(toast.timer);
  toast.timer = setTimeout(() => {
    target.hidden = true;
  }, 6500);
}
export function formField(label, name, value = "", options = {}) {
  const {
    type = "text",
    required = false,
    min,
    max,
    step,
    placeholder = "",
    autocomplete = "",
    extra = "",
    full = false,
  } = options;
  return `<label class="field ${full ? "full" : ""}"><span>${escapeHTML(
    label
  )}${
    required ? ' <span class="required" aria-hidden="true">*</span>' : ""
  }</span><input name="${escapeHTML(name)}" type="${type}" value="${escapeHTML(
    value
  )}" ${required ? "required" : ""} ${
    min !== undefined ? `min="${min}"` : ""
  } ${max !== undefined ? `max="${max}"` : ""} ${
    step ? `step="${step}"` : ""
  } ${
    autocomplete ? `autocomplete="${autocomplete}"` : ""
  } placeholder="${escapeHTML(placeholder)}" ${extra}></label>`;
}
export const selectField = (label, name, value, options, full = false) =>
  `<label class="field ${full ? "full" : ""}"><span>${escapeHTML(
    label
  )}</span><select name="${escapeHTML(name)}">${options
    .map(
      ([key, text]) =>
        `<option value="${escapeHTML(key)}" ${
          key === value ? "selected" : ""
        }>${escapeHTML(text)}</option>`
    )
    .join("")}</select></label>`;

export function installLocalizedValidation(root) {
  root.addEventListener(
    "invalid",
    (event) => {
      const field = event.target;
      if (typeof field.setCustomValidity !== "function") return;
      const french = document.documentElement.lang.startsWith("fr");
      let message = french
        ? "Vérifiez la valeur de ce champ."
        : "Please check this field.";
      if (field.validity.valueMissing)
        message = french
          ? field.type === "checkbox"
            ? "Veuillez cocher cette case pour continuer."
            : field.type === "file"
            ? "Veuillez choisir un fichier."
            : "Veuillez remplir ce champ."
          : field.type === "checkbox"
          ? "Please check this box to continue."
          : field.type === "file"
          ? "Please choose a file."
          : "Please complete this field.";
      else if (field.type === "email")
        message = french
          ? "Veuillez entrer une adresse courriel valide."
          : "Please enter a valid email address.";
      else if (field.validity.rangeUnderflow)
        message = french
          ? `La valeur minimale est ${field.min}.`
          : `The minimum value is ${field.min}.`;
      else if (field.validity.rangeOverflow)
        message = french
          ? `La valeur maximale est ${field.max}.`
          : `The maximum value is ${field.max}.`;
      field.setCustomValidity(message);
      field.setAttribute("aria-invalid", "true");
    },
    true
  );
  root.addEventListener("input", (event) => {
    const field = event.target;
    if (typeof field.setCustomValidity === "function") {
      field.setCustomValidity("");
      if (field.validity.valid) field.removeAttribute("aria-invalid");
    }
  });
  root.addEventListener("change", (event) => {
    const field = event.target;
    if (typeof field.setCustomValidity === "function") {
      field.setCustomValidity("");
      if (field.validity.valid) field.removeAttribute("aria-invalid");
    }
  });
}
