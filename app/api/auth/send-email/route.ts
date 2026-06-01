/**
 * Supabase "Send Email" auth hook endpoint.
 *
 * Configure in Supabase Dashboard -> Authentication -> Hooks -> Send Email:
 *   Type: HTTPS
 *   URL:  https://<your-app>/api/auth/send-email
 *   Secret: click "Generate secret", then set the full v1,whsec_... value
 *           as SUPABASE_AUTH_HOOK_SECRET in the app environment.
 */

import { NextRequest, NextResponse } from "next/server";
import { createHmac, timingSafeEqual } from "crypto";
import { z } from "zod";
import { authTokenCallbackUrlFromRedirect } from "@/lib/auth/redirects";
import { normalizeEmailAddress, sendEmail } from "@/lib/email/mailer";
import { getSupabaseProjectUrl } from "@/lib/supabase/admin";
import {
  magicLinkEmail,
  confirmEmail,
  inviteEmail,
  passwordResetEmail,
} from "@/emails/templates";

export function GET() {
  return Response.json({ ok: true, endpoint: "send-email hook" });
}

const EmailAction = z.enum([
  "signup",
  "magic_link",
  "invite",
  "recovery",
  "email_change",
  "email_change_current",
  "email_change_new",
]);

const HookPayload = z.object({
  user: z.object({
    email: z.string().email(),
    new_email: z.string().email().optional().or(z.literal("")),
  }),
  email_data: z.object({
    token_hash: z.string().optional().default(""),
    token_hash_new: z.string().optional().default(""),
    redirect_to: z.string().url(),
    email_action_type: EmailAction,
  }),
});

type HookPayload = z.infer<typeof HookPayload>;

const VERIFY_TYPE: Record<z.infer<typeof EmailAction>, string> = {
  signup: "signup",
  magic_link: "magiclink",
  invite: "invite",
  recovery: "recovery",
  email_change: "email_change",
  email_change_current: "email_change",
  email_change_new: "email_change",
};

const SUBJECTS: Record<z.infer<typeof EmailAction>, string> = {
  magic_link: "Your Advantage Portal sign-in link",
  signup: "Confirm your Advantage Portal account",
  invite: "You've been invited to Advantage Portal",
  recovery: "Reset your Advantage Portal password",
  email_change: "Confirm your email change",
  email_change_current: "Confirm your current email address",
  email_change_new: "Confirm your new email address",
};

function extractKeyBytes(secret: string): Buffer {
  if (secret.startsWith("v1,whsec_")) {
    return Buffer.from(secret.slice("v1,whsec_".length), "base64");
  }
  if (secret.startsWith("whsec_")) {
    return Buffer.from(secret.slice("whsec_".length), "base64");
  }
  return Buffer.from(secret, "utf8");
}

function hasSafeEqual(a: Buffer, b: Buffer) {
  return a.length === b.length && timingSafeEqual(a, b);
}

function verifyWebhookSignature(
  req: NextRequest,
  rawBody: string,
  secret: string
): boolean {
  const id = req.headers.get("webhook-id") ?? req.headers.get("svix-id");
  const timestamp =
    req.headers.get("webhook-timestamp") ?? req.headers.get("svix-timestamp");
  const signature =
    req.headers.get("webhook-signature") ?? req.headers.get("svix-signature");

  if (!id || !timestamp || !signature) return false;

  const hmac = createHmac("sha256", extractKeyBytes(secret));
  hmac.update(`${id}.${timestamp}.${rawBody}`, "utf8");
  const expected = hmac.digest("base64");

  for (const part of signature.split(" ")) {
    const comma = part.indexOf(",");
    if (comma === -1) continue;
    const version = part.slice(0, comma);
    const sig = part.slice(comma + 1);
    if (version !== "v1") continue;
    try {
      if (
        hasSafeEqual(Buffer.from(expected, "base64"), Buffer.from(sig, "base64"))
      ) {
        return true;
      }
    } catch {
      // Ignore malformed candidate signatures and keep checking.
    }
  }

  return false;
}

