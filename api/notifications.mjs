const escape = (value) =>
  String(value ?? "").replace(
    /[&<>"']/g,
    (c) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[
        c
      ])
  );
export function notificationEmail(record) {
  const payload = record.payload,
    contact = payload.contact || payload;
  const operatorName = process.env.OPERATOR_NAME || "Project Hamburg";
  const intakeLabel = `${operatorName} · ${process.env.OPERATING_STAGE === "live" ? "Website intake / Réception du site" : "Proposal intake / Réception de la proposition"}`;
  const title =
    record.kind === "quote"
      ? "Quotation request / Demande de soumission"
      : "Job application / Candidature";
  const details =
    record.kind === "quote"
      ? [
          ["Company", contact.company || "—"],
          ["Project", payload.estimate.scope.name || "—"],
          [
            "Location",
            `${payload.estimate.scope.city} (${payload.estimate.scope.province})`,
          ],
          ["Cleanable area", `${payload.estimate.estimate.totalSqFt} sq ft`],
          ["Cleaning phases", payload.estimate.scope.phases.join(", ")],
          ["Cleaning date", payload.estimate.scope.cleanDate || "—"],
          ["Handover date", payload.estimate.scope.handoverDate || "—"],
          [
            "Illustrative planning range",
            `CAD ${Math.round(payload.estimate.estimate.low)}–${Math.round(
              payload.estimate.estimate.high
            )} (not a quotation)`,
          ],
          ["Notes", payload.notes || "—"],
        ]
      : [
          ["Location", `${payload.city} (${payload.province || "QC"})`],
          ["Working regions", payload.regions],
          ["Experience", `${payload.experience || 0} years`],
          ["Languages", payload.languages],
          ["Available from", payload.start || "—"],
          ["ASP training", payload.asp || "—"],
          ["Availability", payload.availability.join(", ")],
          ["Hours", payload.hours || "—"],
          ["Note", payload.cover || "—"],
        ];
  const rows = [
    ["Reference", record.pk],
    ["Name", contact.name],
    ["Email", contact.email],
    ["Telephone", contact.phone || "—"],
    ...details,
    [
      "Private attachments",
      record.files.map((f) => f.name).join(", ") || "None",
    ],
  ];
  const inbox = `${process.env.SITE_URL}#/${
    payload.language === "fr" ? "fr" : "en"
  }/inbox`;
  return {
    from: process.env.NOTIFICATION_FROM,
    to: [process.env.NOTIFICATION_TO],
    reply_to: contact.email,
    subject: `SAP — ${title} — ${record.pk}`,
    text: [
      `SAP Service Inc. — ${intakeLabel}`,
      title,
      "",
      ...rows.map(([k, v]) => `${k}: ${v}`),
      "",
      "Review and download private files in the authenticated SAP inbox:",
      inbox,
      "Files are not attached to this email. Do not forward applicant information or confidential plans unnecessarily.",
      "Website designed and built by Project Hamburg — https://projecthamburg.com/",
    ].join("\n"),
    html: `<div style="font-family:Arial,sans-serif;max-width:640px;margin:auto;color:#1e2d53"><div style="background:#1e2d53;color:white;padding:28px"><p style="margin:0 0 12px;font-size:12px;letter-spacing:2px">SAP SERVICE INC.</p><h1 style="font-size:24px;margin:0">${escape(
      title
    )}</h1><p>${escape(intakeLabel)}</p></div><div style="padding:24px;background:#f4f5f7"><table style="width:100%;border-collapse:collapse">${rows
      .map(
        ([k, v]) =>
          `<tr><th style="vertical-align:top;text-align:left;padding:12px 12px 12px 0;border-bottom:1px solid #dfe3e9;font-size:13px">${escape(
            k
          )}</th><td style="padding:12px 0;border-bottom:1px solid #dfe3e9;overflow-wrap:anywhere;white-space:pre-line;font-size:14px">${escape(
            v
          )}</td></tr>`
      )
      .join("")}</table><p style="margin:28px 0"><a href="${escape(
      inbox
    )}" style="background:#bc2345;color:white;padding:14px 20px;text-decoration:none;display:inline-block">Open private inbox / Ouvrir la boîte privée</a></p><p style="font-size:13px;line-height:1.6">Attachments remain in private Canadian storage. Inbox sign-in is required; this email contains no file access token.</p><p style="font-size:12px">Website designed and built by <a href="https://projecthamburg.com/">Project Hamburg</a>.</p></div></div>`,
  };
}
export async function sendNotification(email, idempotencyKey) {
  if (!process.env.RESEND_API_KEY)
    throw new Error("notification_configuration_missing");
  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${process.env.RESEND_API_KEY}`,
      "Content-Type": "application/json",
      "Idempotency-Key": idempotencyKey,
    },
    body: JSON.stringify(email),
    signal: AbortSignal.timeout(8000),
  });
  if (!response.ok) throw new Error(`notification_provider_${response.status}`);
  const result = await response.json();
  if (!result.id) throw new Error("notification_provider_invalid_response");
  return { id: result.id };
}
