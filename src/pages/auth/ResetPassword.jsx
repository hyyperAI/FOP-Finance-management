// Production implementation: Real reset password with NextAuth backend
import { useEffect, useRef, useState } from 'react'
import { Link, useParams, useNavigate } from 'react-router-dom'
import { Wallet, CheckCircle2 } from 'lucide-react'

import { Container } from '../../components/ui/Container.jsx'
import { Stack } from '../../components/ui/Stack.jsx'
import { Card } from '../../components/ui/Card.jsx'
import { TextInput } from '../../components/ui/TextInput.jsx'
import { PrimaryButton } from '../../components/ui/PrimaryButton.jsx'
import { FormError } from '../../components/ui/FormError.jsx'
import { Spinner } from '../../components/ui/Spinner.jsx'

import {
  verifyResetToken as verifyResetTokenQuery,
  resetPassword as resetPasswordQuery,
} from '../../lib/api/auth.js'
import { useAuth } from '../../lib/auth.jsx'

// Token-level error states — driven by backend responses
const TOKEN_STATES = {
  valid: null,
  invalid: {
    title: 'Invalid link',
    message: 'This link is invalid. Request a new one.',
    cta: { label: 'Request a new link', to: '/forgot-password', focus: true },
  },
  expired: {
    title: 'Link expired',
    message: 'This link has expired. Request a new one.',
    cta: { label: 'Request a new link', to: '/forgot-password', focus: true },
  },
  used: {
    title: 'Link already used',
    message: 'This link has already been used. Sign in or request a new one.',
    cta: { label: 'Request a new link', to: '/forgot-password', focus: true },
    secondary: { label: 'Back to sign in', to: '/login' },
  },
}

