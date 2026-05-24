/**
 * Supabase "Send Email" auth hook endpoint.
 *
 * Configure in Supabase Dashboard → Authentication → Hooks → Send Email:
 *   Type: HTTPS
 *   URL:  https://<your-app>/api/auth/send-email
 *   Secret: any random string → set as SUPABASE_AUTH_HOOK_SECRET env var
 *
 * Supabase calls this route for every auth email (magic link, confirmation,
 * invite, password reset) and we send the email via Resend instead.
 */

import { NextRequest, NextResponse } from "next/server";
import { createHmac, timingSafeEqual } from "crypto";
import { Resend } from "resend";
import {
  magicLinkEmail,
  confirmEmail,
  inviteEmail,
  passwordResetEmail,
} from "@/emails/templates";

// Supabase sends a JWT (HS256) in Authorization: Bearer <jwt>.
// This verifies the signature without an external JWT library.
function verifyHookJWT(authHeader: string | null, secret: string): boolean {
  if (!authHeader?.startsWith("Bearer ")) return false;
  const token = authHeader.slice(7);
  const parts = token.split(".");
  if (parts.length !== 3) return false;
  const [header, payload, sig] = parts;
  const hmac = createHmac("sha256", secret);
  hmac.update(`${header}.${payload}`);
  const expected = hmac.digest("base64url");
  try {
    return timingSafeEqual(Buffer.from(expected), Buffer.from(sig));
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

export async function POST(request: NextRequest) {
  // ── Auth verification ──────────────────────────────────────────────────────
  const hookSecret = process.env.SUPABASE_AUTH_HOOK_SECRET;
  if (hookSecret) {
    const auth = request.headers.get("authorization");
    if (!verifyHookJWT(auth, hookSecret)) {
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
    // Unknown type — return 200 so Supabase doesn't retry indefinitely.
    console.warn(`[send-email] Unknown email_action_type: ${email_action_type}`);
    return NextResponse.json({});
  }

  // Build the standard Supabase confirmation URL.
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
      // email_change flows — reuse confirmation template
      html = confirmEmail(props);
  }

  // ── Send via Resend ────────────────────────────────────────────────────────
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) {
    console.error("[send-email] RESEND_API_KEY is not set");
    return NextResponse.json({ error: "Email service not configured" }, { status: 500 });
  }

  const resend = new Resend(apiKey);
  const from = process.env.RESEND_FROM_EMAIL ?? "noreply@example.com";
  const subject = SUBJECTS[email_action_type] ?? "Advantage Portal";

  const { error } = await resend.emails.send({ from, to: email, subject, html });

  if (error) {
    console.error("[send-email] Resend error:", error);
    return NextResponse.json({ error: "Failed to send email" }, { status: 500 });
  }

  return NextResponse.json({});
}
