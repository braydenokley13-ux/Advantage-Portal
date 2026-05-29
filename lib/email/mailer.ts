import nodemailer, { type Transporter } from "nodemailer";

export class EmailConfigurationError extends Error {
  constructor(message = "Email service is not configured.") {
    super(message);
    this.name = "EmailConfigurationError";
  }
}

type SmtpConfig = {
  host: string;
  port: number;
  secure: boolean;
  user: string;
  pass: string;
  fromName: string;
  fromAddress: string;
};

type SendEmailInput = {
  to: string;
  subject: string;
  html: string;
  text?: string;
  replyTo?: string;
};

let transporter: Transporter | null = null;
let transporterKey: string | null = null;

function clean(raw: string | undefined): string | undefined {
  if (typeof raw !== "string") return undefined;
  const cleaned = raw
    .trim()
    .replace(/^(["'])([\s\S]*)\1$/, "$2")
    .trim();
  return cleaned.length > 0 ? cleaned : undefined;
}

function normalizeBoolean(raw: string | undefined, fallback: boolean) {
  const value = clean(raw)?.toLowerCase();
  if (!value) return fallback;
  return ["1", "true", "yes", "on"].includes(value);
}

export function normalizeEmailAddress(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const email = value.trim().toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return null;
  return email;
}

function quoteDisplayName(value: string) {
  return value.replace(/["\\]/g, "\\$&");
}

function readSmtpConfig(): SmtpConfig {
  const user = clean(process.env.SMTP_USER) ?? clean(process.env.GMAIL_USER);
  const rawPass =
    clean(process.env.SMTP_PASSWORD) ?? clean(process.env.GMAIL_APP_PASSWORD);
  const pass = rawPass?.replace(/\s+/g, "");

  if (!user || !pass) {
    throw new EmailConfigurationError(
      "Set SMTP_USER/SMTP_PASSWORD or GMAIL_USER/GMAIL_APP_PASSWORD before sending email."
    );
  }

  const host = clean(process.env.SMTP_HOST) ?? "smtp.gmail.com";
  const port = Number(clean(process.env.SMTP_PORT) ?? "587");
  if (!Number.isInteger(port) || port <= 0) {
    throw new EmailConfigurationError("SMTP_PORT must be a positive number.");
  }

  const fromAddress = clean(process.env.EMAIL_FROM_ADDRESS) ?? user;
  if (!normalizeEmailAddress(fromAddress)) {
    throw new EmailConfigurationError(
      "EMAIL_FROM_ADDRESS must be a valid email address."
    );
  }

  return {
    host,
    port,
    secure: normalizeBoolean(process.env.SMTP_SECURE, port === 465),
    user,
    pass,
    fromName: clean(process.env.EMAIL_FROM_NAME) ?? "Advantage Portal",
    fromAddress,
  };
}

function getTransporter(config: SmtpConfig) {
  const key = `${config.host}:${config.port}:${config.secure}:${config.user}`;
  if (transporter && transporterKey === key) return transporter;

  transporter = nodemailer.createTransport({
    host: config.host,
    port: config.port,
    secure: config.secure,
    auth: { user: config.user, pass: config.pass },
  });
  transporterKey = key;
  return transporter;
}

export function emailIsConfigured(): boolean {
  try {
    readSmtpConfig();
    return true;
  } catch {
    return false;
  }
}

export async function sendEmail(input: SendEmailInput) {
  const to = normalizeEmailAddress(input.to);
  if (!to) throw new Error("Recipient email address is invalid.");

  const replyTo = input.replyTo
    ? (normalizeEmailAddress(input.replyTo) ?? undefined)
    : undefined;
  if (input.replyTo && !replyTo) throw new Error("Reply-to email is invalid.");

  const config = readSmtpConfig();
  const from = `"${quoteDisplayName(config.fromName)}" <${config.fromAddress}>`;
  const smtp = getTransporter(config);

  return smtp.sendMail({
    from,
    to,
    replyTo,
    subject: input.subject,
    html: input.html,
    text: input.text,
  });
}
