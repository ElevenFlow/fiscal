/**
 * Stack tipográfica do Nexo Fiscal.
 * Inter para UI geral; JetBrains Mono para números fiscais (CNPJ, chaves, valores).
 */
export const fontStack = {
  sans: 'Inter, system-ui, sans-serif',
  mono: '"JetBrains Mono", ui-monospace, monospace',
} as const;

/**
 * URL CDN das fontes (Google Fonts). apps/web carrega via next/font ou link.
 */
export const fontUrls = {
  inter: 'https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap',
  jetbrainsMono:
    'https://fonts.googleapis.com/css2?family=JetBrains+Mono:wght@400;500;700&display=swap',
} as const;
