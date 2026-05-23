import "server-only";

/**
 * Minimal Resend client over fetch (no SDK dependency).
 *
 * If RESEND_API_KEY is unset, this is a graceful no-op (logs and returns) so
 * local development works without configuring an email provider.
 */
export async function sendEmail({
  to,
  subject,
  html,
}: {
  to: string | string[];
  subject: string;
  html: string;
}): Promise<void> {
  const apiKey = process.env.RESEND_API_KEY;
  const from = process.env.EMAIL_FROM ?? "Squarely <noreply@squarely.com>";

  if (!apiKey) {
    console.log(
      `[email] RESEND_API_KEY unset — skipping send. to=${JSON.stringify(to)} subject="${subject}"`,
    );
    return;
  }

  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ from, to, subject, html }),
  });

  if (!res.ok) {
    const detail = await res.text().catch(() => "");
    throw new Error(`Resend send failed (${res.status}): ${detail}`);
  }
}
