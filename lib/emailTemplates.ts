const APP_URL = process.env.NEXT_PUBLIC_APP_URL || "https://getrestok.com";
const SUPPORT_EMAIL = "support@getrestok.com";

type Cta = {
  label: string;
  href: string;
};

type LayoutOptions = {
  eyebrow?: string;
  title: string;
  intro: string;
  bodyHtml?: string;
  cta?: Cta;
  footerNote?: string;
  tone?: "default" | "alert" | "warning" | "success";
};

type PasswordSetupEmailOptions = {
  recipientName?: string | null;
  setupUrl: string;
  orgName?: string | null;
  invited?: boolean;
};

type StockAlertOptions = {
  itemName: string;
  daysLeft: number;
  orgName?: string | null;
  locationName?: string | null;
  vendorName?: string | null;
  reviewUrl?: string;
};

type ContactPayload = {
  topic?: string;
  name?: string;
  email?: string;
  business?: string;
  message?: string;
};

type SupportPayload = {
  subject: string;
  message: string;
  metadata?: {
    name?: string;
    email?: string;
    orgName?: string;
    plan?: string;
    uid?: string;
  };
};

type InboundForwardPayload = {
  from?: string;
  subject?: string;
  html?: string;
  text?: string;
};

function escapeHtml(value: string) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function nl2br(value: string) {
  return escapeHtml(value).replace(/\n/g, "<br />");
}

function getToneStyles(tone: LayoutOptions["tone"]) {
  switch (tone) {
    case "alert":
      return {
        accent: "#dc2626",
        accentSoft: "#fee2e2",
        accentBorder: "#fecaca",
      };
    case "warning":
      return {
        accent: "#d97706",
        accentSoft: "#fef3c7",
        accentBorder: "#fde68a",
      };
    case "success":
      return {
        accent: "#0f766e",
        accentSoft: "#ccfbf1",
        accentBorder: "#99f6e4",
      };
    default:
      return {
        accent: "#0284c7",
        accentSoft: "#e0f2fe",
        accentBorder: "#bae6fd",
      };
  }
}

function renderEmailLayout({
  eyebrow,
  title,
  intro,
  bodyHtml = "",
  cta,
  footerNote,
  tone = "default",
}: LayoutOptions) {
  const toneStyles = getToneStyles(tone);

  return `
<!DOCTYPE html>
<html lang="en">
  <body style="margin:0;padding:0;background:#f3f8fc;color:#0f172a;">
    <table width="100%" cellpadding="0" cellspacing="0" style="background:#f3f8fc;padding:28px 12px;">
      <tr>
        <td align="center">
          <table width="100%" cellpadding="0" cellspacing="0" style="max-width:620px;">
            <tr>
              <td style="padding:0 0 14px 6px;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Arial,sans-serif;">
                <div style="font-size:24px;font-weight:800;letter-spacing:-0.03em;color:#0f172a;">Restok</div>
                <div style="margin-top:4px;font-size:13px;color:#64748b;">Quietly keeping your reorders on track.</div>
              </td>
            </tr>
            <tr>
              <td style="border-radius:28px;background:#ffffff;border:1px solid #dbe7f2;box-shadow:0 18px 42px rgba(15,23,42,0.08);overflow:hidden;">
                <div style="height:10px;background:linear-gradient(90deg, ${toneStyles.accent} 0%, #38bdf8 100%);"></div>
                <div style="padding:34px 34px 30px;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Arial,sans-serif;">
                  ${
                    eyebrow
                      ? `<div style="display:inline-block;margin-bottom:14px;padding:8px 14px;border-radius:999px;background:${toneStyles.accentSoft};border:1px solid ${toneStyles.accentBorder};font-size:12px;font-weight:700;letter-spacing:0.18em;text-transform:uppercase;color:${toneStyles.accent};">${escapeHtml(
                          eyebrow
                        )}</div>`
                      : ""
                  }
                  <h1 style="margin:0 0 12px;font-size:34px;line-height:1.1;letter-spacing:-0.04em;color:#0f172a;">${escapeHtml(
                    title
                  )}</h1>
                  <p style="margin:0 0 20px;font-size:16px;line-height:1.7;color:#475569;">${intro}</p>
                  ${bodyHtml}
                  ${
                    cta
                      ? `<div style="margin-top:28px;">
                          <a href="${cta.href}" style="display:inline-block;padding:14px 22px;border-radius:16px;background:${toneStyles.accent};color:#ffffff;text-decoration:none;font-size:15px;font-weight:700;">
                            ${escapeHtml(cta.label)}
                          </a>
                        </div>`
                      : ""
                  }
                  <div style="margin-top:28px;padding-top:20px;border-top:1px solid #e2e8f0;font-size:13px;line-height:1.7;color:#64748b;">
                    ${footerNote || "Questions? Just reply to this email or reach us at support@getrestok.com."}
                  </div>
                </div>
              </td>
            </tr>
            <tr>
              <td style="padding:16px 6px 0;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Arial,sans-serif;font-size:12px;color:#94a3b8;text-align:center;">
                © ${new Date().getFullYear()} Restok · <a href="${APP_URL}" style="color:#64748b;text-decoration:none;">getrestok.com</a>
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>
  </body>
</html>
`;
}

