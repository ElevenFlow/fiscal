// Re-export agregador dos schemas Zod de auth (Phase 2.1 Plan 02.1-01).
// Backend e frontend importam SEMPRE deste índice — nunca de subpaths internos.
export { SignupSchema, SigninSchema } from './schemas';
export type { SignupDto, SigninDto } from './schemas';
