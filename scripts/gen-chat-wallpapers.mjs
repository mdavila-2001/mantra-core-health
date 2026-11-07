#!/usr/bin/env node
/**
 * Generates the chat wallpapers (Full HD, 1920×1080) and their thumbnails.
 *
 * Usage: `yarn node scripts/gen-chat-wallpapers.mjs`
 *
 * Each wallpaper is a soft gradient with the AloVida health doodle
 * (`public/chat-patron.svg`) on top, rendered in Chromium so the result is
 * exactly what the browser would paint. Output goes to `public/chat-fondos/`
 * as JPEG (~150 KB each): one `<id>.jpg` at 1920×1080 and one
 * `<id>-mini.jpg` at 384×216 for the picker. The ids must match
 * `CHAT_WALLPAPERS` in `src/app/core/messaging/chat-wallpaper.ts`.
 */
import { chromium } from '@playwright/test';
import { mkdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

const root = join(import.meta.dirname, '..');
const out = join(root, 'public', 'chat-fondos');
const doodle = readFileSync(join(root, 'public', 'chat-patron.svg'), 'utf8');
const doodleUrl = `data:image/svg+xml;base64,${Buffer.from(doodle).toString('base64')}`;

/** id, gradient stops (top-left → bottom-right), doodle colour, doodle opacity. */
const WALLPAPERS = [
  ['menta', ['#E3F2EE', '#CFE8E1'], '#2F6B60', 0.09],
  ['arena', ['#F3ECE2', '#E7DCCB'], '#7A5B3A', 0.08],
  ['cielo', ['#E4EFF8', '#CFE0F0'], '#2C5A85', 0.09],
  ['lavanda', ['#ECE7F5', '#DCD3EE'], '#5B4A8A', 0.09],
  ['durazno', ['#FBE9DF', '#F4D6C6'], '#9A4E2E', 0.08],
  ['salvia', ['#E8EEDF', '#D5E0C6'], '#4E6A35', 0.09],
  ['petroleo', ['#0E3440', '#06202A'], '#9FD8D0', 0.08],
  ['medianoche', ['#141C2E', '#0A0F1C'], '#9DB4E0', 0.07],
  ['bosque', ['#13291F', '#091A12'], '#A6D9B8', 0.07],
  ['ciruela', ['#2A1730', '#170B1C'], '#E0B4E6', 0.07],
];

const html = ([, [from, to], ink, alpha]) => `<!doctype html><html><body style="margin:0">
<div style="position:relative;width:1920px;height:1080px;overflow:hidden;
  background:radial-gradient(1200px 800px at 15% 10%, rgba(255,255,255,.18), transparent 70%),
             radial-gradient(1000px 700px at 90% 95%, rgba(0,0,0,.10), transparent 70%),
             linear-gradient(135deg, ${from}, ${to});">
  <div style="position:absolute;inset:0;background:${ink};opacity:${alpha};
    -webkit-mask-image:url('${doodleUrl}');-webkit-mask-size:460px 460px;-webkit-mask-repeat:repeat;
    mask-image:url('${doodleUrl}');mask-size:460px 460px;mask-repeat:repeat;"></div>
</div></body></html>`;

mkdirSync(out, { recursive: true });
// PW_CHROMIUM lets a machine with a preinstalled Chromium skip `playwright install`.
const browser = await chromium.launch({ executablePath: process.env.PW_CHROMIUM || undefined });
try {
  for (const wallpaper of WALLPAPERS) {
    const [id] = wallpaper;
    for (const [suffix, scale] of [['', 1], ['-mini', 0.2]]) {
      const page = await browser.newPage({
        viewport: { width: 1920, height: 1080 },
        deviceScaleFactor: scale,
      });
      await page.setContent(html(wallpaper));
      await page.screenshot({ path: join(out, `${id}${suffix}.jpg`), type: 'jpeg', quality: suffix ? 80 : 86 });
      await page.close();
    }
    console.log(`chat-fondos/${id}.jpg`);
  }
} finally {
  await browser.close();
}
