import type { Config } from 'tailwindcss';
import uiPreset from '@nexo/ui/tailwind-preset';

/**
 * Tailwind config do Next.js app.
 * Herda todos os tokens de marca do @nexo/ui (paleta Nexo Fiscal + fontes Inter/JetBrains Mono).
 */
const config: Config = {
  presets: [uiPreset as Config],
  content: [
    './src/**/*.{ts,tsx}',
    // Inclui componentes do package UI no scan do Tailwind (necessário para classes usadas lá serem purgadas corretamente).
    '../../packages/ui/src/**/*.{ts,tsx}',
  ],
};

export default config;
