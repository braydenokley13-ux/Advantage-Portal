import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import nodemailer from "nodemailer";
import { magicLinkEmail } from "@/emails/templates";

export async function POST(req: NextRequest) {
  const { email, next } = await req.json();

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!supabaseUrl || !serviceKey) {
    return NextResponse.json({ error: "Server not configured" }, { status: 500 });
  }

  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";
  const redirectTo = next
    ? `${appUrl}/auth/callback?next=${encodeURIComponent(next)}`
    : `${appUrl}/auth/callback`;

  // Generate the magic link server-side — bypasses all Supabase email rate limits.
  const admin = createClient(supabaseUrl, serviceKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  const { data, error } = await admin.auth.admin.generateLink({
    type: "magiclink",
    email,
    options: { redirectTo },
  });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }

  const confirmationUrl = data.properties.action_link;

  const gmailUser = process.env.GMAIL_USER;
  const gmailPass = process.env.GMAIL_APP_PASSWORD;
  if (!gmailUser || !gmailPass) {
    return NextResponse.json({ error: "Email service not configured" }, { status: 500 });
  }

  const transporter = nodemailer.createTransport({
    host: "smtp.gmail.com",
    port: 587,
    secure: false,
    auth: { user: gmailUser, pass: gmailPass },
  });

  try {
    await transporter.sendMail({
      from: `"Advantage Portal" <${gmailUser}>`,
      to: email,
      subject: "Your Advantage Portal sign-in link",
      html: magicLinkEmail({ email, confirmationUrl }),
    });
  } catch (err) {
    console.error("[magic-link] Gmail SMTP error:", err);
    return NextResponse.json({ error: "Failed to send email" }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
