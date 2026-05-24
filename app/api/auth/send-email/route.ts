/**
 * Supabase "Send Email" auth hook endpoint.
 *
 * Configure in Supabase Dashboard → Authentication → Hooks → Send Email:
 *   Type: HTTPS
 *   URL:  https://<your-app>/api/auth/send-email
 *   Secret: click "Generate secret" → copy the full v1,whsec_... value
 *           → set as SUPABASE_AUTH_HOOK_SECRET in Vercel env vars
 *
 * Supabase calls this route for every auth email (magic link, confirmation,
 * invite, password reset) and we send it via Gmail SMTP using Nodemailer.
 */

import { NextRequest, NextResponse } from "next/server";
import { createHmac, timingSafeEqual } from "crypto";
import nodemailer from "nodemailer";
import {
  magicLinkEmail,
  confirmEmail,
  inviteEmail,
  passwordResetEmail,
} from "@/emails/templates";

// Health check — visit this URL in a browser to confirm the endpoint is live.
export function GET() {
  return Response.json({ ok: true, endpoint: "send-email hook" });
}

// Extracts the raw signing key bytes from a Supabase secret.
// Supabase generates secrets in "v1,whsec_<base64>" format — the actual
// key is the base64-decoded portion after the prefix.
function extractKeyBytes(secret: string): Buffer {
  if (secret.startsWith("v1,whsec_")) {
    return Buffer.from(secret.slice("v1,whsec_".length), "base64");
  }
  return Buffer.from(secret, "utf8");
}

// Verifies the Supabase hook request. Handles two formats Supabase may use:
//  1. Svix-style: svix-id / svix-timestamp / svix-signature headers
//  2. JWT Bearer: Authorization: Bearer <hs256-jwt>
function verifyHook(req: NextRequest, rawBody: string, secret: string): boolean {
  const keyBytes = extractKeyBytes(secret);

  // ── Svix (webhook service Supabase uses for some hook types) ───────────────
  const svixId = req.headers.get("svix-id");
  const svixTs = req.headers.get("svix-timestamp");
  const svixSig = req.headers.get("svix-signature");

  if (svixId && svixTs && svixSig) {
    const toSign = `${svixId}.${svixTs}.${rawBody}`;
    const hmac = createHmac("sha256", keyBytes);
    hmac.update(toSign, "utf8");
    const computed = hmac.digest("base64");

    for (const part of svixSig.split(" ")) {
      const comma = part.indexOf(",");
      if (comma === -1) continue;
      const version = part.slice(0, comma);
      const sigB64 = part.slice(comma + 1);
      if (version !== "v1") continue;
      try {
        const a = Buffer.from(computed, "base64");
        const b = Buffer.from(sigB64, "base64");
        if (a.length === b.length && timingSafeEqual(a, b)) return true;
      } catch {}
    }
    return false; // svix headers present → must pass svix check
  }

  // ── JWT Bearer ─────────────────────────────────────────────────────────────
  const auth = req.headers.get("authorization");
  if (!auth?.startsWith("Bearer ")) return false;
  const token = auth.slice(7);

  // Try HS256 JWT signed with the decoded key bytes
  try {
    const parts = token.split(".");
    if (parts.length === 3) {
      const [header, payload, sig] = parts;
      const hmac = createHmac("sha256", keyBytes);
      hmac.update(`${header}.${payload}`);
      const expected = hmac.digest("base64url").replace(/=/g, "");
      const cleanSig = sig.replace(/=/g, "");
      if (expected.length === cleanSig.length) {
        return timingSafeEqual(Buffer.from(expected), Buffer.from(cleanSig));
      }
    }
  } catch {}

  return false;
}

// Maps Supabase's email_action_type to the URL verify type param.
const VERIFY_TYPE: Record<string, string> = {
  signup: "signup",
  magic_link: "magiclink",
  invite: "invite",
  recovery: "recovery",
  email_change_current: "email_change",
  email_change_new: "email_change",
};

const SUBJECTS: Record<string, string> = {
  magic_link: "Your Advantage Portal sign-in link",
  signup: "Confirm your Advantage Portal account",
  invite: "You've been invited to Advantage Portal",
  recovery: "Reset your Advantage Portal password",
  email_change_current: "Confirm your email change",
  email_change_new: "Confirm your new email address",
};

function createTransport() {
  return nodemailer.createTransport({
    host: "smtp.gmail.com",
    port: 587,
    secure: false, // STARTTLS on port 587
    auth: {
      user: process.env.GMAIL_USER,
      pass: process.env.GMAIL_APP_PASSWORD,
    },
  });
}

export async function POST(request: NextRequest) {
  const rawBody = await request.text();

  // ── Auth verification ──────────────────────────────────────────────────────
  const hookSecret = process.env.SUPABASE_AUTH_HOOK_SECRET;
  if (hookSecret) {
    if (!verifyHook(request, rawBody, hookSecret)) {
      console.error("[send-email] Hook signature verification failed");
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
  }

  // ── Parse payload ──────────────────────────────────────────────────────────
  let payload: {
    user: { email: string };
    email_data: {
      token: string;
      token_hash: string;
      redirect_to: string;
      email_action_type: string;
      site_url: string;
    };
  };

  try {
    payload = JSON.parse(rawBody);
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const { user, email_data } = payload;
  const { email } = user;
  const { token_hash, redirect_to, email_action_type, site_url } = email_data;

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL ?? site_url;
  const verifyType = VERIFY_TYPE[email_action_type];

  if (!verifyType) {
    console.warn(`[send-email] Unknown email_action_type: ${email_action_type}`);
    return NextResponse.json({});
  }

  const confirmationUrl =
    `${supabaseUrl}/auth/v1/verify` +
    `?token=${token_hash}` +
    `&type=${verifyType}` +
    `&redirect_to=${encodeURIComponent(redirect_to)}`;

  // ── Build HTML ─────────────────────────────────────────────────────────────
  const props = { email, confirmationUrl };
  let html: string;

  switch (email_action_type) {
    case "magic_link":
      html = magicLinkEmail(props);
      break;
    case "signup":
      html = confirmEmail(props);
      break;
    case "invite":
      html = inviteEmail(props);
      break;
    case "recovery":
      html = passwordResetEmail(props);
      break;
    default:
      html = confirmEmail(props);
  }

  // ── Send via Gmail SMTP ────────────────────────────────────────────────────
  const gmailUser = process.env.GMAIL_USER;
  if (!gmailUser || !process.env.GMAIL_APP_PASSWORD) {
    console.error("[send-email] GMAIL_USER or GMAIL_APP_PASSWORD is not set");
    return NextResponse.json({ error: "Email service not configured" }, { status: 500 });
  }

  const subject = SUBJECTS[email_action_type] ?? "Advantage Portal";
  const from = `"Advantage Portal" <${gmailUser}>`;

  try {
    const transporter = createTransport();
    await transporter.sendMail({ from, to: email, subject, html });
  } catch (err) {
    console.error("[send-email] Gmail SMTP error:", err);
    return NextResponse.json({ error: "Failed to send email" }, { status: 500 });
  }

  return NextResponse.json({});
}
