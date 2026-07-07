import { defineConfig } from '@playwright/test';
import { config as loadEnv } from 'dotenv';
import { join } from 'path';

loadEnv({ path: join(__dirname, '.env') });

const API_PORT = process.env.API_PORT ?? '6000';
const WEB_PORT = process.env.WEB_PORT ?? process.env.PORT ?? '6001';

export default defineConfig({
  testDir: './e2e',
  timeout: 30_000,
  fullyParallel: false,
  workers: 1,
  retries: 0,
  reporter: [['list']],
  use: {
    baseURL: `http://localhost:${WEB_PORT}`,
    trace: 'retain-on-failure',
  },
  webServer: [
    {
      command: 'pnpm --filter api run dev',
      url: `http://localhost:${API_PORT}/health`,
      reuseExistingServer: true,
      timeout: 60_000,
    },
    {
      command: 'pnpm --filter web run dev',
      url: `http://localhost:${WEB_PORT}`,
      reuseExistingServer: true,
      timeout: 60_000,
    },
  ],
});
