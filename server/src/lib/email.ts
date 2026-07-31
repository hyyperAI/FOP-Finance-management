// Email wrapper. In dev (no RESEND_API_KEY set) we console.log the email body
// including the password-reset URL — so the developer can click it from the
// terminal output. In production with RESEND_API_KEY set, we call the Resend
// API.
//
// Per docs/backend/features/01-auth.md § 3.3, emails fail silently if the
// API is unreachable — the reset token is still created, so the user can
// request a new link.

interface SendEmailInput {
  to: string
  subject: string
  text: string
  html?: string
}

export async function sendEmail(input: SendEmailInput): Promise<void> {
  const apiKey = process.env.RESEND_API_KEY
  const from = process.env.RESEND_FROM ?? 'FOP <noreply@example.com>'

  if (!apiKey) {
    // Dev mode: log to stdout. Never block the request on this.
    console.log('\n──────────── DEV EMAIL ────────────')
    console.log(`To:      ${input.to}`)
    console.log(`From:    ${from}`)
    console.log(`Subject: ${input.subject}`)
    console.log('───────────────────────────────────')
    console.log(input.text)
    console.log('──────────────────────────────────\n')
    return
  }

  try {
    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        from,
        to: input.to,
        subject: input.subject,
        text: input.text,
        html: input.html,
      }),
    })
    if (!res.ok) {
      const body = await res.text()
      console.error('[email] Resend API error:', res.status, body)
    }
  } catch (err) {
    console.error('[email] Resend request failed:', err)
  }
}

// Build the password-reset email body.
export function passwordResetEmailBody(name: string, resetUrl: string): {
  subject: string
  text: string
} {
  return {
    subject: 'Reset your FOP password',
    text:
      `Hi ${name},\n\n` +
      `We received a request to reset the password for your FOP account.\n\n` +
      `Click the link below to set a new password. It expires in 1 hour.\n\n` +
      `${resetUrl}\n\n` +
      `If you didn't request this, you can safely ignore this email — your password\n` +
      `will remain unchanged.\n\n` +
      `— FOP`,
  }
}
