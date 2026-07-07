import type { Config } from 'tailwindcss';
import hrmPreset from '@hrm/config/tailwind/preset';

const config: Config = {
  presets: [hrmPreset],
  content: [
    './src/pages/**/*.{ts,tsx}',
    './src/components/**/*.{ts,tsx}',
    './src/app/**/*.{ts,tsx}',
  ],
};

export default config;