function buildDetailsTable(rows: Array<[string, string | null | undefined]>) {
  const visibleRows = rows.filter(([, value]) => value && value.trim());
  if (!visibleRows.length) return "";

  return `
    <table width="100%" cellpadding="0" cellspacing="0" style="margin-top:22px;border-collapse:separate;border-spacing:0 10px;">
      ${visibleRows
        .map(
          ([label, value]) => `
            <tr>
              <td valign="top" style="width:120px;padding-right:12px;font-size:13px;font-weight:700;color:#475569;">${escapeHtml(
                label
              )}</td>
              <td style="font-size:14px;line-height:1.6;color:#0f172a;">${escapeHtml(
                value || ""
              )}</td>
            </tr>
          `
        )
        .join("")}
    </table>
  `;
}

export function buildPasswordSetupEmail({
  recipientName,
  setupUrl,
  orgName,
  invited = false,
}: PasswordSetupEmailOptions) {
  const greeting = recipientName ? `Hi ${escapeHtml(recipientName)},` : "Hi there,";
  const intro = invited
    ? `${greeting} ${escapeHtml(orgName || "Your team")} invited you to join Restok. Set your password to access your account and start collaborating.`
    : `${greeting} your Restok account is ready. Set your password to finish getting started and open your dashboard.`;

  const bodyHtml = `
    <div style="padding:18px 20px;border-radius:20px;background:#f8fafc;border:1px solid #e2e8f0;">
      <div style="font-size:14px;line-height:1.7;color:#475569;">
        ${
          orgName
            ? `<strong style="color:#0f172a;">Organization:</strong> ${escapeHtml(orgName)}<br />`
            : ""
        }
        <strong style="color:#0f172a;">Link expires:</strong> 24 hours
      </div>
    </div>
  `;

  const text = [
    recipientName ? `Hi ${recipientName},` : "Hi there,",
    invited
      ? `${orgName || "Your team"} invited you to join Restok.`
      : "Your Restok account is ready.",
    `Set your password here: ${setupUrl}`,
    "This link expires in 24 hours.",
  ].join("\n\n");

  return {
    subject: invited
      ? `You're invited to join ${orgName || "your team"} on Restok`
      : "Set your Restok password",
    html: renderEmailLayout({
      eyebrow: invited ? "Team Invite" : "Account Setup",
      title: invited ? "You're invited to Restok" : "Set your password",
      intro,
      bodyHtml,
      cta: { label: "Set Password", href: setupUrl },
      footerNote: `If the button does not work, copy and paste this link into your browser:<br /><a href="${setupUrl}" style="color:#0284c7;text-decoration:none;">${setupUrl}</a><br /><br />Questions? Email ${SUPPORT_EMAIL}.`,
    }),
    text,
  };
}

