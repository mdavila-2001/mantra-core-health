import { expect, test, type Page, type Locator } from '@playwright/test';
import { mkdirSync, writeFileSync, readFileSync } from 'node:fs';
import { jsPDF } from 'jspdf';

const evidence = 'docs/frontend/evidence/file-upload';
const imageFile = {
  name: 'documento.png',
  mimeType: 'image/png',
  buffer: readFileSync('playwright/fixtures/upload-document.png'),
};
function pdfFile() {
  const pdf = new jsPDF();
  pdf.text('SEPREC - DOCUMENTO DE PRUEBA', 20, 30);
  pdf.text('Vista previa local. Sin datos personales.', 20, 45);
  pdf.addPage();
  pdf.text('SEGUNDA PAGINA - LICENCIA', 20, 30);
  return {
    name: 'documento.pdf',
    mimeType: 'application/pdf',
    buffer: Buffer.from(pdf.output('arraybuffer')),
  };
}
async function documents(page: Page, kind = 'laboratory', prefix = 'lab') {
  await page.goto(`/auth/register/${kind}`);
  // El arnés usa ng serve: esperar la instancia hidratada evita escribir sobre el SSR previo.
  await page.waitForFunction(() => {
    const host = document.querySelector('app-paginated-form');
    const runtime = window as typeof window & { ng?: { getComponent(element: Element): unknown } };
    return host !== null && !!runtime.ng?.getComponent(host);
  });
  await page.getByTestId(`registro-${prefix}-razon-social`).fill('Laboratorio de prueba');
  await page.getByTestId(`registro-${prefix}-nit`).fill('1234567');
  await page.locator('select').selectOption({ label: 'S.R.L.' });
  await page.getByRole('button', { name: 'Siguiente', exact: true }).click();
  if (prefix === 'imagen') {
    await page.getByText('Rayos X', { exact: true }).click();
    await expect(page.getByRole('checkbox').first()).toBeChecked();
    await page.getByRole('button', { name: 'Siguiente', exact: true }).click();
  }
  await expect(page.locator('app-file-input')).toHaveCount(4);
}
async function drop(page: Page, zone: Locator, file: ReturnType<typeof pdfFile>) {
  const transfer = await page.evaluateHandle(
    ({ name, mimeType, bytes, size }) => {
      const data = new DataTransfer();
      data.items.add(
        new File([size ? new Uint8Array(size) : new Uint8Array(bytes)], name, { type: mimeType }),
      );
      return data;
    },
    {
      name: file.name,
      mimeType: file.mimeType,
      bytes: file.buffer.length > 1024 * 1024 ? [] : [...file.buffer],
      size: file.buffer.length > 1024 * 1024 ? file.buffer.length : 0,
    },
  );
  await zone.dispatchEvent('dragover', { dataTransfer: transfer });
  await expect(zone).toHaveClass(/is-dragging/);
  await zone.dispatchEvent('drop', { dataTransfer: transfer });
  await expect(zone).not.toHaveClass(/is-dragging/);
  await transfer.dispose();
}
async function renderedPreview(field: Locator) {
  const image = field.locator('app-file-preview img');
  await expect(image).toBeVisible();
  await expect
    .poll(() => image.evaluate((element: HTMLImageElement) => element.naturalWidth))
    .toBeGreaterThan(0);
  return image;
}

