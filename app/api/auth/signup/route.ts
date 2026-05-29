import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { authCallbackUrl, authTokenCallbackUrl } from "@/lib/auth/redirects";
import { normalizeEmailAddress, sendEmail } from "@/lib/email/mailer";
import { getSupabaseAdminClient } from "@/lib/supabase/admin";
import { confirmEmail } from "@/emails/templates";

const SignupRequest = z.object({
  name: z.string().trim().min(2).max(80),
  email: z.string().trim().email(),
  password: z.string().min(6).max(128),
});

function friendlySignupError(message: string) {
  if (/already|registered|exists/i.test(message)) {
    return "An account with this email already exists. Sign in or use a magic link instead.";
  }
  return message;
}

export async function POST(req: NextRequest) {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid request body." }, { status: 400 });
  }

  const parsed = SignupRequest.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Enter a name, a valid email, and a password with at least 6 characters." },
      { status: 400 }
    );
  }

  const email = normalizeEmailAddress(parsed.data.email);
  if (!email) {
    return NextResponse.json(
      { error: "Enter a valid email address." },
      { status: 400 }
    );
  }

  try {
    const admin = getSupabaseAdminClient();
    const next = "/dashboard";
    const { data, error } = await admin.auth.admin.generateLink({
      type: "signup",
      email,
      password: parsed.data.password,
      options: {
        data: { name: parsed.data.name },
        redirectTo: authCallbackUrl(req, next),
      },
    });

    if (error) {
      return NextResponse.json(
        { error: friendlySignupError(error.message) },
        { status: 400 }
      );
    }

    const confirmationUrl =
      authTokenCallbackUrl(
        req,
        data.properties.hashed_token,
        data.properties.verification_type,
        next
      ) ?? data.properties.action_link;
    if (!confirmationUrl) {
      return NextResponse.json(
        { error: "Supabase did not return a confirmation link." },
        { status: 500 }
      );
    }

    await sendEmail({
      to: email,
      subject: "Confirm your Advantage Portal account",
      html: confirmEmail({ email, confirmationUrl }),
    });

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("[signup] Email flow failed:", err);
    return NextResponse.json(
      { error: "We could not send that confirmation email. Try again in a minute." },
      { status: 500 }
    );
  }
}
