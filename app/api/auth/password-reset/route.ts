import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { authCallbackUrl } from "@/lib/auth/redirects";
import { normalizeEmailAddress, sendEmail } from "@/lib/email/mailer";
import { getSupabaseAdminClient } from "@/lib/supabase/admin";
import { passwordResetEmail } from "@/emails/templates";

const PasswordResetRequest = z.object({
  email: z.string().trim().email(),
});

function shouldHideRecoveryError(message: string) {
  return /not found|invalid login|not confirmed/i.test(message);
}

export async function POST(req: NextRequest) {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid request body." }, { status: 400 });
  }

  const parsed = PasswordResetRequest.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Enter a valid email address." },
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
    const { data, error } = await admin.auth.admin.generateLink({
      type: "recovery",
      email,
      options: {
        redirectTo: authCallbackUrl(req, "/auth/update-password"),
      },
    });

    if (error) {
      if (shouldHideRecoveryError(error.message)) {
        return NextResponse.json({ ok: true });
      }
      return NextResponse.json({ error: error.message }, { status: 400 });
    }

    const confirmationUrl = data.properties.action_link;
    if (!confirmationUrl) {
      return NextResponse.json(
        { error: "Supabase did not return a reset link." },
        { status: 500 }
      );
    }

    await sendEmail({
      to: email,
      subject: "Reset your Advantage Portal password",
      html: passwordResetEmail({ email, confirmationUrl }),
    });

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("[password-reset] Email flow failed:", err);
    return NextResponse.json(
      { error: "We could not send that reset email. Try again in a minute." },
      { status: 500 }
    );
  }
}