export default function ResetPassword() {
  const { token } = useParams()
  const navigate = useNavigate()
  const { refresh } = useAuth()

  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [newPasswordError, setNewPasswordError] = useState('')
  const [confirmPasswordError, setConfirmPasswordError] = useState('')
  const [tokenState, setTokenState] = useState('loading')
  const [formError, setFormError] = useState(null)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [isSuccess, setIsSuccess] = useState(false)
  const [isValidating, setIsValidating] = useState(true)

  const newPasswordRef = useRef(null)
  const requestLinkRef = useRef(null)

  const tokenError = TOKEN_STATES[tokenState]

  // Validate token on mount
  useEffect(() => {
    const validateToken = async () => {
      if (!token) {
        setTokenState('invalid')
        setIsValidating(false)
        return
      }

      try {
        const response = await verifyResetTokenQuery(token)

        if (response.valid) {
          setTokenState('valid')
        } else {
          // Map error codes to states
          const errorCode = response.error || 'invalid'
          if (errorCode === 'token_used') {
            setTokenState('used')
          } else if (errorCode === 'token_expired') {
            setTokenState('expired')
          } else {
            setTokenState('invalid')
          }
        }
      } catch (err) {
        console.error('Token validation error:', err)
        setTokenState('invalid')
      } finally {
        setIsValidating(false)
      }
    }

    validateToken()
  }, [token])

  // Per §9: focus new-password input on mount when valid token.
  // Per §9: focus "Request a new link" when in error state.
  useEffect(() => {
    if (tokenError) {
      requestLinkRef.current?.focus()
    } else if (!isSuccess && !isValidating && tokenState === 'valid') {
      newPasswordRef.current?.focus()
    }
  }, [tokenState, isSuccess, tokenError, isValidating])

  const validate = () => {
    let ok = true
    if (!newPassword) {
      setNewPasswordError('Required')
      ok = false
    } else if (newPassword.length < 8 || newPassword.length > 200) {
      setNewPasswordError('Password must be 8–200 characters.')
      ok = false
    } else {
      setNewPasswordError('')
    }

    if (!confirmPassword) {
      setConfirmPasswordError('Required')
      ok = false
    } else if (confirmPassword !== newPassword) {
      setConfirmPasswordError("Passwords don't match.")
      ok = false
    } else {
      setConfirmPasswordError('')
    }

    return ok
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    setFormError(null)

    if (!validate()) return

    setIsSubmitting(true)

    try {
      const response = await resetPasswordQuery(token, newPassword)

      if (response.ok) {
        setIsSuccess(true)
      } else {
        // Map error codes to token-state where appropriate
        const errorCode = response.error || 'server_error'
        if (errorCode === 'token_invalid') {
          setTokenState('invalid')
        } else if (errorCode === 'token_used') {
          setTokenState('used')
        } else if (errorCode === 'token_expired') {
          setTokenState('expired')
        } else if (response.fields?.newPassword) {
          // server-side validation error — surface inline
          setNewPasswordError(response.fields.newPassword[0])
        } else {
          setFormError({
            title: 'Error',
            message: 'Something went wrong. Please try again.',
          })
        }
      }
    } catch (err) {
      console.error('Reset password error:', err)
      setFormError({
        title: 'Server error',
        message: 'Something went wrong. Try again.',
      })
    } finally {
      setIsSubmitting(false)
    }
  }

  const year = new Date().getFullYear()

  // Show loading spinner while validating token
  if (isValidating) {
    return (
      <main className="min-h-screen bg-bg-page">
        <Container variant="narrow" className="flex min-h-screen flex-col">
          <header className="flex items-center gap-3 pt-8 pb-12 sm:pb-16">
            <Wallet className="h-8 w-8 text-brand-600" aria-hidden="true" />
            <span className="text-h3 font-semibold text-text-primary">FOP</span>
          </header>

          <div className="flex flex-1 items-start justify-center sm:items-center sm:pt-8">
            <Card padding="lg" className="w-full max-w-sm">
              <div className="flex flex-col items-center gap-4 py-8">
                <div className="h-8 w-8 animate-spin rounded-full border-2 border-brand-200 border-t-brand-600"></div>
                <p className="text-body-m text-text-tertiary">Validating link...</p>
              </div>
            </Card>
          </div>

          <footer className="py-8">
            <p className="text-center text-caption text-text-tertiary">
              © FOP {year}
            </p>
          </footer>
        </Container>
      </main>
    )
  }

  return (
    <main className="min-h-screen bg-bg-page">
      <Container variant="narrow" className="flex min-h-screen flex-col">
        {/* 4.1 Brand header — identical to Login / ForgotPassword */}
        <header className="flex items-center gap-3 pt-8 pb-12 sm:pb-16">
          <Wallet className="h-8 w-8 text-brand-600" aria-hidden="true" />
          <span className="text-h3 font-semibold text-text-primary">FOP</span>
        </header>

        <div className="flex flex-1 items-start justify-center sm:items-center sm:pt-8">
          <Card padding="lg" className="w-full max-w-sm">
            {/* Success state — full card swap. Per §9 success behavior. */}
            {isSuccess ? (
              <div
                role="status"
                aria-live="polite"
                className="flex flex-col items-center gap-4 text-center"
              >
                <CheckCircle2
                  className="h-12 w-12 text-success-500"
                  aria-hidden="true"
                />
                <h1 className="text-h2 font-semibold text-text-primary">
                  Password updated
                </h1>
                <p className="text-body-m text-text-secondary">
                  Your password has been reset. Sign in with your new password.
                </p>
                <Link
                  to="/login"
                  className="inline-flex min-h-11 items-center justify-center rounded-md bg-brand-600 px-4 text-body-l font-semibold text-text-inverse hover:bg-brand-700 focus:outline-none focus:ring-2 focus:ring-border-focus focus:ring-offset-2 w-full"
                >
                  Go to sign in
                </Link>
              </div>
            ) : tokenError ? (
              /* Token-level error state — card swap per §4.2. */
              <div aria-live="assertive" className="flex flex-col gap-4">
                <Stack gap={2}>
                  <h1 className="text-h2 font-semibold text-text-primary">
                    {tokenError.title}
                  </h1>
                  <p className="text-body-m text-text-secondary">
                    {tokenError.message}
                  </p>
                </Stack>
                <Stack gap={3}>
                  <button
                    ref={requestLinkRef}
                    type="button"
                    onClick={() => {
                      window.location.assign(tokenError.cta.to)
                    }}
                    className="inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-md bg-brand-600 px-4 text-body-l font-semibold text-text-inverse hover:bg-brand-700 active:bg-brand-800 focus:outline-none focus:ring-2 focus:ring-border-focus focus:ring-offset-2"
                  >
                    {tokenError.cta.label}
                  </button>
                  {tokenError.secondary && (
                    <Link
                      to={tokenError.secondary.to}
                      className="inline-flex min-h-11 items-center justify-center text-caption font-medium text-text-link hover:underline focus:underline"
                    >
                      {tokenError.secondary.label}
                    </Link>
                  )}
                </Stack>
              </div>
            ) : (
              /* Default — valid token, render the form */
              <form onSubmit={handleSubmit} noValidate>
                <Stack gap={6}>
                  <h1 className="text-h2 font-semibold text-text-primary">
                    Set new password
                  </h1>

                  <FormError title={formError?.title} message={formError?.message} />

                  <TextInput
                    ref={newPasswordRef}
                    label="New password"
                    name="newPassword"
                    type="password"
                    required
                    autoComplete="new-password"
                    minLength={8}
                    maxLength={200}
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    error={newPasswordError}
                    helperText="At least 8 characters."
                    disabled={isSubmitting}
                  />

                  <TextInput
                    label="Confirm new password"
                    name="confirmPassword"
                    type="password"
                    required
                    autoComplete="new-password"
                    minLength={8}
                    maxLength={200}
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    error={confirmPasswordError}
                    disabled={isSubmitting}
                  />

                  <PrimaryButton
                    type="submit"
                    variant="primary"
                    fullWidth
                    disabled={isSubmitting}
                    aria-label={isSubmitting ? 'Saving password' : 'Save'}
                  >
                    {isSubmitting ? (
                      <>
                        <Spinner size="sm" label="Saving" />
                        <span>Saving…</span>
                      </>
                    ) : (
                      <span>Save</span>
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
            © FOP {year}
          </p>
        </footer>
      </Container>
    </main>
  )
}
