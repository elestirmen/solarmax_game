import { defineConfig } from '@playwright/test';

export default defineConfig({
    testDir: './e2e',
    timeout: 60000,
    expect: {
        timeout: 10000,
    },
    workers: 1,
    use: {
        baseURL: 'http://127.0.0.1:3000',
        headless: true,
    },
    webServer: {
        command: 'npm run build && npm run server',
        url: 'http://127.0.0.1:3000/healthz',
        reuseExistingServer: true,
        timeout: 120000,
    },
});
