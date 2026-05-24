// Branded HTML email templates for Advantage Portal auth emails.
// Each function returns a complete HTML document safe to send as an email body.

type EmailProps = {
  email: string;
  confirmationUrl: string;
};

const BRAND_BG = "linear-gradient(135deg,#5b5bd6 0%,#7e7af0 100%)";
const BRAND_COLOR = "#5b5bd6";

function shell(body: string): string {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8"/>
  <meta name="viewport" content="width=device-width,initial-scale=1.0"/>
</head>
<body style="margin:0;padding:0;background:#f4f4f5;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f4f4f5;padding:48px 16px;">
    <tr><td align="center">
      <table width="100%" cellpadding="0" cellspacing="0" style="max-width:520px;">

        <!-- logo + wordmark -->
        <tr><td align="center" style="padding-bottom:28px;">
          <table cellpadding="0" cellspacing="0"><tr>
            <td style="background:${BRAND_BG};border-radius:12px;width:48px;height:48px;text-align:center;vertical-align:middle;">
              <span style="color:#fff;font-size:24px;font-weight:800;line-height:48px;display:block;">A</span>
            </td>
          </tr></table>
          <div style="margin-top:10px;font-size:17px;font-weight:700;color:#111827;letter-spacing:-0.3px;">Advantage Portal</div>
        </td></tr>

        <!-- card -->
        <tr><td style="background:#ffffff;border-radius:12px;padding:36px 40px;box-shadow:0 1px 3px rgba(0,0,0,0.08);">
          ${body}
        </td></tr>

        <!-- footer -->
        <tr><td align="center" style="padding-top:20px;">
          <p style="color:#9ca3af;font-size:12px;margin:0;line-height:1.6;">
            You're receiving this because an action was requested on your account.<br/>
            If you didn't request this, you can safely ignore this email.
          </p>
        </td></tr>

      </table>
    </td></tr>
  </table>
</body>
</html>`;
}

function cta(url: string, label: string): string {
  return `<table cellpadding="0" cellspacing="0" style="margin:28px auto 0;"><tr>
    <td align="center" style="background:${BRAND_BG};border-radius:8px;">
      <a href="${url}" target="_blank" rel="noopener noreferrer"
         style="display:inline-block;padding:13px 32px;color:#ffffff;font-size:14px;font-weight:600;text-decoration:none;letter-spacing:0.1px;">
        ${label}
      </a>
    </td>
  </tr></table>`;
}

function expiry(label: string): string {
  return `<p style="color:#9ca3af;font-size:12px;text-align:center;margin:14px 0 0;">${label}</p>`;
}

function fallback(url: string): string {
  return `<p style="color:#6b7280;font-size:12px;text-align:center;margin:16px 0 0;line-height:1.6;">
    If the button doesn't work, paste this URL into your browser:<br/>
    <a href="${url}" style="color:${BRAND_COLOR};word-break:break-all;">${url}</a>
  </p>`;
}

// ─── Magic link ─────────────────────────────────────────────────────────────

export function magicLinkEmail({ email, confirmationUrl }: EmailProps): string {
  return shell(`
    <h1 style="margin:0 0 6px;font-size:22px;font-weight:700;color:#111827;text-align:center;">Your sign-in link</h1>
    <p style="color:#6b7280;font-size:14px;text-align:center;margin:0;">
      Click below to sign in to Advantage Portal as&nbsp;<strong style="color:#374151;">${email}</strong>
    </p>
    ${cta(confirmationUrl, "Sign in to Advantage Portal")}
    ${expiry("This link expires in 1 hour and can only be used once.")}
    ${fallback(confirmationUrl)}
  `);
}

// ─── Email confirmation (sign-up) ────────────────────────────────────────────

export function confirmEmail({ email, confirmationUrl }: EmailProps): string {
  return shell(`
    <h1 style="margin:0 0 6px;font-size:22px;font-weight:700;color:#111827;text-align:center;">Confirm your account</h1>
    <p style="color:#6b7280;font-size:14px;text-align:center;margin:0;">
      Welcome to Advantage Portal! Confirm your email address to activate your account.
    </p>
    <p style="color:#9ca3af;font-size:13px;text-align:center;margin:8px 0 0;">
      Confirming&nbsp;<strong style="color:#374151;">${email}</strong>
    </p>
    ${cta(confirmationUrl, "Confirm my account")}
    ${expiry("This link expires in 24 hours.")}
    ${fallback(confirmationUrl)}
  `);
}

// ─── Invite ──────────────────────────────────────────────────────────────────

export function inviteEmail({ email, confirmationUrl }: EmailProps): string {
  return shell(`
    <h1 style="margin:0 0 6px;font-size:22px;font-weight:700;color:#111827;text-align:center;">You've been invited</h1>
    <p style="color:#6b7280;font-size:14px;text-align:center;margin:0;">
      You've been invited to join the Advantage Portal workspace. Accept the invitation to set up your account.
    </p>
    <p style="color:#9ca3af;font-size:13px;text-align:center;margin:8px 0 0;">
      Invitation for&nbsp;<strong style="color:#374151;">${email}</strong>
    </p>
    ${cta(confirmationUrl, "Accept invitation")}
    ${expiry("This invitation expires in 7 days.")}
    ${fallback(confirmationUrl)}
  `);
}

// ─── Password reset ──────────────────────────────────────────────────────────

export function passwordResetEmail({ email, confirmationUrl }: EmailProps): string {
  return shell(`
    <h1 style="margin:0 0 6px;font-size:22px;font-weight:700;color:#111827;text-align:center;">Reset your password</h1>
    <p style="color:#6b7280;font-size:14px;text-align:center;margin:0;">
      We received a request to reset the password for your Advantage Portal account.
    </p>
    <p style="color:#9ca3af;font-size:13px;text-align:center;margin:8px 0 0;">
      Account:&nbsp;<strong style="color:#374151;">${email}</strong>
    </p>
    ${cta(confirmationUrl, "Reset my password")}
    ${expiry("This link expires in 1 hour.")}
    ${fallback(confirmationUrl)}
  `);
}
