import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { authCallbackUrl } from "@/lib/auth/redirects";
import { normalizeEmailAddress, sendEmail } from "@/lib/email/mailer";
import { getSupabaseAdminClient } from "@/lib/supabase/admin";
import { magicLinkEmail } from "@/emails/templates";

const MagicLinkRequest = z.object({
  email: z.string().trim().email(),
  next: z.string().optional(),
});

function friendlyAuthError(message: string) {
  if (/not found|invalid/i.test(message)) {
    return "No active account was found for that email. Check the address or create an account first.";
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

  const parsed = MagicLinkRequest.safeParse(body);
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

  const redirectTo = authCallbackUrl(req, parsed.data.next);

  try {
    const admin = getSupabaseAdminClient();
    const { data, error } = await admin.auth.admin.generateLink({
      type: "magiclink",
      email,
      options: { redirectTo },
    });

    if (error) {
      return NextResponse.json(
        { error: friendlyAuthError(error.message) },
        { status: 400 }
      );
    }

    const confirmationUrl = data.properties.action_link;
    if (!confirmationUrl) {
      return NextResponse.json(
        { error: "Supabase did not return a sign-in link." },
        { status: 500 }
      );
    }

    await sendEmail({
      to: email,
      subject: "Your Advantage Portal sign-in link",
      html: magicLinkEmail({ email, confirmationUrl }),
    });

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("[magic-link] Email flow failed:", err);
    return NextResponse.json(
      { error: "We could not send that sign-in email. Try again in a minute." },
      { status: 500 }
    );
  }
}
