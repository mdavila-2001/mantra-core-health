import base from '/home/user/mantra-core-health/playwright.config';

export default {
  ...base,
  testDir: '/home/user/mantra-core-health/playwright',
  outputDir: '/home/user/mantra-core-health/artifacts/playwright/salida',
  reporter: [['list']],
  use: { ...base.use, launchOptions: { executablePath: '/opt/pw-browsers/chromium', args: ['--no-sandbox'] } },
};
