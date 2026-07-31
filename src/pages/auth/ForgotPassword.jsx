// Production implementation: Real forgot password with NextAuth backend
import { useEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { Wallet } from 'lucide-react'

import { Container } from '../../components/ui/Container.jsx'
import { Stack } from '../../components/ui/Stack.jsx'
import { Card } from '../../components/ui/Card.jsx'
import { TextInput } from '../../components/ui/TextInput.jsx'
import { PrimaryButton } from '../../components/ui/PrimaryButton.jsx'
import { GhostButton } from '../../components/ui/GhostButton.jsx'
import { FormError } from '../../components/ui/FormError.jsx'
import { Spinner } from '../../components/ui/Spinner.jsx'

import { forgotPassword as forgotPasswordQuery } from '../../lib/api/auth.js'

// RFC 5322 lite — matches docs/pages/02-forgot-password.md §4.2 client-side check.
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
const RESEND_COOLDOWN_SECONDS = 60

export default function ForgotPassword() {
  const [email, setEmail] = useState('')
  const [emailError, setEmailError] = useState('')
  const [formError, setFormError] = useState(null)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [isSent, setIsSent] = useState(false)
  const [resendCountdown, setResendCountdown] = useState(0)

  const emailRef = useRef(null)
  const backToSignInRef = useRef(null)

  // Per §9: focus email on mount.
  useEffect(() => {
    emailRef.current?.focus()
  }, [])

  // Tick the resend countdown every second while > 0.
  useEffect(() => {
    if (resendCountdown <= 0) return undefined
    const timer = setInterval(() => {
      setResendCountdown((prev) => (prev > 0 ? prev - 1 : 0))
    }, 1000)
    return () => clearInterval(timer)
  }, [resendCountdown])

  // Per §9: on success, focus "Back to sign in".
  useEffect(() => {
    if (isSent) {
      backToSignInRef.current?.focus()
    }
  }, [isSent])

  const handleSubmit = async (e) => {
    e.preventDefault()
    setFormError(null)

    if (!email.trim()) {
      setEmailError('Email is required.')
      emailRef.current?.focus()
      return
    }
    if (!EMAIL_RE.test(email.trim())) {
      setEmailError('Enter a valid email address.')
      emailRef.current?.focus()
      return
    }

    setEmailError('')
    setIsSubmitting(true)

    try {
      // Real API call via Phase A queries module.
      // The backend always returns 200 (anti-enumeration) so we treat any
      // thrown ApiError as a server-side failure, not a validation error.
      await forgotPasswordQuery(email.trim())

      // Anti-enumeration: always show success regardless of response
      // (backend returns 200 for existing and non-existing emails)
      setIsSubmitting(false)
      setIsSent(true)
      setResendCountdown(RESEND_COOLDOWN_SECONDS)
    } catch (err) {
      console.error('Forgot password error:', err)
      setIsSubmitting(false)
      setFormError({
        title: 'Server error',
        message: 'Something went wrong. Try again.',
      })
    }
  }

  const handleResend = () => {
    if (resendCountdown > 0) return
    setResendCountdown(RESEND_COOLDOWN_SECONDS)
    // Re-submit the form with current email
    handleSubmit({ preventDefault: () => {} })
  }

  const year = new Date().getFullYear()

  return (
    <main className="min-h-screen bg-bg-page">
      <Container variant="narrow" className="flex min-h-screen flex-col">
        {/* §4.1 Brand header */}
        <header className="flex items-center gap-3 pt-8 pb-12 sm:pb-16">
          <Wallet className="h-8 w-8 text-brand-600" aria-hidden="true" />
          <span className="text-h3 font-semibold text-text-primary">FOP</span>
        </header>

        <div className="flex flex-1 items-start justify-center sm:items-center sm:pt-8">
          <Card padding="lg" className="w-full max-w-sm">
            {isSent ? (
              // §4.3 Success state — single 250ms cross-fade swap.
              <div
                aria-live="polite"
                className="flex flex-col gap-6 transition-opacity duration-250"
              >
                <h1 className="text-h2 font-semibold text-text-primary">
                  Check your inbox
                </h1>
                <p className="text-body-m text-text-secondary">
                  If an account exists, a link is on its way. Check your inbox.
                </p>

                <GhostButton
                  type="button"
                  onClick={handleResend}
                  disabled={resendCountdown > 0}
                  aria-label={
                    resendCountdown > 0
                      ? `Send again available in ${resendCountdown} seconds`
                      : 'Send again'
                  }
                >
                  {resendCountdown > 0 ? (
                    <span>Send again ({resendCountdown}s)</span>
                  ) : (
                    <span>Send again</span>
                  )}
                </GhostButton>

                <div className="flex justify-center">
                  <Link
                    ref={backToSignInRef}
                    to="/login"
                    className="text-caption font-medium text-text-link hover:underline focus:underline min-h-11 inline-flex items-center"
                  >
                    Back to sign in
                  </Link>
                </div>
              </div>
            ) : (
              // §4.2 Reset card
              <form onSubmit={handleSubmit} noValidate>
                <Stack gap={6}>
                  <h1 className="text-h2 font-semibold text-text-primary">
                    Reset password
                  </h1>
                  <p className="text-body-m text-text-secondary">
                    We&rsquo;ll email you a link.
                  </p>

                  <FormError title={formError?.title} message={formError?.message} />

                  <TextInput
                    ref={emailRef}
                    label="Email address"
                    name="email"
                    type="email"
                    required
                    autoComplete="email"
                    inputMode="email"
                    autoCapitalize="none"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    error={emailError}
                    disabled={isSubmitting}
                  />

                  <PrimaryButton
                    type="submit"
                    variant="primary"
                    fullWidth
                    disabled={isSubmitting}
                    aria-label={isSubmitting ? 'Sending reset link' : 'Send link'}
                  >
                    {isSubmitting ? (
                      <>
                        <Spinner size="sm" label="Sending" />
                        <span>Sending&hellip;</span>
                      </>
                    ) : (
                      <span>Send link</span>
                    )}
                  </PrimaryButton>

                  <div className="flex justify-center">
                    <Link
                      to="/login"
                      className="text-caption font-medium text-text-link hover:underline focus:underline min-h-11 inline-flex items-center"
                    >
                      Back to sign in
                    </Link>
                  </div>
                </Stack>
              </form>
            )}
          </Card>
        </div>

        <footer className="py-8">
          <p className="text-center text-caption text-text-tertiary">
            &copy; FOP {year}
          </p>
        </footer>
      </Container>
    </main>
  )
}
