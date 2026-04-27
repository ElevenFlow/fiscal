import { z } from 'zod';

/**
 * Schema de validação para cadastro de novo usuário.
 * Senha mínima de 12 caracteres conforme T-02.1-01-03 (redução requer security review).
 */
export const SignupSchema = z.object({
  email: z.string().email().max(254),
  password: z.string().min(12).max(128),
  fullName: z.string().min(2).max(120),
});

/**
 * Schema de validação para login.
 */
export const SigninSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1).max(128),
});

export type SignupDto = z.infer<typeof SignupSchema>;
export type SigninDto = z.infer<typeof SigninSchema>;