export function buildStockAlertEmail({
  itemName,
  daysLeft,
  orgName,
  locationName,
  vendorName,
  reviewUrl = `${APP_URL}/dashboard/restock`,
}: StockAlertOptions) {
  const isOut = daysLeft <= 0;
  const title = isOut ? "An item may be out" : "An item needs attention soon";
  const intro = isOut
    ? `${escapeHtml(itemName)} may have run out and should be reviewed as soon as possible.`
    : `${escapeHtml(itemName)} is projected to run out in <strong>${daysLeft} day${
        daysLeft === 1 ? "" : "s"
      }</strong>.`;
  const bodyHtml = `
    <div style="padding:18px 20px;border-radius:20px;background:${
      isOut ? "#fef2f2" : "#fff7ed"
    };border:1px solid ${isOut ? "#fecaca" : "#fed7aa"};">
      <div style="font-size:22px;font-weight:800;letter-spacing:-0.03em;color:#0f172a;">
        ${escapeHtml(itemName)}
      </div>
      ${buildDetailsTable([
        ["Organization", orgName || ""],
        ["Location", locationName || ""],
        ["Vendor", vendorName || ""],
        ["Status", isOut ? "May be out of stock" : `${daysLeft} day${daysLeft === 1 ? "" : "s"} left`],
      ])}
    </div>
  `;

  const text = [
    title,
    `${itemName} ${isOut ? "may be out of stock." : `may run out in ${daysLeft} day${daysLeft === 1 ? "" : "s"}.`}`,
    orgName ? `Organization: ${orgName}` : null,
    locationName ? `Location: ${locationName}` : null,
    vendorName ? `Vendor: ${vendorName}` : null,
    `Review it here: ${reviewUrl}`,
  ]
    .filter(Boolean)
    .join("\n");

  return {
    subject: isOut ? `Restok alert: ${itemName} may be out` : `Restok alert: ${itemName} is running low`,
    html: renderEmailLayout({
      eyebrow: isOut ? "Restock Alert" : "Low Stock Alert",
      title,
      intro,
      bodyHtml,
      cta: { label: "Review in Restok", href: reviewUrl },
      tone: isOut ? "alert" : "warning",
    }),
    text,
  };
}

export function buildContactNotificationEmail(payload: ContactPayload) {
  const safeMessage = payload.message || "";
  const bodyHtml = `
    <div style="padding:18px 20px;border-radius:20px;background:#f8fafc;border:1px solid #e2e8f0;">
      <div style="font-size:14px;line-height:1.75;color:#0f172a;">${nl2br(
        safeMessage
      )}</div>
    </div>
    ${buildDetailsTable([
      ["Topic", payload.topic || "General"],
      ["Name", payload.name || ""],
      ["Email", payload.email || ""],
      ["Business", payload.business || ""],
    ])}
  `;

  return {
    subject: `Contact: ${payload.topic || "General question"}`,
    html: renderEmailLayout({
      eyebrow: "Contact Form",
      title: "New contact message",
      intro: "A new message came in from the public contact form.",
      bodyHtml,
    }),
    text: [
      "New contact message",
      `Topic: ${payload.topic || "General question"}`,
      `Name: ${payload.name || ""}`,
      `Email: ${payload.email || ""}`,
      `Business: ${payload.business || ""}`,
      "",
      safeMessage,
    ].join("\n"),
  };
}

