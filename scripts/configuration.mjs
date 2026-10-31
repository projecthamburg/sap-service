import { readFile } from "node:fs/promises";
const root = new URL("../", import.meta.url);
const email = (value) =>
  typeof value === "string" &&
  /^[^\s@<>"']+@[^\s@<>"']+\.[^\s@<>"']+$/.test(value);
const https = (value) => {
  try {
    const u = new URL(value);
    return u.protocol === "https:" && !u.username && !u.password;
  } catch {
    return false;
  }
};
export async function loadOperations(
  path = new URL("config/operations.json", root)
) {
  const settings = JSON.parse(await readFile(path, "utf8"));
  if (
    settings.version !== 1 ||
    !["proposal", "live"].includes(settings.stage) ||
    !https(settings.siteUrl) ||
    !https(settings.bookingUrl) ||
    !https(settings.operator?.website) ||
    !email(settings.operator?.email) ||
    !email(settings.contact?.email) ||
    !email(settings.notifications?.to) ||
    /[\r\n]/.test(settings.notifications?.from || "")
  )
    throw Error("Invalid operations configuration.");
  if (settings.contact.phone && !/^\+[0-9]{7,15}$/.test(settings.contact.phone))
    throw Error("Contact phone must use international format.");
  if (
    settings.stage === "proposal" &&
    (settings.notifications.to !== settings.operator.email ||
      settings.contact.email !== settings.operator.email ||
      settings.contact.phone)
  )
    throw Error(
      "Proposal intake must remain with Project Hamburg's configured operator."
    );
  return settings;
}
export async function loadPublicConfiguration() {
  const operations = await loadOperations();
  const current = JSON.parse(
    await readFile(new URL("public/site-config.json", root), "utf8")
  );
  return {
    ...current,
    stage: operations.stage,
    contact: operations.contact,
    operator: {
      name: operations.operator.name,
      website: operations.operator.website,
    },
    bookingUrl: operations.bookingUrl,
  };
}

// Keep no-JavaScript contacts and structured data on the same handover profile.
export function configureDocument(html, operations) {
  const escape = value => String(value).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  html = html.replace(/(<script type="application\/ld\+json">)([\s\S]*?)(<\/script>)/, (_, open, raw, close) => {
    const schema = JSON.parse(raw);
    schema.email = operations.contact.email;
    if (operations.contact.phone) schema.telephone = operations.contact.phone;
    else delete schema.telephone;
    return open + JSON.stringify(schema, null, 2).replaceAll('<','\\u003c') + close;
  });
  return html.replace(/<noscript[\s\S]*?<\/noscript>/, `<noscript><main style="max-width:50rem;margin:4rem auto;padding:2rem;font-family:Arial,sans-serif"><h1>SAP Service Inc.</h1><p>Nettoyage de chantier · Construction cleaning · Montréal, Québec &amp; Ontario.</p><p>${operations.stage === 'proposal' ? 'Demandes pour la proposition / Proposal enquiries' : 'Contact'}: <a href="mailto:${escape(operations.contact.email)}">${escape(operations.contact.name)} · ${escape(operations.contact.email)}</a></p><p><a href="${escape(operations.bookingUrl)}">Planifier une consultation / Book a consultation</a></p><p>Activez JavaScript pour accéder à l’estimateur. Enable JavaScript to use the estimator.</p></main></noscript>`);
}
