import type { Config } from 'tailwindcss';

/**
 * Tailwind config compartilhado do Nexo Fiscal.
 * Tokens de marca: azul #1E5FD8, verde #1BA97A, danger #E54848.
 * Fontes: Inter (UI) + JetBrains Mono (números fiscais).
 */
const config: Config = {
  content: [
    './src/**/*.{ts,tsx}',
    // Apps que consomem este preset devem adicionar seus paths próprios.
  ],
  darkMode: 'class',
  theme: {
    container: {
      center: true,
      padding: '1rem',
      screens: {
        '2xl': '1400px',
      },
    },
    extend: {
      colors: {
        // shadcn/ui semantic tokens (HSL vars resolvidos em globals.css)
        border: 'hsl(var(--border))',
        input: 'hsl(var(--input))',
        ring: 'hsl(var(--ring))',
        background: 'hsl(var(--background))',
        foreground: 'hsl(var(--foreground))',
        primary: {
          DEFAULT: 'hsl(var(--primary))',
          foreground: 'hsl(var(--primary-foreground))',
        },
        secondary: {
          DEFAULT: 'hsl(var(--secondary))',
          foreground: 'hsl(var(--secondary-foreground))',
        },
        destructive: {
          DEFAULT: 'hsl(var(--destructive))',
          foreground: 'hsl(var(--destructive-foreground))',
        },
        muted: {
          DEFAULT: 'hsl(var(--muted))',
          foreground: 'hsl(var(--muted-foreground))',
        },
        accent: {
          DEFAULT: 'hsl(var(--accent))',
          foreground: 'hsl(var(--accent-foreground))',
        },
        popover: {
          DEFAULT: 'hsl(var(--popover))',
          foreground: 'hsl(var(--popover-foreground))',
        },
        card: {
          DEFAULT: 'hsl(var(--card))',
          foreground: 'hsl(var(--card-foreground))',
        },
        // Nexo Fiscal brand tokens
        brand: {
          blue: '#1E5FD8',
          'blue-dark': '#1748A8',
          'blue-light': '#4B83E3',
          green: '#1BA97A',
          'green-dark': '#148259',
          'green-light': '#3FC493',
          danger: '#E54848',
          warning: '#F59E0B',
          info: '#3B82F6',
        },
        // Status fiscais (StatusPill)
        status: {
          autorizada: '#1BA97A',
          rejeitada: '#E54848',
          cancelada: '#6B7280',
          pendente: '#F59E0B',
          processando: '#3B82F6',
          rascunho: '#9CA3AF',
        },
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
        mono: ['"JetBrains Mono"', 'ui-monospace', 'monospace'],
      },
      fontSize: {
        // Tabular numbers for fiscal values
        'fiscal-sm': ['0.875rem', { lineHeight: '1.25rem', fontFeatureSettings: '"tnum"' }],
        'fiscal-base': ['1rem', { lineHeight: '1.5rem', fontFeatureSettings: '"tnum"' }],
      },
      borderRadius: {
        lg: 'var(--radius)',
        md: 'calc(var(--radius) - 2px)',
        sm: 'calc(var(--radius) - 4px)',
      },
      keyframes: {
        'accordion-down': {
          from: { height: '0' },
          to: { height: 'var(--radix-accordion-content-height)' },
        },
        'accordion-up': {
          from: { height: 'var(--radix-accordion-content-height)' },
          to: { height: '0' },
        },
      },
      animation: {
        'accordion-down': 'accordion-down 0.2s ease-out',
        'accordion-up': 'accordion-up 0.2s ease-out',
      },
    },
  },
  plugins: [],
};

export default config;