function verifyJwtBearer(req: NextRequest, rawBody: string, secret: string) {
  void rawBody;
  const auth = req.headers.get("authorization");
  if (!auth?.startsWith("Bearer ")) return false;
  const token = auth.slice(7);

  try {
    const parts = token.split(".");
    if (parts.length !== 3) return false;
    const [header, payload, sig] = parts;
    const hmac = createHmac("sha256", extractKeyBytes(secret));
    hmac.update(`${header}.${payload}`);
    const expected = hmac.digest("base64url").replace(/=/g, "");
    const cleanSig = sig.replace(/=/g, "");
    return hasSafeEqual(Buffer.from(expected), Buffer.from(cleanSig));
  } catch {
    return false;
  }
}

function verifyHook(req: NextRequest, rawBody: string, secret: string): boolean {
  return (
    verifyWebhookSignature(req, rawBody, secret) ||
    verifyJwtBearer(req, rawBody, secret)
  );
}

function buildConfirmationUrl(
  supabaseUrl: string,
  tokenHash: string,
  actionType: z.infer<typeof EmailAction>,
  redirectTo: string
) {
  const verifyType = VERIFY_TYPE[actionType];
  const directAppUrl = authTokenCallbackUrlFromRedirect(
    redirectTo,
    tokenHash,
    verifyType
  );
  if (directAppUrl) return directAppUrl;

  const url = new URL("/auth/v1/verify", supabaseUrl);
  url.searchParams.set("token", tokenHash);
  url.searchParams.set("type", verifyType);
  url.searchParams.set("redirect_to", redirectTo);
  return url.toString();
}

function templateFor(
  actionType: z.infer<typeof EmailAction>,
  props: { email: string; confirmationUrl: string }
) {
  switch (actionType) {
    case "magic_link":
      return magicLinkEmail(props);
    case "signup":
      return confirmEmail(props);
    case "invite":
      return inviteEmail(props);
    case "recovery":
      return passwordResetEmail(props);
    default:
      return confirmEmail(props);
  }
}

async function sendHookEmail(
  payload: HookPayload,
  recipientEmail: string,
  tokenHash: string
) {
  const email = normalizeEmailAddress(recipientEmail);
  if (!email || !tokenHash) return;

  const actionType = payload.email_data.email_action_type;
  const confirmationUrl = buildConfirmationUrl(
    getSupabaseProjectUrl(),
    tokenHash,
    actionType,
    payload.email_data.redirect_to
  );

  await sendEmail({
    to: email,
    subject: SUBJECTS[actionType] ?? "Advantage Portal",
    html: templateFor(actionType, { email, confirmationUrl }),
  });
}

export async function POST(request: NextRequest) {
  const rawBody = await request.text();
  const hookSecret = process.env.SUPABASE_AUTH_HOOK_SECRET;

  if (!hookSecret) {
    console.error("[send-email] SUPABASE_AUTH_HOOK_SECRET is not set");
    return NextResponse.json(
      { error: "Hook secret is not configured" },
      { status: 500 }
    );
  }

  if (!verifyHook(request, rawBody, hookSecret)) {
    console.error("[send-email] Hook signature verification failed");
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let json: unknown;
  try {
    json = JSON.parse(rawBody);
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const parsed = HookPayload.safeParse(json);
  if (!parsed.success) {
    console.error("[send-email] Invalid payload:", parsed.error.flatten());
    return NextResponse.json({ error: "Invalid payload" }, { status: 400 });
  }

  const payload = parsed.data;
  const actionType = payload.email_data.email_action_type;

  try {
    if (actionType === "email_change" || actionType.startsWith("email_change_")) {
      const newEmail = normalizeEmailAddress(payload.user.new_email);
      const currentEmail = normalizeEmailAddress(payload.user.email);
      const currentTokenHash = payload.email_data.token_hash_new;
      const newTokenHash = payload.email_data.token_hash;

      if (currentEmail && currentTokenHash) {
        await sendHookEmail(payload, currentEmail, currentTokenHash);
      }
      if (newEmail && newTokenHash && newEmail !== currentEmail) {
        await sendHookEmail(payload, newEmail, newTokenHash);
      }
    } else {
      await sendHookEmail(
        payload,
        payload.user.email,
        payload.email_data.token_hash
      );
    }
  } catch (err) {
    console.error("[send-email] Email send failed:", err);
    return NextResponse.json({ error: "Failed to send email" }, { status: 500 });
  }

  return NextResponse.json({});
}
