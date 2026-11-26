import "server-only";
import nodemailer, { type Transporter } from "nodemailer";
import { APP_NAME, optionalEnv, siteUrl } from "./env";

let transport: Transporter | null = null;

export function emailConfigured() {
  return Boolean(optionalEnv("SMTP_HOST") && optionalEnv("SMTP_USER") && optionalEnv("SMTP_PASS"));
}

function getTransport() {
  if (!transport) {
    const port = Number(optionalEnv("SMTP_PORT") ?? 465);
    transport = nodemailer.createTransport({
      host: optionalEnv("SMTP_HOST"),
      port,
      secure: port === 465,
      auth: { user: optionalEnv("SMTP_USER"), pass: optionalEnv("SMTP_PASS") },
    });
  }
  return transport;
}

const esc = (s: string) =>
  s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);

export function emailLayout(heading: string, paragraphs: string[], cta?: { label: string; href: string }) {
  const body = paragraphs.map((p) => `<p style="margin:0 0 12px;line-height:1.5">${esc(p)}</p>`).join("");
  const button = cta
    ? `<p style="margin:20px 0"><a href="${esc(cta.href)}" style="background:#0f766e;color:#fff;padding:10px 18px;border-radius:8px;text-decoration:none;font-weight:600">${esc(cta.label)}</a></p>`
    : "";
  return `<div style="font-family:Segoe UI,Arial,sans-serif;max-width:560px;margin:auto;padding:24px;color:#0f172a">
<div style="font-weight:700;color:#0f766e;margin-bottom:16px">✓ ${APP_NAME}</div>
<h2 style="margin:0 0 12px;font-size:18px">${esc(heading)}</h2>${body}${button}
<p style="color:#64748b;font-size:12px;margin-top:24px">You get this because you use ${APP_NAME} at ${esc(siteUrl())}.</p></div>`;
}

export async function sendEmail(to: string, subject: string, html: string): Promise<boolean> {
  if (!emailConfigured()) return false;
  try {
    await getTransport().sendMail({
      from: optionalEnv("SMTP_FROM") ?? `${APP_NAME} <${optionalEnv("SMTP_USER")}>`,
      to,
      subject,
      html,
    });
    return true;
  } catch (e) {
    console.error("email failed", e);
    return false;
  }
}
