import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: './tests',
  fullyParallel: false,
  workers: 1,
  timeout: 30000,
  use: {
    baseURL: process.env.BASE_URL || 'http://127.0.0.1:8000',
    viewport: { width: 1280, height: 800 },
    timezoneId: 'Asia/Seoul',
    locale: 'ko-KR',
  },
});
