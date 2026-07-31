// Zod validators for the auth endpoints.
// Per docs/backend/features/01-auth.md § 1.4.
import { z } from 'zod'

export const ForgotPasswordSchema = z.object({
  email: z.string().email(),
})

export const ResetPasswordSchema = z.object({
  token: z.string().min(32, 'Invalid token'),
  newPassword: z
    .string()
    .min(8, 'Must be at least 8 characters')
    .regex(/[A-Za-z]/, 'Must contain a letter')
    .regex(/[0-9]/, 'Must contain a number'),
})

export type ForgotPasswordInput = z.infer<typeof ForgotPasswordSchema>
export type ResetPasswordInput = z.infer<typeof ResetPasswordSchema>
