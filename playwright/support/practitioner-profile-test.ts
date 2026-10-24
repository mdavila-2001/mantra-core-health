import { expect, test as base } from '@playwright/test';

/** Sólo lecturas auxiliares bloqueadas en la API local; perfil, login y archivos son reales. */
export const profileTest = base.extend<{ profileFallbacks: void }>({
  profileFallbacks: [
    async ({ page, request }, use, testInfo) => {
      const apiBase = process.env['E2E_API_URL'] ?? 'http://localhost:3000';
      const health = await request.get(`${apiBase}/health`, { timeout: 10_000 });
      expect(health.status(), 'el backend está encendido antes del recorrido').toBe(200);
      console.log(`BACKEND_HEALTH=${health.status()}`);
      const isolated = process.env['E2E_PROFILE_ISOLATED'] === '1';
      const mode = isolated
        ? 'ISOLATED: signature-assets, insurance-networks, insurance-carriers y service-offerings simulados; resto API real'
        : 'REAL: ninguna respuesta interceptada';
      testInfo.annotations.push({ type: 'evidence-mode', description: mode });
      console.log(`EVIDENCE_MODE=${mode}`);
      if (isolated) {
        await page.route('**/profiles/practitioners/me/signature-assets', async (route) => {
          if (route.request().method() !== 'GET') return route.continue();
          await route.fulfill({ json: { signatureFileId: null, sealFileId: null } });
        });
        await page.route('**/practitioners/*/insurance-networks', async (route) => {
          if (route.request().method() !== 'GET') return route.continue();
          await route.fulfill({ json: { items: [], count: 0 } });
        });
        await page.route('**/practitioners/*/insurance-carriers', async (route) => {
          if (route.request().method() !== 'GET') return route.continue();
          await route.fulfill({ json: { items: [] } });
        });
        await page.route('**/scheduling/service-offerings?practitionerProfileId=*', async (route) => {
          if (route.request().method() !== 'GET') return route.continue();
          await route.fulfill({ json: { items: [] } });
        });
      }
      await use();
    },
    { auto: true },
  ],
});
