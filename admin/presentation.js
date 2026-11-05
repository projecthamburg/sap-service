// Presentation only: the original research record and its qualifications stay intact.
import { contractorName } from "./model.js";
export function readable(value = "") {
  return String(value)
    .replace(/\s*\[(?:CONFIRMED|UNCONFIRMED|INFERRED)\b[^\]]*\]/gi, "")
    .replace(/\s+/g, " ")
    .trim();
}
export function fieldDate(value, w) {
  const text = String(value || ""),
    dateOnly = text.match(/^\d{4}-\d{2}-\d{2}/)?.[0];
  if (!dateOnly) return "";
  const day = new Date(dateOnly + "T12:00:00Z");
  if (!Number.isFinite(+day) || day.toISOString().slice(0, 10) !== dateOnly)
    return "";
  if (/^\d{4}-\d{2}-\d{2}T/.test(text)) {
    const moment = new Date(text);
    if (!Number.isFinite(+moment)) return "";
    return moment.toLocaleString(w("en-CA", "fr-CA"), {
      timeZone: "America/Toronto",
      year: "numeric",
      month: "short",
      day: "numeric",
      hour: "numeric",
      minute: "2-digit",
    });
  }
  return day.toLocaleDateString(w("en-CA", "fr-CA"), {
    timeZone: "UTC",
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}
export function siteTitle(value) {
  const title = readable(value);
  return (
    title
      .replace(/\(([^()]*)\)/g, (whole, note) =>
        /\$\s*\d|\b\d+[- ]?bed\b|\bDBFM\b|\bP3\b/i.test(note) ? "" : whole
      )
      .replace(/\s+/g, " ")
      .trim() || title
  );
}
export function companyLabel(record, w) {
  const name = contractorName(record.general_contractor || "");
  return /^(?:unknown|not identified|not listed|tbd|to confirm)\b/i.test(name)
    ? w("Not listed", "Non indiqué")
    : readable(name);
}
export function stageLabel(value, w) {
  const labels = {
    active: ["Active site", "Site actif"],
    finishing: ["Finishing", "Finition"],
    finished: ["Finished", "Terminé"],
    "planning/zoning": ["Planning", "Planification"],
    "tender/award": ["Tender stage", "Appel d’offres"],
    "active construction": ["Under construction", "En construction"],
    "interior finishing": ["Interior finishing", "Finition intérieure"],
    "inspection/handover": ["Final inspection", "Inspection finale"],
    "post-handover": ["After handover", "Après la livraison"],
    "reopening/reconstruction": [
      "Rebuild / reopening",
      "Reconstruction / réouverture",
    ],
    "Field observation": ["Saved site", "Site enregistré"],
  };
  return labels[value] ? w(...labels[value]) : readable(value);
}
export function priorityLabel(value, w) {
  const labels = {
    Immediate: ["Contact soon", "À contacter"],
    "Near-term": ["Coming up", "À venir"],
    Strategic: ["Longer term", "Plus tard"],
    Monitor: ["Watchlist", "À surveiller"],
    Unqualified: ["Saved site", "Site enregistré"],
  };
  return labels[value] ? w(...labels[value]) : readable(value);
}
export function contactOptions(record) {
  const phones = (record.telephones || []).flatMap((label) => {
    const match = label
      .trim()
      .match(/^([+0-9(). -]+?)(?:\s*(?:ext\.?|x|#)\s*(\d{1,8}))?$/i);
    if (!match) return [];
    const dial = match[1].replace(/[^+0-9]/g, "");
    return /^\+?\d{7,15}$/.test(dial)
      ? [{ label, href: "tel:" + dial + (match[2] ? ";ext=" + match[2] : "") }]
      : [];
  });
  const emails = (record.emails || [])
    .filter(
      (e) =>
        /^[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,63}$/i.test(e) &&
        !/%0[ad]/i.test(e)
    )
    .map((label) => ({
      label,
      href:
        "mailto:" +
        encodeURIComponent(label) +
        "?subject=" +
        encodeURIComponent(record.project_name),
    }));
  return { phones, emails };
}
