// Production implementation: Real auth with NextAuth backend
import { useEffect, useRef, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { Wallet } from 'lucide-react'

import { Container } from '../../components/ui/Container.jsx'
import { Stack } from '../../components/ui/Stack.jsx'
import { Card } from '../../components/ui/Card.jsx'
import { TextInput } from '../../components/ui/TextInput.jsx'
import { PrimaryButton } from '../../components/ui/PrimaryButton.jsx'
import { FormError } from '../../components/ui/FormError.jsx'
import { Spinner } from '../../components/ui/Spinner.jsx'

import { login as loginQuery } from '../../lib/api/auth.js'
import { useAuth } from '../../lib/auth.jsx'

const USERNAME_RE = /^[a-zA-Z0-9._-]+$/

// Error scenarios for real backend responses.
// The new login() helper returns { ok: false, error: <message string> } —
// so we only need a single generic mapping here. The Dev-only dropdown
// below still supports scenario-style testing.
const ERROR_SCENARIOS = {
  invalid: {
    title: 'Invalid credentials',
    message: 'Invalid username or password.',
  },
  disabled: {
    title: 'Account disabled',
    message: 'Account disabled. Contact your admin.',
  },
  rateLimit: {
    title: 'Too many requests',
    message: 'Too many attempts. Try again in 1 minute.',
  },
  serverError: {
    title: 'Server error',
    message: 'Something went wrong. Try again.',
  },
}

export default function Login() {
  const navigate = useNavigate()
  const { refresh } = useAuth()

  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [usernameError, setUsernameError] = useState('')
  const [passwordError, setPasswordError] = useState('')
  const [scenario, setScenario] = useState('invalid')
  const [formError, setFormError] = useState(null)
  const [isSubmitting, setIsSubmitting] = useState(false)

  const usernameRef = useRef(null)
  const passwordRef = useRef(null)

  // Focus the username field on mount
  useEffect(() => {
    usernameRef.current?.focus()
  }, [])

  const validate = () => {
    let ok = true
    if (!username.trim()) {
      setUsernameError('Required')
      ok = false
    } else if (!USERNAME_RE.test(username) || username.length < 3 || username.length > 50) {
      setUsernameError('Use 3–50 letters, digits, dot, dash, or underscore.')
      ok = false
    } else {
      setUsernameError('')
    }

    if (!password) {
      setPasswordError('Required')
      ok = false
    } else if (password.length < 8 || password.length > 200) {
      setPasswordError('Password must be 8–200 characters.')
      ok = false
    } else {
      setPasswordError('')
    }

    return ok
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    setFormError(null)

    if (!validate()) return

    setIsSubmitting(true)

    try {
      // Use the new login query helper; on failure result.error is a human-readable message
      const result = await loginQuery({ username: username.trim(), password })

      if (result.ok) {
        // Refresh auth context and redirect to home
        await refresh()
        navigate('/', { replace: true })
        return
      }

      // result.error is already a message string from the helper
      setFormError({ title: 'Sign-in failed', message: result.error })

      // Focus password field on auth errors
      passwordRef.current?.focus()
    } catch (err) {
      console.error('Login error:', err)
      setFormError(ERROR_SCENARIOS.serverError)
    } finally {
      setIsSubmitting(false)
    }
  }

  const year = new Date().getFullYear()

  return (
    <main className="min-h-screen bg-bg-page">
      <Container variant="narrow" className="flex min-h-screen flex-col">
        {/* 4.1 Brand header */}
        <header className="flex items-center gap-3 pt-8 pb-12 sm:pb-16">
          <Wallet className="h-8 w-8 text-brand-600" aria-hidden="true" />
          <span className="text-h3 font-semibold text-text-primary">FOP</span>
        </header>

        {/* 4.2 Sign-in card */}
        <div className="flex flex-1 items-start justify-center sm:items-center sm:pt-8">
          <Card padding="lg" className="w-full max-w-sm">
            <form onSubmit={handleSubmit} noValidate>
              <Stack gap={6}>
                <h1 className="text-h2 font-semibold text-text-primary">Sign in</h1>

                <FormError title={formError?.title} message={formError?.message} />

                <TextInput
                  ref={usernameRef}
                  label="Username"
                  name="username"
                  type="text"
                  required
                  autoComplete="username"
                  autoCapitalize="none"
                  minLength={3}
                  maxLength={50}
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  error={usernameError}
                  disabled={isSubmitting}
                />

                <TextInput
                  ref={passwordRef}
                  label="Password"
                  name="password"
                  type="password"
                  required
                  autoComplete="current-password"
                  minLength={8}
                  maxLength={200}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  error={passwordError}
                  disabled={isSubmitting}
                />

                <PrimaryButton
                  type="submit"
                  variant="primary"
                  fullWidth
                  disabled={isSubmitting}
                  aria-label={isSubmitting ? 'Signing in' : 'Sign in'}
                >
                  {isSubmitting ? (
                    <>
                      <Spinner size="sm" label="Signing in" />
                      <span>Signing in…</span>
                    </>
                  ) : (
                    <span>Sign in</span>
                  )}
                </PrimaryButton>

                <div className="flex justify-center">
                  <Link
                    to="/forgot-password"
                    className="text-caption font-medium text-text-link hover:underline focus:underline min-h-11 inline-flex items-center"
                  >
                    Forgot password?
                  </Link>
                </div>

                {/* Dev-only: Error scenario selector for testing */}
                {import.meta.env.DEV && (
                  <div className="border-t border-border-subtle pt-4">
                    <label
                      htmlFor="error-scenario"
                      className="text-caption font-medium text-text-tertiary"
                    >
                      Dev: simulate error state
                    </label>
                    <select
                      id="error-scenario"
                      value={scenario}
                      onChange={(e) => setScenario(e.target.value)}
                      disabled={isSubmitting}
                      className="mt-2 h-11 w-full rounded-lg border border-border-strong px-3 text-body-m text-text-primary focus:outline-none focus:ring-2 focus:ring-border-focus"
                    >
                      <option value="invalid">401 — Invalid credentials (default)</option>
                      <option value="disabled">401 — Account disabled</option>
                      <option value="rateLimit">429 — Too many requests</option>
                      <option value="serverError">5xx — Server error</option>
                    </select>
                  </div>
                )}
              </Stack>
            </form>
          </Card>
        </div>

        {/* 4.3 Footer */}
        <footer className="py-8">
          <p className="text-center text-caption text-text-tertiary">
            © FOP {year}
          </p>
        </footer>
      </Container>
    </main>
  )
}
