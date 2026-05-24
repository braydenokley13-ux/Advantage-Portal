/**
 * Supabase "Send Email" auth hook endpoint.
 *
 * Configure in Supabase Dashboard → Authentication → Hooks → Send Email:
 *   Type: HTTPS
 *   URL:  https://<your-app>/api/auth/send-email
 *   Secret: any random string → set as SUPABASE_AUTH_HOOK_SECRET env var
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

// Health check — lets you confirm the endpoint is reachable before wiring up Supabase.
export function GET() {
  return Response.json({ ok: true, endpoint: "send-email hook" });
}

// Supabase can send the hook secret either as a raw Bearer token or as a
// HS256 JWT. We try both so the verification works regardless of format.
function verifyHookSecret(authHeader: string | null, secret: string): boolean {
  if (!authHeader?.startsWith("Bearer ")) return false;
  const token = authHeader.slice(7);

  // Attempt 1: raw secret comparison (some Supabase versions send it plain)
  try {
    const a = Buffer.from(token, "utf8");
    const b = Buffer.from(secret, "utf8");
    if (a.length === b.length && timingSafeEqual(a, b)) return true;
  } catch {}

  // Attempt 2: HS256 JWT verification
  try {
    const parts = token.split(".");
    if (parts.length !== 3) return false;
    const [header, payload, sig] = parts;
    const hmac = createHmac("sha256", secret);
    hmac.update(`${header}.${payload}`);
    const expected = hmac.digest("base64url").replace(/=/g, "");
    const cleanSig = sig.replace(/=/g, "");
    if (expected.length !== cleanSig.length) return false;
    return timingSafeEqual(Buffer.from(expected), Buffer.from(cleanSig));
  } catch {
    return false;
  }
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
    secure: false, // uses STARTTLS on port 587
    auth: {
      user: process.env.GMAIL_USER,
      pass: process.env.GMAIL_APP_PASSWORD,
    },
  });
}

export async function POST(request: NextRequest) {
  // ── Auth verification ──────────────────────────────────────────────────────
  const hookSecret = process.env.SUPABASE_AUTH_HOOK_SECRET;
  if (hookSecret) {
    const auth = request.headers.get("authorization");
    if (!verifyHookSecret(auth, hookSecret)) {
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
    payload = await request.json();
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

  // Standard Supabase confirmation URL.
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
