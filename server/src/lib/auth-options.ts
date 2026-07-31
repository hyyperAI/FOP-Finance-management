// NextAuth configuration. Extracted into its own module so other API routes
// (e.g. /api/auth/session) can import authOptions without depending on the
// route file. Per Next.js App Router, route files should only export named
// HTTP method handlers — not `export default`.

import type { NextAuthOptions } from 'next-auth'
import CredentialsProvider from 'next-auth/providers/credentials'

import { db } from '@/lib/db'
import { verifyPassword } from '@/lib/password'
import { recordAudit } from '@/lib/audit'
import {
  isRateLimited,
  recordFailedAttempt,
  clearRateLimit,
  loginKey,
} from '@/lib/rate-limit'

function getIpFromHeaders(headers: Record<string, string> | undefined): string {
  if (!headers) return 'unknown'
  const fwd = headers['x-forwarded-for']?.split(',')[0]?.trim()
  if (fwd) return fwd
  return headers['x-real-ip']?.trim() ?? 'unknown'
}

export const authOptions: NextAuthOptions = {
  providers: [
    CredentialsProvider({
      name: 'Credentials',
      credentials: {
        username: { label: 'Username', type: 'text' },
        password: { label: 'Password', type: 'password' },
      },
      async authorize(credentials, req) {
        const request = req as unknown as { headers: Record<string, string> }
        const ip = getIpFromHeaders(request.headers)
        const userAgent = request.headers?.['user-agent'] ?? null

        // 1. Rate limit by IP
        if (
          isRateLimited(
            loginKey({
              headers: { get: (h: string) => (h === 'x-forwarded-for' ? ip : null) },
            } as unknown as Request),
          )
        ) {
          throw new Error('rate_limited')
        }

        if (!credentials?.username || !credentials?.password) {
          return null
        }

        // 2. Find user
        const user = await db.user.findUnique({
          where: { username: credentials.username },
        })

        if (!user || !user.isActive) {
          recordFailedAttempt(`login:${ip}`)
          return null
        }

        // 3. Verify password
        const valid = await verifyPassword(credentials.password, user.passwordHash)
        if (!valid) {
          recordFailedAttempt(`login:${ip}`)
          return null
        }

        // 4. Clear rate limit + update lastLoginAt + audit (in same DB tx)
        clearRateLimit(`login:${ip}`)
        await db.$transaction(async (tx) => {
          await tx.user.update({
            where: { id: user.id },
            data: { lastLoginAt: new Date() },
          })
          await recordAudit(tx, {
            actorId: user.id,
            action: 'auth.login',
            entityType: 'User',
            entityId: user.id,
            ip,
            userAgent: userAgent ?? undefined,
          })
        })

        return {
          id: user.id,
          name: user.name,
          email: user.email,
          username: user.username,
          role: user.role,
        }
      },
    }),
  ],
  session: {
    strategy: 'jwt',
    maxAge: 12 * 60 * 60, // 12 hours
  },
  cookies: {
    sessionToken: {
      name: 'next-auth.session-token',
      options: {
        httpOnly: true,
        sameSite: 'lax',
        path: '/',
        secure: process.env.NODE_ENV === 'production',
      },
    },
  },
  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        token.id = (user as { id: string }).id
        token.role = (user as { role: string }).role
        token.username = (user as { username: string }).username
      }
      return token
    },
    async session({ session, token }) {
      if (session.user) {
        session.user.id = token.id as string
        session.user.role = token.role as string
        ;(session.user as { username?: string }).username = token.username as string
      }
      return session
    },
  },
  pages: {
    signIn: '/login',
  },
  secret: process.env.NEXTAUTH_SECRET,
  events: {
    async signOut({ token }) {
      const actorId = (token?.id as string | undefined) ?? null
      if (!actorId) return
      try {
        await db.auditLog.create({
          data: {
            actorId,
            action: 'auth.logout',
            entityType: 'User',
            entityId: actorId,
            ip: null,
            userAgent: null,
          },
        })
      } catch (err) {
        console.error('[auth.logout] audit failed:', err)
      }
    },
  },
}
