// helpers de flujo
const L = require('./lib.cjs');
const cbState = (loc) => loc.locator('input[type=checkbox]').first().evaluate((i) => ({ checked: i.checked, indeterminate: i.indeterminate, disabled: i.disabled }));
async function openOrders(page) {
  await page.getByTestId('consulta-casilla-ordenes').click();
  await page.locator('[data-testid=consulta-modal] dialog').waitFor();
  await page.getByTestId('lab-picker').waitFor();
  await page.waitForTimeout(800);
}
const card = (page, name) => page.getByTestId('lab-picker-card').filter({ hasText: name }).first();
const row = (page, name) => page.getByTestId('lab-picker-row').filter({ hasText: name }).first();
const pedirBtn = (page) => page.locator('[data-testid=consulta-modal] app-form-actions button[type=submit], [data-testid=consulta-modal] app-form-actions button').filter({ hasText: /Pedir estudio/ }).first();
async function counter(page) { return (await page.getByTestId('lab-picker-counter').innerText()).trim(); }
async function registro(page) { return page.evaluate(() => JSON.parse(sessionStorage.getItem('mock:registro') ?? '[]')); }
module.exports = { ...L, cbState, openOrders, card, row, pedirBtn, counter, registro };
async function pickImaging(page, rx) {
  await page.getByTestId('segmentado-IMAGING').click();
  await page.getByTestId('imaging-picker').waitFor(); await page.waitForTimeout(1200);
  await page.getByTestId('imaging-picker-study').click();
  await page.locator('dialog[open] input').first().fill(rx.q); await page.waitForTimeout(700);
  await page.locator('dialog[open] [role=option]').filter({ hasText: rx.name }).first().click();
  await page.waitForTimeout(2500);
  await page.getByTestId('body-region-visor').scrollIntoViewIfNeeded(); await page.waitForTimeout(3500);
}
const regionText = (page) => page.locator('.body-region-picker__region').innerText().then(s=>s.replace(/\s+/g,' ').trim());
module.exports.pickImaging = pickImaging; module.exports.regionText = regionText;
