/**
 * Servidor estático con respaldo SPA para el «antes»: sirve un `ng build
 * --configuration demo` ya compilado, sin vigilancia ni recompilación (un
 * `ng serve` por commit agotaba la memoria del contenedor).
 * Uso: node playwright/carril-f/servir-estatico.mjs <carpeta> <puerto>
 */
import { createServer } from 'node:http';
import { readFileSync, existsSync, statSync } from 'node:fs';
import { extname, join, normalize } from 'node:path';

const [, , raiz = 'dist', puerto = '4302'] = process.argv;
const TIPOS = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.mjs': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.svg': 'image/svg+xml', '.png': 'image/png', '.jpg': 'image/jpeg', '.webp': 'image/webp', '.woff2': 'font/woff2', '.woff': 'font/woff', '.ttf': 'font/ttf', '.ico': 'image/x-icon', '.txt': 'text/plain' };
const base = existsSync(join(raiz, 'browser')) ? join(raiz, 'browser') : raiz;

createServer((req, res) => {
  const ruta = normalize(decodeURIComponent(new URL(req.url, 'http://x').pathname)).replace(/^(\.\.[/\\])+/, '');
  let archivo = join(base, ruta);
  if (!existsSync(archivo) || statSync(archivo).isDirectory()) archivo = existsSync(join(archivo, 'index.html')) && statSync(archivo).isDirectory() ? join(archivo, 'index.html') : join(base, 'index.html');
  res.setHeader('Content-Type', TIPOS[extname(archivo)] ?? 'application/octet-stream');
  res.end(readFileSync(archivo));
}).listen(Number(puerto), () => console.log(`estático ${base} en http://localhost:${puerto}`));
