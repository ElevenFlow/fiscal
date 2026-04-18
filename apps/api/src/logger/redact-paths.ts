/**
 * Caminhos (paths do Pino) que devem ser REDIGIDOS em TODO log estruturado.
 * PITFALLS.md #11: logs com PII violam LGPD e podem expor fraude fiscal.
 *
 * Usar `redact: {paths: [...], censor: '[REDACTED]'}` no config Pino.
 * Formato: usar wildcards do Pino (`*.password`, `req.headers.authorization`, etc).
 */
export const REDACT_PATHS = [
  // Senhas de todo tipo
  'password',
  '*.password',
  'passwd',
  '*.passwd',
  'pfxPassword',
  '*.pfxPassword',

  // PII brasileiro (completo — mascaramento de 2 últimos dígitos fica em helper separado)
  'cpf',
  '*.cpf',
  'cnpj',
  '*.cnpj',
  'cpfCnpj',
  '*.cpfCnpj',

  // Certificados
  'pfx',
  '*.pfx',
  'pfxBuffer',
  '*.pfxBuffer',
  'certificate',
  '*.certificate',
  'privateKey',
  '*.privateKey',

  // Tokens e auth headers
  'token',
  '*.token',
  'refresh_token',
  '*.refresh_token',
  'refreshToken',
  '*.refreshToken',
  'authorization',
  'req.headers.authorization',
  'req.headers.cookie',
  'req.headers["x-api-key"]',
  '*.authorization',

  // Payloads fiscais que podem conter PII
  'xml', // XML completo de NF-e contém CPF/CNPJ do destinatário
  '*.xml',
  'danfeBytes',
  '*.danfeBytes',

  // Cartões (reserva)
  'creditCard',
  '*.creditCard',
  'cvv',
  '*.cvv',
] as const;

export const REDACT_CENSOR = '[REDACTED]';