for (const [width, height] of [
  [390, 844],
  [768, 1024],
  [1024, 768],
  [1440, 900],
  [1920, 1080],
]) {
  test(`laboratory: drag, PDF, images and layout at ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height });
    const errors: string[] = [];
    const consoleErrors: string[] = [];
    const failedRequests: string[] = [];
    page.on('pageerror', (error) => errors.push(error.message));
    page.on('console', (message) => {
      if (message.type() === 'error') consoleErrors.push(message.text());
    });
    page.on('requestfailed', (request) =>
      failedRequests.push(`${request.url()} ${request.failure()?.errorText}`),
    );
    await documents(page);
    const first = page.locator('app-file-input').first();
    await first.locator('input').focus();
    await expect(first.locator('input')).toBeFocused();
    const chooser = page.waitForEvent('filechooser');
    await first.locator('input').press('Enter');
    await (await chooser).setFiles(imageFile);
    await renderedPreview(first);
    await drop(page, first.locator('.dropzone'), pdfFile());
    const preview = await renderedPreview(first);
    const firstPage = await preview.getAttribute('src');
    await first.getByRole('button', { name: 'Página siguiente del PDF' }).click();
    await expect(first).toContainText('2 / 2');
    await renderedPreview(first);
    await expect(preview).not.toHaveAttribute('src', firstPage!);
    await first.getByRole('button', { name: 'Página anterior del PDF' }).click();
    await expect(first).toContainText('1 / 2');
    await renderedPreview(first);
    const second = page.locator('app-file-input').nth(1);
    await second
      .locator('input')
      .setInputFiles({ ...imageFile, name: `${'licencia-'.repeat(12)}.png` });
    await renderedPreview(second);
    for (const field of await page.locator('app-file-input').all()) {
      const box = await field.boundingBox();
      expect(box!.x).toBeGreaterThanOrEqual(0);
      expect(box!.x + box!.width).toBeLessThanOrEqual(width + 1);
    }
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(
      true,
    );
    mkdirSync(evidence, { recursive: true });
    await first.scrollIntoViewIfNeeded();
    await page.screenshot({ path: `${evidence}/laboratory-${width}.png` });
    await first.screenshot({ path: `${evidence}/pdf-${width}.png` });
    expect(errors).toEqual([]);
    // ng serve's SSR hydration scripts have existing inline CSP warnings; retain them in evidence.
    const baseline = JSON.parse(readFileSync(`${evidence}/baseline/console.json`, 'utf8')) as { errors: string[] };
    const unexpectedConsole = consoleErrors.filter(message => !baseline.errors.includes(message));
    expect(unexpectedConsole).toEqual([]);
    expect(failedRequests).toEqual([]);
    writeFileSync(
      `${evidence}/manifest-${width}.json`,
      JSON.stringify(
        {
          route: page.url(),
          role: 'public',
          viewport: { width, height },
          errors,
          consoleErrors,
          failedRequests,
          assertions: [
            'keyboard chooser',
            'image decoded',
            'real PDF rendered',
            'PDF pagination',
            'drag and drop',
            'replacement',
            'long filename fits',
            'no horizontal overflow',
          ],
          result: 'PASS',
        },
        null,
        2,
      ),
    );
  });
}

test('rejections preserve the file; navigation restores previews; removal restores required validation', async ({
  page,
}) => {
  await documents(page);
  const first = page.locator('app-file-input').first();
  await first.locator('input').setInputFiles(pdfFile());
  await renderedPreview(first);
  await drop(page, first.locator('.dropzone'), {
    name: 'invalid.exe',
    mimeType: 'application/octet-stream',
    buffer: Buffer.from('invalid'),
  });
  await expect(first.getByRole('alert')).toContainText('Formato no permitido');
  await expect(first.locator('.file-name')).toHaveText('documento.pdf');
  await drop(page, first.locator('.dropzone'), {
    name: 'large.pdf',
    mimeType: 'application/pdf',
    buffer: Buffer.alloc(5 * 1024 * 1024 + 1),
  });
  await expect(first.getByRole('alert')).toContainText('Supera el límite de 5 MB');
  await expect(first.locator('.file-name')).toHaveText('documento.pdf');
  for (const index of [1, 2])
    await page.locator('app-file-input').nth(index).locator('input').setInputFiles(imageFile);
  await page.getByRole('button', { name: 'Siguiente', exact: true }).click();
  await page.getByTestId('paginated-form-atras').click();
  await renderedPreview(page.locator('app-file-input').first());
  await page.getByTestId('registro-lab-quitar-seprecFile').click();
  await expect(first.locator('app-file-preview')).toHaveCount(0);
  await page.getByRole('button', { name: 'Siguiente', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Los papeles de la empresa' })).toBeVisible();
  await expect(first.locator('input')).toHaveAttribute('aria-invalid', 'true');
  await first.locator('input').setInputFiles(pdfFile());
  await renderedPreview(first);
  await expect(first.getByRole('alert')).toHaveCount(0);
});

test('imaging center inherits the document picker and preview', async ({ page }) => {
  await documents(page, 'imaging-center', 'imagen');
  const first = page.locator('app-file-input').first();
  await drop(page, first.locator('.dropzone'), pdfFile());
  await renderedPreview(first);
  await first.screenshot({ path: `${evidence}/imaging-center.png` });
});

test('dark theme and damaged document feedback', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 1080 });
  await page.emulateMedia({ colorScheme: 'dark', reducedMotion: 'reduce' });
  await documents(page);
  const first = page.locator('app-file-input').first();
  await first
    .locator('input')
    .setInputFiles({
      name: 'damaged.pdf',
      mimeType: 'application/pdf',
      buffer: Buffer.from('not a pdf'),
    });
  await expect(first).toContainText('No pudimos mostrar la vista previa');
  await first.locator('input').setInputFiles(pdfFile());
  await renderedPreview(first);
  await first.screenshot({ path: `${evidence}/dark-preview.png` });
});

test('shared picker previews text and audio, and disabled picker rejects drops', async ({
  page,
}) => {
  await page.goto('/design-system');
  const picker = page.locator('app-file-input').first();
  await expect(picker).toBeAttached();
  await picker
    .locator('input')
    .setInputFiles({
      name: 'catalog.json',
      mimeType: 'application/json',
      buffer: Buffer.from('{"nombre":"Catálogo de prueba","activo":true}'),
    });
  await expect(picker.locator('pre')).toContainText('Catálogo de prueba');
  await picker.scrollIntoViewIfNeeded();
  await picker.screenshot({ path: `${evidence}/text-preview.png` });
  // WAV PCM real: un segundo de silencio, sólo para probar decodificación y controles.
  const wav = Buffer.alloc(44 + 16000);
  wav.write('RIFF', 0);
  wav.writeUInt32LE(wav.length - 8, 4);
  wav.write('WAVEfmt ', 8);
  wav.writeUInt32LE(16, 16);
  wav.writeUInt16LE(1, 20);
  wav.writeUInt16LE(1, 22);
  wav.writeUInt32LE(8000, 24);
  wav.writeUInt32LE(16000, 28);
  wav.writeUInt16LE(2, 32);
  wav.writeUInt16LE(16, 34);
  wav.write('data', 36);
  wav.writeUInt32LE(16000, 40);
  await picker
    .locator('input')
    .setInputFiles({ name: 'audio.wav', mimeType: 'audio/wav', buffer: wav });
  await expect(picker.locator('audio')).toBeVisible();
  await expect
    .poll(() => picker.locator('audio').evaluate((audio: HTMLAudioElement) => audio.readyState))
    .toBeGreaterThanOrEqual(1);
  const videoBytes = await page.evaluate(async () => {
    const canvas = document.createElement('canvas');
    canvas.width = 320; canvas.height = 180;
    const context = canvas.getContext('2d')!;
    context.fillStyle = '#0d5675'; context.fillRect(0, 0, 320, 180);
    context.fillStyle = '#ffffff'; context.font = '20px sans-serif';
    context.fillText('Video de prueba', 60, 90);
    const stream = canvas.captureStream(5);
    const recorder = new MediaRecorder(stream, { mimeType: 'video/webm' });
    const chunks: Blob[] = [];
    recorder.ondataavailable = event => chunks.push(event.data);
    const stopped = new Promise<void>(resolve => { recorder.onstop = () => resolve(); });
    recorder.start();
    await new Promise(resolve => setTimeout(resolve, 300));
    recorder.stop(); await stopped;
    stream.getTracks().forEach(track => track.stop());
    return [...new Uint8Array(await new Blob(chunks).arrayBuffer())];
  });
  await picker.locator('input').setInputFiles({ name: 'video.webm', mimeType: 'video/webm', buffer: Buffer.from(videoBytes) });
  await expect(picker.locator('video')).toBeVisible();
  await expect.poll(() => picker.locator('video').evaluate((video: HTMLVideoElement) => video.readyState)).toBeGreaterThanOrEqual(1);
  await picker.screenshot({ path: `${evidence}/video-preview.png` });
  const disabled = page.locator('app-file-input').filter({ has: page.locator('input:disabled') });
  const transfer = await page.evaluateHandle(() => {
    const data = new DataTransfer();
    data.items.add(new File(['x'], 'ignored.txt', { type: 'text/plain' }));
    return data;
  });
  await disabled.locator('.dropzone').dispatchEvent('drop', { dataTransfer: transfer });
  await expect(disabled.locator('app-file-preview')).toHaveCount(0);
  await transfer.dispose();
});


test('compact comment picker rejects invalid drag without uploading', async ({ page }) => {
  await page.goto('/design-system/stock/shared/components/molecules/comment-media-picker/comment-media-picker');
  const disabledSetting = page.getByRole('row').filter({ hasText: 'disabled' }).getByRole('textbox');
  await disabledSetting.fill('false');
  await disabledSetting.press('Tab');
  const frame = page.frameLocator('iframe');
  const button = frame.getByRole('button', { name: 'Imagen', exact: true });
  await expect(button).toBeVisible();
  await expect(button).toBeEnabled();
  const transfer = await button.evaluateHandle(() => {
    const data = new DataTransfer();
    data.items.add(new File(['invalid'], 'document.pdf', { type: 'application/pdf' }));
    return data;
  });
  await button.dispatchEvent('dragover', { dataTransfer: transfer });
  await expect(button).toHaveClass(/file-drop-target--active/);
  await button.dispatchEvent('drop', { dataTransfer: transfer });
  await expect(frame.getByRole('alert')).toContainText('formato');
  await expect(frame.getByTestId('comment-media-item')).toHaveCount(0);
  await transfer.dispose();
});
