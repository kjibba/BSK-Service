import * as nodemailer from 'nodemailer';
import type { Transporter } from 'nodemailer';

// Simple transporter using environment or fallback to Ethereal-like config
// For now, we will use direct transport if available; otherwise log-only mode.

const SMTP_HOST = process.env.SMTP_HOST;
const SMTP_PORT = process.env.SMTP_PORT ? Number(process.env.SMTP_PORT) : 587;
const SMTP_USER = process.env.SMTP_USER;
const SMTP_PASS = process.env.SMTP_PASS;

export const transporter: Transporter = (SMTP_HOST && SMTP_USER && SMTP_PASS)
  ? nodemailer.createTransport({
      host: SMTP_HOST,
      port: SMTP_PORT,
      secure: SMTP_PORT === 465,
      auth: { user: SMTP_USER, pass: SMTP_PASS },
    })
  : nodemailer.createTransport({ jsonTransport: true }); // fallback: write to console

export async function sendMail(opts: {
  to: string;
  subject: string;
  html: string;
  attachments?: { filename: string; path: string; contentType?: string }[];
}) {
  const from = process.env.MAIL_FROM || 'no-reply@bsk-service.local';
  const info = await transporter.sendMail({ from, ...opts });
  return info;
}