export function buildContactConfirmationEmail(payload: ContactPayload) {
  const name = payload.name ? escapeHtml(payload.name) : "there";
  return {
    subject: "We got your message",
    html: renderEmailLayout({
      eyebrow: "Contact Received",
      title: "Thanks for reaching out",
      intro: `Hi ${name}, we received your message and will get back to you as soon as we can.`,
      bodyHtml: buildDetailsTable([
        ["Topic", payload.topic || "General"],
        ["Business", payload.business || ""],
      ]),
      cta: { label: "Visit Restok", href: APP_URL },
      tone: "success",
    }),
    text: [
      `Hi ${payload.name || "there"},`,
      "We received your message and will get back to you soon.",
      payload.topic ? `Topic: ${payload.topic}` : null,
      `Support: ${SUPPORT_EMAIL}`,
    ]
      .filter(Boolean)
      .join("\n"),
  };
}

export function buildSupportNotificationEmail({
  subject,
  message,
  metadata,
}: SupportPayload) {
  const bodyHtml = `
    <div style="padding:18px 20px;border-radius:20px;background:#f8fafc;border:1px solid #e2e8f0;">
      <div style="font-size:14px;line-height:1.75;color:#0f172a;">${nl2br(
        message
      )}</div>
    </div>
    ${buildDetailsTable([
      ["Subject", subject],
      ["Name", metadata?.name || ""],
      ["Email", metadata?.email || ""],
      ["Organization", metadata?.orgName || ""],
      ["Plan", metadata?.plan || ""],
      ["UID", metadata?.uid || ""],
    ])}
  `;

  return {
    subject: `Support — ${subject}`,
    html: renderEmailLayout({
      eyebrow: "Support Request",
      title: "New support request",
      intro: "A user submitted a support request from inside Restok.",
      bodyHtml,
    }),
    text: [
      "New support request",
      `Subject: ${subject}`,
      `Name: ${metadata?.name || ""}`,
      `Email: ${metadata?.email || ""}`,
      `Organization: ${metadata?.orgName || ""}`,
      `Plan: ${metadata?.plan || ""}`,
      `UID: ${metadata?.uid || ""}`,
      "",
      message,
    ].join("\n"),
  };
}

export function buildSupportConfirmationEmail({
  subject,
  metadata,
}: Pick<SupportPayload, "subject" | "metadata">) {
  const name = metadata?.name ? escapeHtml(metadata.name) : "there";
  return {
    subject: "Your support request is in",
    html: renderEmailLayout({
      eyebrow: "Support Received",
      title: "We’ve got your request",
      intro: `Hi ${name}, our team received your support request${subject ? ` about <strong>${escapeHtml(subject)}</strong>` : ""}. We’ll follow up as soon as possible.`,
      bodyHtml: buildDetailsTable([
        ["Organization", metadata?.orgName || ""],
        ["Plan", metadata?.plan || ""],
      ]),
      tone: "success",
      cta: { label: "Open Restok", href: `${APP_URL}/dashboard` },
    }),
    text: [
      `Hi ${metadata?.name || "there"},`,
      "We received your support request and will get back to you soon.",
      subject ? `Subject: ${subject}` : null,
      `Support: ${SUPPORT_EMAIL}`,
    ]
      .filter(Boolean)
      .join("\n"),
  };
}

export function buildInboundForwardEmail({
  from,
  subject,
  html,
  text,
}: InboundForwardPayload) {
  const fallbackMessage = text ? nl2br(text) : "<em>No message body was included.</em>";
  return {
    subject: `FWD: ${subject || "No subject"}`,
    html: renderEmailLayout({
      eyebrow: "Forwarded Reply",
      title: subject || "No subject",
      intro: `Forwarded inbound email from <strong>${escapeHtml(from || "Unknown sender")}</strong>.`,
      bodyHtml: `
        <div style="padding:18px 20px;border-radius:20px;background:#f8fafc;border:1px solid #e2e8f0;">
          ${html || `<div style="font-size:14px;line-height:1.75;color:#0f172a;">${fallbackMessage}</div>`}
        </div>
      `,
    }),
    text: [`Forwarded inbound email from ${from || "Unknown sender"}`, "", text || ""].join(
      "\n"
    ),
  };
}

